import { ReservationSlot, MealTime } from "./types";

const RESY_API_BASE = "https://api.resy.com";
const RESY_API_KEY = "VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5";

const CITY_SLUGS: Record<string, string> = {
  "new york": "ny", "nyc": "ny", "manhattan": "ny", "brooklyn": "ny",
  "lower east side": "ny", "upper west side": "ny", "east village": "ny",
  "west village": "ny", "soho": "ny", "tribeca": "ny", "chelsea": "ny",
  "williamsburg": "ny", "nolita": "ny", "nomad": "ny", "harlem": "ny",
  "los angeles": "la", "la": "la",
  "chicago": "chi", "san francisco": "sf", "sf": "sf",
  "miami": "mia", "austin": "atx", "houston": "hou",
  "washington": "dc", "dc": "dc", "boston": "bos",
  "nashville": "nas", "denver": "den", "seattle": "sea",
  "philadelphia": "phi", "atlanta": "atl", "portland": "pdx",
};

// NYC neighborhood approximate coordinates
const LOCATION_COORDS: Record<string, { lat: number; long: number }> = {
  "lower east side": { lat: 40.7185, long: -73.9875 },
  "east village": { lat: 40.7265, long: -73.9815 },
  "west village": { lat: 40.7336, long: -74.0027 },
  "soho": { lat: 40.7233, long: -73.9985 },
  "tribeca": { lat: 40.7163, long: -74.0086 },
  "chelsea": { lat: 40.7465, long: -74.0014 },
  "williamsburg": { lat: 40.7081, long: -73.9571 },
  "nolita": { lat: 40.7234, long: -73.9954 },
  "nomad": { lat: 40.7454, long: -73.9879 },
  "upper west side": { lat: 40.7870, long: -73.9754 },
  "upper east side": { lat: 40.7736, long: -73.9566 },
  "harlem": { lat: 40.8116, long: -73.9465 },
  "midtown": { lat: 40.7549, long: -73.9840 },
  "manhattan": { lat: 40.7580, long: -73.9855 },
  "new york": { lat: 40.7580, long: -73.9855 },
  "nyc": { lat: 40.7580, long: -73.9855 },
  "brooklyn": { lat: 40.6782, long: -73.9442 },
};

function getCoords(location: string): { lat: number; long: number } {
  const lower = location.toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return { lat: 40.7580, long: -73.9855 }; // default to midtown
}

function locationToResyCity(location: string): string {
  const lower = location.toLowerCase();
  for (const [key, slug] of Object.entries(CITY_SLUGS)) {
    if (lower.includes(key)) return slug;
  }
  return "ny";
}

interface ResySearchHit {
  id: { resy: number };
  name: string;
  neighborhood: string;
  cuisine: string[];
  price_range_id: number;
  images: string[];
  url_slug: string;
  locality: string;
  location: { name: string; code: string; url_slug: string };
}

interface ResySearchResponse {
  search: {
    hits: ResySearchHit[];
    nbHits: number;
  };
}

interface ResyCalendarResponse {
  scheduled: { date: string; inventory: string }[];
  last_calendar_day: string | null;
}

export interface ResyVenueResult {
  venueId: number;
  name: string;
  neighborhood: string;
  cuisine: string;
  priceLevel: number;
  imageUrl: string;
  urlSlug: string;
  hasAvailability: boolean;
  resyUrl: string;
}

/**
 * Strict name matching — only accept a Resy result if the names genuinely match.
 * Resy's search is very fuzzy and returns unrelated results.
 */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''´`]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findBestNameMatch(
  searchName: string,
  hits: ResySearchHit[]
): ResySearchHit | null {
  const normalized = normalizeForMatch(searchName);
  const searchTokens = normalized.split(" ").filter((t) => t.length > 1);

  for (const hit of hits) {
    const hitNorm = normalizeForMatch(hit.name);
    const hitTokens = hitNorm.split(" ").filter((t) => t.length > 1);

    // Exact match
    if (hitNorm === normalized) return hit;

    // One contains the other
    if (hitNorm.includes(normalized) || normalized.includes(hitNorm)) return hit;

    // Strong token overlap: at least 60% of the shorter name's tokens must match
    if (searchTokens.length > 0 && hitTokens.length > 0) {
      let matches = 0;
      for (const t of searchTokens) {
        if (hitTokens.some((ht) => ht === t || ht.startsWith(t) || t.startsWith(ht))) {
          matches++;
        }
      }
      const overlapRatio = matches / Math.min(searchTokens.length, hitTokens.length);
      if (overlapRatio >= 0.6 && matches >= 1) return hit;
    }
  }

  return null;
}

const headers = {
  Authorization: `ResyAPI api_key="${RESY_API_KEY}"`,
  "Content-Type": "application/json",
};

/**
 * Search for restaurants via Resy's venue search API
 */
async function searchVenues(
  query: string,
  location: string,
  perPage: number = 20
): Promise<ResySearchHit[]> {
  try {
    const coords = getCoords(location);
    const res = await fetch(`${RESY_API_BASE}/3/venuesearch/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        geo: { latitude: coords.lat, longitude: coords.long },
        types: ["venue"],
        per_page: perPage,
      }),
      next: { revalidate: 300 },
    });

    if (!res.ok) return [];
    const data: ResySearchResponse = await res.json();
    return data.search?.hits || [];
  } catch (err) {
    console.error("Resy venue search error:", err);
    return [];
  }
}

