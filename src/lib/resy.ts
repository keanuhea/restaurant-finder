import { ReservationSlot, MealTime, MEAL_TIME_HOURS } from "./types";

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
  return { lat: 40.7580, long: -73.9855 };
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
  search: { hits: ResySearchHit[]; nbHits: number };
}

interface ResyFindSlot {
  config: { id: number; token: string; type: string };
  date: { start: string; end: string };
  quantity?: number;
}

interface ResyFindVenueEntry {
  venue: {
    id: { resy: number };
    name: string;
    url_slug: string;
    neighborhood?: string;
    location?: { code: string; neighborhood?: string };
    images?: string[];
    // /4/find returns cuisine as a single string on `type`, not an array
    type?: string;
    cuisine?: string[];
    price_range_id?: number;
  };
  slots: ResyFindSlot[];
}

interface ResyFindResponse {
  results?: { venues?: ResyFindVenueEntry[] };
}

export interface ResyVenueResult {
  venueId: number;
  name: string;
  neighborhood: string;
  cuisine: string;
  priceLevel: number;
  imageUrl: string;
  urlSlug: string;
  resyUrl: string;
  slots: ReservationSlot[];
}

const STOP_TOKENS = new Set(["the", "restaurant", "cafe", "bar", "and", "of", "at", "by"]);

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''´`]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(s: string): string[] {
  return normalizeForMatch(s)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_TOKENS.has(t));
}

function scoreNameMatch(searchName: string, hitName: string): number {
  const a = normalizeForMatch(searchName);
  const b = normalizeForMatch(hitName);
  if (!a || !b) return 0;
  if (a === b) return 1.0;

  // Substring both ways — but only trust it for names of reasonable length
  if (a.length >= 5 && b.includes(a)) return 0.95;
  if (b.length >= 5 && a.includes(b)) return 0.9;

  const tokensA = meaningfulTokens(searchName);
  const tokensB = meaningfulTokens(hitName);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let matches = 0;
  for (const t of tokensA) {
    if (tokensB.includes(t)) matches++;
  }
  const overlap = matches / Math.min(tokensA.length, tokensB.length);

  // Multi-word names need multiple matches — prevents "Joe's" -> "Joe Shanghai"
  if (tokensA.length >= 2 && tokensB.length >= 2 && matches < 2) return 0;

  return overlap;
}

function findBestNameMatch(
  searchName: string,
  hits: ResySearchHit[],
  cityCode: string,
  threshold: number = 0.75
): ResySearchHit | null {
  let best: { hit: ResySearchHit; score: number } | null = null;
  for (const hit of hits) {
    // City filter — Resy's search returns regional results, reject other cities
    if (hit.location?.code && hit.location.code !== cityCode) continue;
    const score = scoreNameMatch(searchName, hit.name);
    if (score >= threshold && (!best || score > best.score)) {
      best = { hit, score };
    }
  }
  return best?.hit || null;
}

function slotMatchesMealTime(hour: number, mealTime: MealTime): boolean {
  const { start, end } = MEAL_TIME_HOURS[mealTime];
  if (end < start) {
    // late_night crosses midnight
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

function parseSlotTime(dateStart: string): { hour: number; hhmm: string; display: string } {
  // Format: "2026-04-23 19:00:00"
  const timePart = dateStart.split(" ")[1] || dateStart.split("T")[1] || "";
  const [hStr, mStr] = timePart.split(":");
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const display = `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
  return { hour, hhmm, display };
}

function buildVenueUrl(cityCode: string, urlSlug: string, date: string, seats: number): string {
  return `https://resy.com/cities/${cityCode}/${urlSlug}?date=${date}&seats=${seats}`;
}

// Resy's /4/find endpoint rejects requests without browser-like headers.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  Origin: "https://resy.com",
  Referer: "https://resy.com/",
};

const readHeaders = {
  Authorization: `ResyAPI api_key="${RESY_API_KEY}"`,
  ...BROWSER_HEADERS,
};

const postHeaders = {
  Authorization: `ResyAPI api_key="${RESY_API_KEY}"`,
  "Content-Type": "application/json",
  ...BROWSER_HEADERS,
};

