import { Restaurant, MealTime } from "./types";

const MOCK_RESTAURANTS: Restaurant[] = [
  {
    id: "mock-1",
    name: "Dhamaka",
    cuisine: "Indian",
    priceLevel: 3,
    address: "119 Delancey St, New York, NY 10002",
    neighborhood: "Lower East Side",
    imageUrl: "",
    reviews: [
      { platform: "yelp", rating: 4.5, reviewCount: 1823, url: "https://www.yelp.com/biz/dhamaka-new-york" },
      { platform: "google", rating: 4.6, reviewCount: 3241, url: "https://maps.google.com/?q=Dhamaka+119+Delancey+St+New+York" },
    ],
    aggregateRating: 0,
    totalReviewCount: 5064,
    reservations: [],
  },
  {
    id: "mock-2",
    name: "Katz's Delicatessen",
    cuisine: "Deli, Sandwiches",
    priceLevel: 2,
    address: "205 E Houston St, New York, NY 10002",
    neighborhood: "Lower East Side",
    imageUrl: "",
    reviews: [
      { platform: "yelp", rating: 4.0, reviewCount: 12450, url: "https://www.yelp.com/biz/katzs-delicatessen-new-york" },
      { platform: "google", rating: 4.5, reviewCount: 45000, url: "https://maps.google.com/?q=Katz's+Delicatessen+New+York" },
    ],
    aggregateRating: 0,
    totalReviewCount: 57450,
    reservations: [],
  },
  {
    id: "mock-3",
    name: "Thai Diner",
    cuisine: "Thai, American",
    priceLevel: 2,
    address: "186 Mott St, New York, NY 10012",
    neighborhood: "Nolita",
    imageUrl: "",
    reviews: [
      { platform: "yelp", rating: 4.3, reviewCount: 890, url: "https://www.yelp.com/biz/thai-diner-new-york" },
      { platform: "google", rating: 4.4, reviewCount: 2100, url: "https://maps.google.com/?q=Thai+Diner+186+Mott+St+New+York" },
    ],
    aggregateRating: 0,
    totalReviewCount: 2990,
    reservations: [],
  },
  {
    id: "mock-4",
    name: "Tatiana by Kwame Onwuachi",
    cuisine: "American, Caribbean",
    priceLevel: 4,
    address: "10 Lincoln Center Plaza, New York, NY 10023",
    neighborhood: "Upper West Side",
    imageUrl: "",
    reviews: [
      { platform: "yelp", rating: 4.7, reviewCount: 560, url: "https://www.yelp.com/biz/tatiana-by-kwame-onwuachi-new-york" },
      { platform: "google", rating: 4.8, reviewCount: 1200, url: "https://maps.google.com/?q=Tatiana+by+Kwame+Onwuachi+New+York" },
    ],
    aggregateRating: 0,
    totalReviewCount: 1760,
    reservations: [],
  },
  {
    id: "mock-5",
    name: "Los Tacos No. 1",
    cuisine: "Mexican, Tacos",
    priceLevel: 1,
    address: "75 9th Ave, New York, NY 10011",
    neighborhood: "Chelsea",
    imageUrl: "",
    reviews: [
      { platform: "yelp", rating: 4.4, reviewCount: 5600, url: "https://www.yelp.com/biz/los-tacos-no-1-new-york" },
      { platform: "google", rating: 4.6, reviewCount: 15000, url: "https://maps.google.com/?q=Los+Tacos+No+1+Chelsea+New+York" },
    ],
    aggregateRating: 0,
    totalReviewCount: 20600,
    reservations: [],
  },
  {
    id: "mock-6",
    name: "Atomix",
    cuisine: "Korean Tasting Menu",
    priceLevel: 4,
    address: "104 E 30th St, New York, NY 10016",
    neighborhood: "NoMad",
    imageUrl: "",
    reviews: [
      { platform: "yelp", rating: 4.8, reviewCount: 320, url: "https://www.yelp.com/biz/atomix-new-york" },
      { platform: "google", rating: 4.9, reviewCount: 890, url: "https://maps.google.com/?q=Atomix+104+E+30th+St+New+York" },
    ],
    aggregateRating: 0,
    totalReviewCount: 1210,
    reservations: [],
  },
  {
    id: "mock-7",
    name: "Lucien",
    cuisine: "French Bistro",
    priceLevel: 3,
    address: "14 1st Ave, New York, NY 10009",
    neighborhood: "East Village",
    imageUrl: "",
    reviews: [
      { platform: "yelp", rating: 4.2, reviewCount: 980, url: "https://www.yelp.com/biz/lucien-new-york" },
      { platform: "google", rating: 4.4, reviewCount: 2300, url: "https://maps.google.com/?q=Lucien+14+1st+Ave+New+York" },
    ],
    aggregateRating: 0,
    totalReviewCount: 3280,
    reservations: [],
  },
  {
    id: "mock-8",
    name: "Russ & Daughters Cafe",
    cuisine: "Jewish, Brunch",
    priceLevel: 2,
    address: "127 Orchard St, New York, NY 10002",
    neighborhood: "Lower East Side",
    imageUrl: "",
    reviews: [
      { platform: "yelp", rating: 4.3, reviewCount: 3200, url: "https://www.yelp.com/biz/russ-and-daughters-cafe-new-york" },
      { platform: "google", rating: 4.5, reviewCount: 7600, url: "https://maps.google.com/?q=Russ+%26+Daughters+Cafe+New+York" },
    ],
    aggregateRating: 0,
    totalReviewCount: 10800,
    reservations: [],
  },
];

export function getMockRestaurants(
  location: string,
  mealTime: MealTime
): Restaurant[] {
  const locationLower = location.toLowerCase();

  return MOCK_RESTAURANTS.filter((r) => {
    const matchesLocation =
      !locationLower ||
      r.neighborhood.toLowerCase().includes(locationLower) ||
      r.address.toLowerCase().includes(locationLower) ||
      locationLower.includes("new york") ||
      locationLower.includes("nyc") ||
      locationLower.includes("manhattan");

    return matchesLocation;
  }).map((r) => ({ ...r, reservations: [] }));
}
