import { NextRequest } from "next/server";
import { searchRestaurants } from "@/lib/aggregate";
import { MealTime, RatingPlatform, DEFAULT_SOURCE_ORDER } from "@/lib/types";

const VALID_MEAL_TIMES: MealTime[] = [
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "late_night",
];

const VALID_PLATFORMS: RatingPlatform[] = ["michelin", "google", "yelp"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const location = searchParams.get("location");
  const date = searchParams.get("date");
  const mealTime = searchParams.get("mealTime") as MealTime;
  const sourcesParam = searchParams.get("sources");
  const priceMin = searchParams.get("priceMin");
  const priceMax = searchParams.get("priceMax");

  if (!location || !date || !mealTime) {
    return Response.json(
      { error: "Missing required params: location, date, mealTime" },
      { status: 400 }
    );
  }

  if (!VALID_MEAL_TIMES.includes(mealTime)) {
    return Response.json(
      { error: `Invalid mealTime. Must be one of: ${VALID_MEAL_TIMES.join(", ")}` },
      { status: 400 }
    );
  }

  // Parse source order from comma-separated param, or use default
  let sourceOrder: RatingPlatform[] = DEFAULT_SOURCE_ORDER;
  if (sourcesParam) {
    const parsed = sourcesParam.split(",").filter(
      (s): s is RatingPlatform => VALID_PLATFORMS.includes(s as RatingPlatform)
    );
    if (parsed.length > 0) {
      sourceOrder = parsed;
    }
  }

  const priceRange = priceMin && priceMax
    ? { min: parseInt(priceMin), max: parseInt(priceMax) }
    : undefined;

  const restaurants = await searchRestaurants(location, date, mealTime, sourceOrder, priceRange);

  return Response.json({
    restaurants,
    sources: {
      yelp: !!process.env.YELP_API_KEY,
      google: !!process.env.GOOGLE_PLACES_API_KEY,
      michelin: true,
      resy: true,
    },
    sourceOrder,
    usingMockData: !process.env.YELP_API_KEY && !process.env.GOOGLE_PLACES_API_KEY,
  });
}
