import { Restaurant, MealTime, RatingPlatform, DEFAULT_SOURCE_ORDER } from "./types";
import { searchYelp } from "./yelp";
import { searchGooglePlaces } from "./google-places";
import { searchResyWithAvailability } from "./resy";
import { searchMichelin, lookupMichelin } from "./michelin";
import { getMockRestaurants } from "./mock-data";
import { rankRestaurants } from "./ranking";

const STOP_WORDS = new Set(["the", "restaurant", "cafe", "bar", "nyc", "ny", "and", "of"]);

function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(
    normalizeString(a).split(" ").filter((t) => t.length > 2 && !STOP_WORDS.has(t))
  );
  const tokensB = new Set(
    normalizeString(b).split(" ").filter((t) => t.length > 2 && !STOP_WORDS.has(t))
  );
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let matches = 0;
  for (const t of tokensA) if (tokensB.has(t)) matches++;
  return matches / Math.min(tokensA.size, tokensB.size);
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalizeString(a);
  const nb = normalizeString(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  return tokenOverlap(a, b) >= 0.5;
}

async function attachMichelinData(
  restaurants: Restaurant[],
  location: string
) {
  try {
    const michelinData = await searchMichelin(location);
    for (const restaurant of restaurants) {
      const match = lookupMichelin(restaurant.name, michelinData);
      if (match) {
        restaurant.michelinDistinction = match.distinction;
        const hasMichelin = restaurant.reviews.some((r) => r.platform === "michelin");
        if (!hasMichelin) {
          restaurant.reviews.push({
            platform: "michelin",
            rating: match.rating,
            reviewCount: 0,
            url: match.url,
          });
        }
      }
    }
  } catch (err) {
    console.error("Michelin integration error:", err);
  }
}

const MIN_RESULTS = 5;

export async function searchRestaurants(
  location: string,
  date: string,
  mealTime: MealTime,
  sourceOrder: RatingPlatform[] = DEFAULT_SOURCE_ORDER,
  priceRange?: { min: number; max: number }
): Promise<Restaurant[]> {
  const hasYelp = !!process.env.YELP_API_KEY;
  const hasGoogle = !!process.env.GOOGLE_PLACES_API_KEY;

  let allRestaurants: Restaurant[];

  if (!hasYelp && !hasGoogle) {
    // Mock data path — still enrich with Michelin
    allRestaurants = getMockRestaurants(location, mealTime);
    await attachMichelinData(allRestaurants, location);
  } else {
    // Real API path — fetch Yelp + Google + Michelin in parallel
    const [yelpData, googleData] = await Promise.all([
      searchYelp(location, date, mealTime),
      searchGooglePlaces(location),
    ]);

    // Merge restaurants by name matching
    const restaurantMap = new Map<string, Restaurant>();

    for (const r of yelpData.restaurants) {
      const key = normalizeString(r.name);
      restaurantMap.set(key, {
        id: r.id,
        name: r.name,
        cuisine: r.cuisine,
        priceLevel: r.priceLevel,
        address: r.address,
        neighborhood: location,
        imageUrl: r.imageUrl,
        reviews: [r.review],
        aggregateRating: 0,
        totalReviewCount: r.review.reviewCount,
        reservations: [],
      });
    }

    for (const r of googleData.restaurants) {
      let existing: Restaurant | undefined;
      for (const [, v] of restaurantMap) {
        if (fuzzyMatch(r.name, v.name)) {
          existing = v;
          break;
        }
      }

      if (existing) {
        existing.reviews.push(r.review);
        existing.totalReviewCount += r.review.reviewCount;
        if (r.imageUrl && !existing.imageUrl) {
          existing.imageUrl = r.imageUrl;
        }
      } else {
        const key = normalizeString(r.name);
        restaurantMap.set(key, {
          id: r.id,
          name: r.name,
          cuisine: r.cuisine,
          priceLevel: r.priceLevel,
          address: r.address,
          neighborhood: location,
          imageUrl: r.imageUrl,
          reviews: [r.review],
          aggregateRating: 0,
          totalReviewCount: r.review.reviewCount,
          reservations: [],
        });
      }
    }

    allRestaurants = Array.from(restaurantMap.values());
    await attachMichelinData(allRestaurants, location);
  }

  // Filter by price range if specified
  if (priceRange) {
    allRestaurants = allRestaurants.filter(
      (r) => r.priceLevel >= priceRange.min && r.priceLevel <= priceRange.max
    );
  }

  // Step 1: Rank all restaurants by user's chosen source priority
  const ranked = rankRestaurants(allRestaurants, sourceOrder);

  // Step 2: Walk down the ranked list, check Resy for availability
  const rankedNames = ranked.map((r) => r.name);
  const resyResults = await searchResyWithAvailability(
    rankedNames,
    location,
    date,
    mealTime,
    MIN_RESULTS
  );

  // Step 3: Attach Resy data to ranked restaurants
  const matchedResyKeys = new Set<string>();
  for (const restaurant of ranked) {
    for (const [searchName, resyVenue] of resyResults) {
      if (searchName.startsWith("resy:")) continue; // skip discovery results for now
      if (fuzzyMatch(restaurant.name, searchName) || fuzzyMatch(restaurant.name, resyVenue.name)) {
        restaurant.reservations = [{
          time: "See times",
          platform: "resy",
          url: resyVenue.resyUrl,
        }];
        if (!restaurant.imageUrl && resyVenue.imageUrl) {
          restaurant.imageUrl = resyVenue.imageUrl;
        }
        matchedResyKeys.add(searchName);
        break;
      }
    }
  }

  // Step 4: Create Restaurant objects for Resy-discovered venues
  // (restaurants found directly on Resy that weren't in our rated list)
  const discoveredRestaurants: Restaurant[] = [];
  for (const [key, resyVenue] of resyResults) {
    if (!key.startsWith("resy:")) continue;
    if (priceRange && (resyVenue.priceLevel < priceRange.min || resyVenue.priceLevel > priceRange.max)) continue;

    discoveredRestaurants.push({
      id: `resy-${resyVenue.venueId}`,
      name: resyVenue.name,
      cuisine: resyVenue.cuisine,
      priceLevel: resyVenue.priceLevel,
      address: resyVenue.neighborhood,
      neighborhood: resyVenue.neighborhood,
      imageUrl: resyVenue.imageUrl || undefined,
      reviews: [], // No review data yet — will only have Resy as a source
      aggregateRating: 0,
      totalReviewCount: 0,
      reservations: [{
        time: "See times",
        platform: "resy",
        url: resyVenue.resyUrl,
      }],
    });
  }

  // Step 5: Combine results — ranked with reservations first, then discovered, then padded
  const rankedWithRes = ranked.filter((r) => r.reservations.length > 0);
  const rankedWithout = ranked.filter((r) => r.reservations.length === 0);

  const allWithReservations = [...rankedWithRes, ...discoveredRestaurants];

  if (allWithReservations.length >= MIN_RESULTS) {
    return allWithReservations.slice(0, Math.max(MIN_RESULTS, allWithReservations.length));
  }

  // Pad with top-rated restaurants that don't have reservations
  const padCount = MIN_RESULTS - allWithReservations.length;
  return [...allWithReservations, ...rankedWithout.slice(0, padCount)];
}