async function searchVenues(
  query: string,
  location: string,
  perPage: number = 10
): Promise<ResySearchHit[]> {
  try {
    const coords = getCoords(location);
    const res = await fetch(`${RESY_API_BASE}/3/venuesearch/search`, {
      method: "POST",
      headers: postHeaders,
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

async function fetchFindByVenue(
  venueId: number,
  date: string,
  partySize: number,
  coords: { lat: number; long: number }
): Promise<ResyFindVenueEntry[]> {
  try {
    const params = new URLSearchParams({
      lat: String(coords.lat),
      long: String(coords.long),
      day: date,
      party_size: String(partySize),
      venue_id: String(venueId),
    });
    const res = await fetch(`${RESY_API_BASE}/4/find?${params}`, {
      headers: readHeaders,
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data: ResyFindResponse = await res.json();
    return data.results?.venues || [];
  } catch (err) {
    console.error("Resy /4/find venue error:", err);
    return [];
  }
}

// Module-level cache — Resy's area response can be >200MB, which blows past Next.js's
// 2MB fetch cache limit. 60s TTL is enough to coalesce concurrent searches.
const areaCache = new Map<string, { ts: number; venues: ResyFindVenueEntry[] }>();
const AREA_CACHE_TTL_MS = 60_000;

async function fetchFindByArea(
  coords: { lat: number; long: number },
  date: string,
  partySize: number
): Promise<ResyFindVenueEntry[]> {
  const cacheKey = `${coords.lat},${coords.long}|${date}|${partySize}`;
  const cached = areaCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < AREA_CACHE_TTL_MS) {
    return cached.venues;
  }
  try {
    const params = new URLSearchParams({
      lat: String(coords.lat),
      long: String(coords.long),
      day: date,
      party_size: String(partySize),
    });
    const url = `${RESY_API_BASE}/4/find?${params}`;
    const res = await fetch(url, {
      headers: readHeaders,
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[resy] /4/find area failed: ${res.status} ${await res.text().catch(() => "")}`);
      return [];
    }
    const data: ResyFindResponse = await res.json();
    const venues = data.results?.venues || [];
    areaCache.set(cacheKey, { ts: Date.now(), venues });
    return venues;
  } catch (err) {
    console.error("Resy /4/find area error:", err);
    return [];
  }
}

function slotsFromFind(
  entry: ResyFindVenueEntry,
  cityCode: string,
  date: string,
  partySize: number,
  mealTime: MealTime
): ReservationSlot[] {
  const venueUrl = buildVenueUrl(cityCode, entry.venue.url_slug, date, partySize);
  const raw: { hhmm: string; display: string; type?: string }[] = [];
  for (const s of entry.slots || []) {
    if (!s?.date?.start) continue;
    const { hour, hhmm, display } = parseSlotTime(s.date.start);
    if (!slotMatchesMealTime(hour, mealTime)) continue;
    raw.push({ hhmm, display, type: s.config?.type });
  }
  // Dedupe by time — multiple configs (Bar, Dining Room) at the same time collapse to one
  const seen = new Set<string>();
  const deduped: ReservationSlot[] = [];
  for (const r of raw) {
    if (seen.has(r.hhmm)) continue;
    seen.add(r.hhmm);
    deduped.push({
      time: r.hhmm,
      displayTime: r.display,
      platform: "resy",
      url: venueUrl,
      configType: r.type,
    });
  }
  return deduped.sort((a, b) => a.time.localeCompare(b.time));
}

function venueEntryToResult(
  entry: ResyFindVenueEntry,
  cityCode: string,
  date: string,
  partySize: number,
  mealTime: MealTime,
  fallbackLocation: string
): ResyVenueResult | null {
  const slots = slotsFromFind(entry, cityCode, date, partySize, mealTime);
  if (slots.length === 0) return null;
  const v = entry.venue;
  const cuisine = v.type || v.cuisine?.join(", ") || "Restaurant";
  const neighborhood = v.neighborhood || v.location?.neighborhood || fallbackLocation;
  return {
    venueId: v.id.resy,
    name: v.name,
    neighborhood,
    cuisine,
    priceLevel: v.price_range_id || 2,
    imageUrl: v.images?.[0] || "",
    urlSlug: v.url_slug,
    resyUrl: buildVenueUrl(cityCode, v.url_slug, date, partySize),
    slots,
  };
}

/**
 * Walk the ranked name list and fetch actual Resy slots for each.
 * Falls back to area discovery if we don't find enough.
 */
export async function searchResyWithAvailability(
  restaurantNames: string[],
  location: string,
  date: string,
  mealTime: MealTime,
  partySize: number,
  minResults: number = 5
): Promise<Map<string, ResyVenueResult>> {
  const results = new Map<string, ResyVenueResult>();
  const coords = getCoords(location);
  const citySlug = locationToResyCity(location);
  const checkedVenueIds = new Set<number>();

  const batchSize = 3;
  for (let i = 0; i < restaurantNames.length; i += batchSize) {
    if (results.size >= minResults) break;

    const batch = restaurantNames.slice(i, i + batchSize);
    const searchResults = await Promise.all(
      batch.map((name) => searchVenues(name, location, 5))
    );

    const venueChecks: { name: string; hit: ResySearchHit }[] = [];
    for (let j = 0; j < batch.length; j++) {
      const match = findBestNameMatch(batch[j], searchResults[j], citySlug);
      if (match && !checkedVenueIds.has(match.id.resy)) {
        venueChecks.push({ name: batch[j], hit: match });
        checkedVenueIds.add(match.id.resy);
      }
    }

    const findResults = await Promise.all(
      venueChecks.map((vc) => fetchFindByVenue(vc.hit.id.resy, date, partySize, coords))
    );

    for (let j = 0; j < venueChecks.length; j++) {
      const entries = findResults[j];
      if (entries.length === 0) continue;
      const result = venueEntryToResult(entries[0], citySlug, date, partySize, mealTime, location);
      if (result) results.set(venueChecks[j].name, result);
    }
  }

  // Area discovery: fill remaining slots from venues that happen to have availability nearby
  if (results.size < minResults) {
    const areaEntries = await fetchFindByArea(coords, date, partySize);
    for (const entry of areaEntries) {
      if (results.size >= minResults) break;
      if (checkedVenueIds.has(entry.venue.id.resy)) continue;
      checkedVenueIds.add(entry.venue.id.resy);
      const result = venueEntryToResult(entry, citySlug, date, partySize, mealTime, location);
      if (result) results.set(`resy:${entry.venue.name}`, result);
    }
  }

  return results;
}