/**
 * Check if a venue has availability on a specific date
 */
async function checkVenueAvailability(
  venueId: number,
  date: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${RESY_API_BASE}/3/venue/calendar?venue_id=${venueId}&num_seats=2&start_date=${date}&end_date=${date}`,
      { headers, next: { revalidate: 60 } }
    );

    if (!res.ok) return false;
    const data: ResyCalendarResponse = await res.json();
    return data.scheduled?.some(
      (d) => d.date === date && d.inventory === "available"
    ) || false;
  } catch {
    return false;
  }
}

/**
 * Search for restaurants on Resy and check availability.
 * Walks down the list by rank until we find enough with open tables.
 */
export async function searchResyWithAvailability(
  restaurantNames: string[],
  location: string,
  date: string,
  mealTime: MealTime,
  minResults: number = 5
): Promise<Map<string, ResyVenueResult>> {
  const results = new Map<string, ResyVenueResult>();
  const citySlug = locationToResyCity(location);
  const checkedVenueIds = new Set<number>();

  // Check each restaurant name in ranked order
  const batchSize = 3;
  for (let i = 0; i < restaurantNames.length; i += batchSize) {
    if (results.size >= minResults) break;

    const batch = restaurantNames.slice(i, i + batchSize);

    // Search for each restaurant on Resy
    const searchResults = await Promise.all(
      batch.map((name) => searchVenues(name, location, 3))
    );

    // Only accept Resy results that actually match our restaurant name
    const venueChecks: { name: string; hit: ResySearchHit }[] = [];
    for (let j = 0; j < batch.length; j++) {
      const hits = searchResults[j];
      const match = findBestNameMatch(batch[j], hits);
      if (match && !checkedVenueIds.has(match.id.resy)) {
        venueChecks.push({ name: batch[j], hit: match });
        checkedVenueIds.add(match.id.resy);
      }
    }

    const availResults = await Promise.all(
      venueChecks.map((vc) => checkVenueAvailability(vc.hit.id.resy, date))
    );

    for (let j = 0; j < venueChecks.length; j++) {
      if (availResults[j]) {
        const { name, hit } = venueChecks[j];
        const locationCode = hit.location?.code || citySlug;
        const resyUrl = `https://resy.com/cities/${locationCode}/${hit.url_slug}?date=${date}&seats=2`;
        results.set(name, {
          venueId: hit.id.resy,
          name: hit.name,
          neighborhood: hit.neighborhood || location,
          cuisine: hit.cuisine?.join(", ") || "Restaurant",
          priceLevel: hit.price_range_id || 2,
          imageUrl: hit.images?.[0] || "",
          urlSlug: hit.url_slug,
          hasAvailability: true,
          resyUrl,
        });
      }
    }
  }

  // If we still don't have enough, search Resy directly for available restaurants
  if (results.size < minResults) {
    const areaHits = await searchVenues(`restaurants ${location}`, location, 20);

    // Filter to only unchecked venues
    const unchecked = areaHits.filter((h) => !checkedVenueIds.has(h.id.resy));

    // Check availability in batches
    for (let i = 0; i < unchecked.length; i += batchSize) {
      if (results.size >= minResults) break;

      const batch = unchecked.slice(i, i + batchSize);
      const avail = await Promise.all(
        batch.map((h) => checkVenueAvailability(h.id.resy, date))
      );

      for (let j = 0; j < batch.length; j++) {
        if (avail[j]) {
          const hit = batch[j];
          checkedVenueIds.add(hit.id.resy);
          const locationCode = hit.location?.code || citySlug;
          const resyUrl = `https://resy.com/cities/${locationCode}/${hit.url_slug}?date=${date}&seats=2`;
          // Use a synthetic key so it doesn't collide with ranked restaurants
          results.set(`resy:${hit.name}`, {
            venueId: hit.id.resy,
            name: hit.name,
            neighborhood: hit.neighborhood || location,
            cuisine: hit.cuisine?.join(", ") || "Restaurant",
            priceLevel: hit.price_range_id || 2,
            imageUrl: hit.images?.[0] || "",
            urlSlug: hit.url_slug,
            hasAvailability: true,
            resyUrl,
          });
        }
      }
    }
  }

  return results;
}
