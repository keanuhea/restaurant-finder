export type MealTime = "breakfast" | "brunch" | "lunch" | "dinner" | "late_night";

export type RatingPlatform = "michelin" | "google" | "yelp";

export type MichelinDistinction =
  | "three-star"
  | "two-star"
  | "one-star"
  | "bib-gourmand"
  | "selected";

export interface SearchParams {
  location: string;
  date: string; // YYYY-MM-DD
  mealTime: MealTime;
  sources: RatingPlatform[]; // user-chosen priority order
}

export interface ReviewSource {
  platform: RatingPlatform;
  rating: number; // normalized 0-5
  reviewCount: number;
  url: string;
}

export interface ReservationSlot {
  time: string; // HH:MM
  platform: "resy" | "opentable" | "yelp";
  url: string;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  priceLevel: number; // 1-4
  address: string;
  neighborhood: string;
  imageUrl?: string;
  reviews: ReviewSource[];
  michelinDistinction?: MichelinDistinction;
  aggregateRating: number; // composite score from ranking algorithm
  totalReviewCount: number;
  reservations: ReservationSlot[];
}

export const MEAL_TIME_HOURS: Record<MealTime, { start: number; end: number }> = {
  breakfast: { start: 7, end: 10 },
  brunch: { start: 10, end: 14 },
  lunch: { start: 11, end: 15 },
  dinner: { start: 17, end: 22 },
  late_night: { start: 22, end: 2 },
};

export const MEAL_TIME_LABELS: Record<MealTime, string> = {
  breakfast: "Breakfast",
  brunch: "Brunch",
  lunch: "Lunch",
  dinner: "Dinner",
  late_night: "Late Night",
};

export const MICHELIN_RATING_MAP: Record<MichelinDistinction, number> = {
  "three-star": 5.0,
  "two-star": 4.8,
  "one-star": 4.6,
  "bib-gourmand": 4.4,
  "selected": 4.2,
};

export const DEFAULT_SOURCE_ORDER: RatingPlatform[] = ["michelin", "google", "yelp"];
