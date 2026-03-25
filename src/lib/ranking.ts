import { Restaurant, RatingPlatform } from "./types";

// Position-based weights for user's priority order
const POSITION_WEIGHTS = [0.50, 0.35, 0.15];

// Small boost for having available reservations
const RESERVATION_BOOST_MANY = 0.1; // 3+ slots
const RESERVATION_BOOST_FEW = 0.05; // 1-2 slots

export function calculateScore(
  restaurant: Restaurant,
  sourceOrder: RatingPlatform[]
): number {
  // Filter to only enabled sources
  const enabledSources = sourceOrder.filter((_, i) => i < POSITION_WEIGHTS.length);

  // Build a map of platform → rating for this restaurant
  const ratingMap = new Map<RatingPlatform, number>();
  for (const review of restaurant.reviews) {
    ratingMap.set(review.platform, review.rating);
  }

  // Collect weights and ratings for sources this restaurant actually has
  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < enabledSources.length; i++) {
    const platform = enabledSources[i];
    const rating = ratingMap.get(platform);
    if (rating !== undefined) {
      const weight = POSITION_WEIGHTS[i];
      totalWeight += weight;
      weightedSum += rating * weight;
    }
  }

  // If no matching sources, fall back to simple average of all reviews
  if (totalWeight === 0) {
    if (restaurant.reviews.length === 0) return 0;
    const avg =
      restaurant.reviews.reduce((sum, r) => sum + r.rating, 0) /
      restaurant.reviews.length;
    return Math.round(avg * 100) / 100;
  }

  // Redistribute weights proportionally (normalize to sum=1)
  const score = weightedSum / totalWeight;

  // Reservation boost
  let boost = 0;
  if (restaurant.reservations.length >= 3) {
    boost = RESERVATION_BOOST_MANY;
  } else if (restaurant.reservations.length > 0) {
    boost = RESERVATION_BOOST_FEW;
  }

  return Math.round((score + boost) * 100) / 100;
}

export function rankRestaurants(
  restaurants: Restaurant[],
  sourceOrder: RatingPlatform[]
): Restaurant[] {
  // Score each restaurant
  const scored = restaurants.map((r) => {
    r.aggregateRating = calculateScore(r, sourceOrder);
    return r;
  });

  // Sort: restaurants with reservations first, then by score
  scored.sort((a, b) => {
    const aHasRes = a.reservations.length > 0 ? 1 : 0;
    const bHasRes = b.reservations.length > 0 ? 1 : 0;
    if (bHasRes !== aHasRes) return bHasRes - aHasRes;
    return b.aggregateRating - a.aggregateRating;
  });

  return scored;
}
