import { ReviewSource } from "./types";

interface GooglePlace {
  id: string;
  displayName: { text: string };
  rating: number;
  userRatingCount: number;
  googleMapsUri: string;
  formattedAddress: string;
  primaryTypeDisplayName?: { text: string };
  priceLevel?:
    | "PRICE_LEVEL_FREE"
    | "PRICE_LEVEL_INEXPENSIVE"
    | "PRICE_LEVEL_MODERATE"
    | "PRICE_LEVEL_EXPENSIVE"
    | "PRICE_LEVEL_VERY_EXPENSIVE";
  photos?: { name: string }[];
}

interface GoogleSearchResponse {
  places: GooglePlace[];
}

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export async function searchGooglePlaces(
  location: string
): Promise<{
  restaurants: {
    id: string;
    name: string;
    cuisine: string;
    priceLevel: number;
    address: string;
    imageUrl?: string;
    review: ReviewSource;
  }[];
}> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { restaurants: [] };

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.formattedAddress,places.primaryTypeDisplayName,places.priceLevel,places.photos",
      },
      body: JSON.stringify({
        textQuery: `best restaurants in ${location}`,
        maxResultCount: 20,
      }),
      next: { revalidate: 300 },
    }
  );

  if (!res.ok) {
    console.error("Google Places API error:", res.status, await res.text());
    return { restaurants: [] };
  }

  const data: GoogleSearchResponse = await res.json();

  return {
    restaurants: (data.places || []).map((p) => ({
      id: `google-${p.id}`,
      name: p.displayName.text,
      cuisine: p.primaryTypeDisplayName?.text || "Restaurant",
      priceLevel: p.priceLevel ? PRICE_MAP[p.priceLevel] || 2 : 2,
      address: p.formattedAddress,
      imageUrl: p.photos?.[0]
        ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxHeightPx=400&key=${apiKey}`
        : undefined,
      review: {
        platform: "google" as const,
        rating: p.rating || 0,
        reviewCount: p.userRatingCount || 0,
        url: p.googleMapsUri,
      },
    })),
  };
}
