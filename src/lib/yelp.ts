import { ReviewSource, MealTime, MEAL_TIME_HOURS } from "./types";

const YELP_API_BASE = "https://api.yelp.com/v3";

interface YelpBusiness {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  url: string;
  image_url: string;
  price?: string;
  location: {
    display_address: string[];
    address1: string;
  };
  categories: { alias: string; title: string }[];
  coordinates: { latitude: number; longitude: number };
}

interface YelpSearchResponse {
  businesses: YelpBusiness[];
  total: number;
}

function mealTimeToYelpOpenAt(date: string, mealTime: MealTime): number {
  const hours = MEAL_TIME_HOURS[mealTime];
  const d = new Date(`${date}T${String(hours.start).padStart(2, "0")}:00:00`);
  return Math.floor(d.getTime() / 1000);
}

export async function searchYelp(
  location: string,
  date: string,
  mealTime: MealTime
): Promise<{
  restaurants: {
    id: string;
    name: string;
    cuisine: string;
    priceLevel: number;
    address: string;
    imageUrl: string;
    review: ReviewSource;
  }[];
}> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) return { restaurants: [] };

  const openAt = mealTimeToYelpOpenAt(date, mealTime);
  const params = new URLSearchParams({
    location,
    term: "restaurants",
    open_at: String(openAt),
    sort_by: "rating",
    limit: "30",
  });

  const res = await fetch(`${YELP_API_BASE}/businesses/search?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    console.error("Yelp API error:", res.status, await res.text());
    return { restaurants: [] };
  }

  const data: YelpSearchResponse = await res.json();

  return {
    restaurants: data.businesses.map((b) => ({
      id: `yelp-${b.id}`,
      name: b.name,
      cuisine: b.categories.map((c) => c.title).join(", "),
      priceLevel: b.price ? b.price.length : 2,
      address: b.location.display_address.join(", "),
      imageUrl: b.image_url,
      review: {
        platform: "yelp" as const,
        rating: b.rating,
        reviewCount: b.review_count,
        url: b.url,
      },
    })),
  };
}
