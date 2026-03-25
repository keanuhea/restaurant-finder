import { chromium, Browser } from "playwright";
import { MichelinDistinction, MICHELIN_RATING_MAP } from "./types";

export interface MichelinEntry {
  name: string;
  distinction: MichelinDistinction;
  rating: number;
  url: string;
}

// Module-level cache: locationKey → { data, timestamp }
const cache = new Map<string, { data: Map<string, MichelinEntry>; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDistinction(text: string): MichelinDistinction | null {
  const lower = text.toLowerCase();
  if (lower.includes("three") || lower.includes("3 star") || lower.includes("3-star")) return "three-star";
  if (lower.includes("two") || lower.includes("2 star") || lower.includes("2-star")) return "two-star";
  if (lower.includes("one") || lower.includes("1 star") || lower.includes("1-star")) return "one-star";
  if (lower.includes("bib")) return "bib-gourmand";
  if (lower.includes("selected") || lower.includes("recommended")) return "selected";
  return null;
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

export async function searchMichelin(
  location: string
): Promise<Map<string, MichelinEntry>> {
  const cacheKey = normalizeForMatch(location);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const results = new Map<string, MichelinEntry>();

  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    const searchUrl = `https://guide.michelin.com/us/en/restaurants?q=${encodeURIComponent(location)}`;
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 15000 });

    // Wait for restaurant cards to load
    await page.waitForSelector("[data-testid='restaurant-card'], .card__menu, .card-restaurant, a[href*='/restaurant/']", {
      timeout: 8000,
    }).catch(() => {
      // Cards might not appear if no results
    });

    // Extract restaurant data from the page
    const restaurants = await page.evaluate(() => {
      const entries: { name: string; distinction: string; url: string }[] = [];

      // Try multiple selector strategies since Michelin's DOM may vary
      const cards = document.querySelectorAll(
        "[data-testid='restaurant-card'], .card__menu, .card-restaurant, .js-restaurant__list_item"
      );

      if (cards.length > 0) {
        cards.forEach((card) => {
          const nameEl =
            card.querySelector("h3, .card__menu-content--title, .card-title, [data-testid='restaurant-name']");
          const name = nameEl?.textContent?.trim() || "";

          const linkEl = card.querySelector("a[href*='/restaurant/']") || card.closest("a[href*='/restaurant/']");
          const url = linkEl?.getAttribute("href") || "";

          // Look for distinction indicators
          const distinctionEl = card.querySelector(
            ".distinction, .card__menu-content--distinction, [data-distinction], .michelin-award, img[alt*='star'], img[alt*='Bib'], .icon-michelin"
          );
          const distinction = distinctionEl
            ? (distinctionEl.getAttribute("alt") ||
               distinctionEl.getAttribute("data-distinction") ||
               distinctionEl.textContent?.trim() ||
               "selected")
            : "selected";

          if (name) {
            entries.push({
              name,
              distinction,
              url: url.startsWith("http") ? url : `https://guide.michelin.com${url}`,
            });
          }
        });
      }

      // Fallback: look for any links to restaurant pages
      if (entries.length === 0) {
        document.querySelectorAll("a[href*='/restaurant/']").forEach((link) => {
          const name = link.textContent?.trim() || "";
          const url = link.getAttribute("href") || "";
          if (name && name.length > 2 && name.length < 80) {
            entries.push({
              name,
              distinction: "selected",
              url: url.startsWith("http") ? url : `https://guide.michelin.com${url}`,
            });
          }
        });
      }

      return entries;
    });

    for (const r of restaurants) {
      const distinction = parseDistinction(r.distinction) || "selected";
      const key = normalizeForMatch(r.name);
      if (key && !results.has(key)) {
        results.set(key, {
          name: r.name,
          distinction,
          rating: MICHELIN_RATING_MAP[distinction],
          url: r.url,
        });
      }
    }

    await context.close();
  } catch (err) {
    console.error("Michelin scrape error:", err);
  }

  cache.set(cacheKey, { data: results, timestamp: Date.now() });
  return results;
}

export function lookupMichelin(
  restaurantName: string,
  michelinData: Map<string, MichelinEntry>
): MichelinEntry | null {
  const normalized = normalizeForMatch(restaurantName);

  // Exact match
  if (michelinData.has(normalized)) {
    return michelinData.get(normalized)!;
  }

  // Substring / fuzzy match
  for (const [key, entry] of michelinData) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return entry;
    }
    // Token overlap
    const tokensA = new Set(normalized.split(" ").filter((t) => t.length > 2));
    const tokensB = new Set(key.split(" ").filter((t) => t.length > 2));
    if (tokensA.size > 0 && tokensB.size > 0) {
      let matches = 0;
      for (const t of tokensA) if (tokensB.has(t)) matches++;
      if (matches / Math.min(tokensA.size, tokensB.size) >= 0.5) {
        return entry;
      }
    }
  }

  return null;
}
