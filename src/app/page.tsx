"use client";

import { useState, useCallback } from "react";
import { Restaurant, MealTime, RatingPlatform, MichelinDistinction } from "@/lib/types";
import { buildOpenTableSearchUrl } from "@/lib/opentable";

const MEAL_TIMES: { value: MealTime; label: string; emoji: string }[] = [
  { value: "breakfast", label: "Breakfast", emoji: "☕" },
  { value: "brunch", label: "Brunch", emoji: "🥂" },
  { value: "lunch", label: "Lunch", emoji: "🍜" },
  { value: "dinner", label: "Dinner", emoji: "🍷" },
  { value: "late_night", label: "Late Night", emoji: "🌙" },
];

const SOURCE_INFO: Record<RatingPlatform, { emoji: string; label: string }> = {
  michelin: { emoji: "🏅", label: "Michelin" },
  google: { emoji: "🔵", label: "Google" },
  yelp: { emoji: "🔴", label: "Yelp" },
};

// Ombre: position-based colors — gold → orange → red
const POSITION_COLORS = [
  "border-amber-500/60 bg-amber-950/50 text-amber-300 shadow-lg shadow-amber-900/20",   // #1 gold
  "border-orange-500/50 bg-orange-950/40 text-orange-300 shadow-lg shadow-orange-900/20", // #2 orange
  "border-red-500/40 bg-red-950/30 text-red-400 shadow-lg shadow-red-900/20",             // #3 red
];

const MICHELIN_BADGES: Record<MichelinDistinction, { label: string; classes: string }> = {
  "three-star": { label: "⭐⭐⭐", classes: "bg-red-950/60 text-red-300 border-red-700/50" },
  "two-star": { label: "⭐⭐", classes: "bg-red-950/60 text-red-300 border-red-700/50" },
  "one-star": { label: "⭐", classes: "bg-red-950/60 text-red-300 border-red-700/50" },
  "bib-gourmand": { label: "🟢 Bib", classes: "bg-emerald-950/60 text-emerald-300 border-emerald-700/50" },
  "selected": { label: "🏅", classes: "bg-amber-950/60 text-amber-300 border-amber-700/50" },
};

function SourcePriorityPicker({
  sources,
  onChange,
}: {
  sources: RatingPlatform[];
  onChange: (sources: RatingPlatform[]) => void;
}) {
  const moveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const next = [...sources];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      onChange(next);
    },
    [sources, onChange]
  );

  const moveDown = useCallback(
    (index: number) => {
      if (index === sources.length - 1) return;
      const next = [...sources];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      onChange(next);
    },
    [sources, onChange]
  );

  const weights = ["50%", "35%", "15%"];

  return (
    <div>
      <label className="block text-sm font-semibold text-stone-400 mb-2 tracking-wide">
        Rating priority (drag to reorder)
      </label>
      <div className="space-y-2">
        {sources.map((source, i) => {
          const info = SOURCE_INFO[source];
          return (
            <div
              key={source}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${POSITION_COLORS[i]}`}
            >
              <span className="text-xs font-mono w-5 text-right opacity-60">
                {i + 1}.
              </span>
              <span className="text-lg">{info.emoji}</span>
              <span className="font-semibold flex-1">{info.label}</span>
              <span className="text-xs text-stone-600 font-mono">{weights[i]}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="p-1 rounded-lg hover:bg-white/5 disabled:opacity-20 transition-opacity text-stone-500 hover:text-stone-300"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === sources.length - 1}
                  className="p-1 rounded-lg hover:bg-white/5 disabled:opacity-20 transition-opacity text-stone-500 hover:text-stone-300"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const glow =
    rating >= 4.5
      ? "shadow-amber-500/30"
      : rating >= 4.0
        ? "shadow-rose-500/20"
        : "shadow-gray-500/10";
  return (
    <div
      className={`bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-800/40 text-white rounded-2xl px-3.5 py-2.5 text-center shadow-lg ${glow}`}
    >
      <div className="text-2xl font-extrabold leading-none text-amber-400">
        {rating.toFixed(1)}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-stone-500 mt-1 font-semibold">
        score
      </div>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const config: Record<string, { emoji: string; classes: string }> = {
    yelp: { emoji: "🔴", classes: "bg-red-950/50 border-red-800/30 text-red-300" },
    google: { emoji: "🔵", classes: "bg-blue-950/50 border-blue-800/30 text-blue-300" },
    resy: { emoji: "✨", classes: "bg-purple-950/50 border-purple-800/30 text-purple-300" },
    michelin: { emoji: "🏅", classes: "bg-amber-950/50 border-amber-700/30 text-amber-300" },
  };
  const c = config[platform] || { emoji: "📍", classes: "bg-stone-800 border-stone-700 text-stone-400" };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${c.classes}`}>
      {c.emoji} {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25;
  return (
    <span className="text-sm tracking-tight">
      <span className="text-amber-500">{"★".repeat(full)}</span>
      {hasHalf && <span className="text-amber-600">★</span>}
      <span className="text-stone-700">{"★".repeat(5 - full - (hasHalf ? 1 : 0))}</span>
    </span>
  );
}

function MichelinBadge({ distinction }: { distinction: MichelinDistinction }) {
  const badge = MICHELIN_BADGES[distinction];
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badge.classes}`}>
      {badge.label} Michelin
    </span>
  );
}

interface SearchContext {
  date: string;
  mealTime: MealTime;
  partySize: number;
}

function RestaurantCard({
  restaurant,
  rank,
  searchContext,
}: {
  restaurant: Restaurant;
  rank: number;
  searchContext: SearchContext;
}) {
  const otUrl = buildOpenTableSearchUrl(
    restaurant.name,
    searchContext.date,
    searchContext.mealTime,
    searchContext.partySize
  );
  return (
    <div className="group bg-gradient-to-br from-stone-900 to-stone-950 rounded-2xl border border-stone-800 overflow-hidden hover:border-rose-900/60 hover:shadow-2xl hover:shadow-rose-950/30 transition-all duration-500">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4">
            <span className="text-3xl font-black text-rose-900/60 leading-none mt-1 tabular-nums">
              {String(rank).padStart(2, "0")}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg text-stone-100 group-hover:text-rose-300 transition-colors">
                  {restaurant.name}
                </h3>
                {restaurant.michelinDistinction && (
                  <MichelinBadge distinction={restaurant.michelinDistinction} />
                )}
              </div>
              <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-1">
                {restaurant.cuisine}
                <span className="text-stone-700 mx-1">·</span>
                <span className="text-amber-700 font-semibold">
                  {"$".repeat(restaurant.priceLevel)}
                </span>
                <span className="text-stone-800">
                  {"$".repeat(4 - restaurant.priceLevel)}
                </span>
              </p>
            </div>
          </div>
          {restaurant.reviews.length > 0 && (
            <RatingBadge rating={restaurant.aggregateRating} />
          )}
        </div>

        <p className="text-sm text-stone-600 mb-4 pl-[52px]">
          {restaurant.address}
        </p>

        {/* Review sources */}
        <div className="flex flex-wrap gap-3 mb-5 pl-[52px]">
          {restaurant.reviews.map((review) => (
            <a
              key={review.platform}
              href={review.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <PlatformBadge platform={review.platform} />
              <StarRating rating={review.rating} />
              {review.reviewCount > 0 && (
                <span className="text-stone-600 text-xs">
                  {review.reviewCount.toLocaleString()}
                </span>
              )}
            </a>
          ))}
        </div>

        {/* Reservations */}
        {restaurant.reservations.length > 0 ? (
          <div className="pl-[52px]">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-3">
              <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
              {restaurant.reservations.length} {restaurant.reservations.length === 1 ? "slot" : "slots"} on Resy
            </p>
            <div className="flex flex-wrap gap-2">
              {restaurant.reservations.slice(0, 8).map((slot, i) => (
                <a
                  key={`${slot.time}-${i}`}
                  href={slot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={slot.configType ? `${slot.displayTime} · ${slot.configType}` : slot.displayTime}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-950/40 text-emerald-400 rounded-xl text-sm font-semibold hover:bg-emerald-900/50 transition-all border border-emerald-800/30 hover:border-emerald-700/50 hover:shadow-lg hover:shadow-emerald-950/20"
                >
                  {slot.displayTime}
                </a>
              ))}
              {restaurant.reservations.length > 8 && (
                <a
                  href={restaurant.reservations[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-stone-900 text-stone-400 rounded-xl text-sm font-semibold hover:bg-stone-800 transition-all border border-stone-800"
                >
                  +{restaurant.reservations.length - 8} more →
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="pl-[52px]">
            <p className="text-[11px] font-bold text-stone-600 uppercase tracking-widest mb-3">
              Not on Resy
            </p>
            <a
              href={otUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-stone-300 rounded-xl text-sm font-semibold hover:bg-stone-800 transition-all border border-stone-800 hover:border-stone-700"
            >
              Check OpenTable →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [mealTime, setMealTime] = useState<MealTime>("dinner");
  const [partySize, setPartySize] = useState(2);
  const [sourceOrder, setSourceOrder] = useState<RatingPlatform[]>([
    "michelin",
    "google",
    "yelp",
  ]);
  const [priceRange, setPriceRange] = useState<[number, number]>([1, 4]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        location: location.trim(),
        date,
        mealTime,
        sources: sourceOrder.join(","),
        priceMin: String(priceRange[0]),
        priceMax: String(priceRange[1]),
        partySize: String(partySize),
      });
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      setRestaurants(data.restaurants || []);
      setUsingMockData(data.usingMockData || false);
    } catch {
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }

  const withReservations = restaurants.filter((r) => r.reservations.length > 0);
  const withoutReservations = restaurants.filter((r) => r.reservations.length === 0);

  let rank = 0;

  return (
    <main className="min-h-screen bg-stone-950">
      <div className="fixed inset-0 bg-gradient-to-b from-rose-950/20 via-transparent to-stone-950 pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <div className="border-b border-stone-800/60 bg-stone-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-black tracking-tight text-stone-100">
              🍴{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-rose-500 to-amber-500">
                TableScore
              </span>
            </h1>
            <p className="text-stone-600 text-sm mt-1 tracking-wide">
              Ratings aggregated · Reservations found · Decisions made
            </p>
          </div>
        </div>

        {/* Search form */}
        <div className="max-w-3xl mx-auto px-4 py-10">
          <form
            onSubmit={handleSearch}
            className="bg-stone-900/80 backdrop-blur rounded-3xl border border-stone-800 p-7 space-y-5 shadow-2xl shadow-stone-950"
          >
            <div>
              <label
                htmlFor="location"
                className="block text-sm font-semibold text-stone-400 mb-2 tracking-wide"
              >
                Where are you eating?
              </label>
              <input
                id="location"
                type="text"
                placeholder="Lower East Side, Manhattan"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-stone-950 border border-stone-700 focus:ring-2 focus:ring-rose-800 focus:border-rose-700 text-stone-100 placeholder-stone-700 text-lg transition-all"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="date"
                  className="block text-sm font-semibold text-stone-400 mb-2 tracking-wide"
                >
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-stone-950 border border-stone-700 focus:ring-2 focus:ring-rose-800 focus:border-rose-700 text-stone-100 transition-all [color-scheme:dark]"
                />
              </div>
              <div>
                <label
                  htmlFor="mealTime"
                  className="block text-sm font-semibold text-stone-400 mb-2 tracking-wide"
                >
                  Meal
                </label>
                <select
                  id="mealTime"
                  value={mealTime}
                  onChange={(e) => setMealTime(e.target.value as MealTime)}
                  className="w-full px-5 py-4 rounded-xl bg-stone-950 border border-stone-700 focus:ring-2 focus:ring-rose-800 focus:border-rose-700 text-stone-100 transition-all"
                >
                  {MEAL_TIMES.map((mt) => (
                    <option key={mt.value} value={mt.value}>
                      {mt.emoji} {mt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="partySize"
                  className="block text-sm font-semibold text-stone-400 mb-2 tracking-wide"
                >
                  Party
                </label>
                <select
                  id="partySize"
                  value={partySize}
                  onChange={(e) => setPartySize(parseInt(e.target.value, 10))}
                  className="w-full px-5 py-4 rounded-xl bg-stone-950 border border-stone-700 focus:ring-2 focus:ring-rose-800 focus:border-rose-700 text-stone-100 transition-all"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "1 person" : `${n} people`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Source priority picker */}
            <SourcePriorityPicker
              sources={sourceOrder}
              onChange={setSourceOrder}
            />

            {/* Price range filter */}
            <div>
              <label className="block text-sm font-semibold text-stone-400 mb-2 tracking-wide">
                Price range
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((level) => {
                  const isActive = level >= priceRange[0] && level <= priceRange[1];
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        // Toggle logic: click to set as min or max
                        if (priceRange[0] === level && priceRange[1] === level) {
                          // Already solo selected — reset to all
                          setPriceRange([1, 4]);
                        } else if (level < priceRange[0]) {
                          setPriceRange([level, priceRange[1]]);
                        } else if (level > priceRange[1]) {
                          setPriceRange([priceRange[0], level]);
                        } else {
                          // Click within range — narrow to just this level
                          setPriceRange([level, level]);
                        }
                      }}
                      className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${
                        isActive
                          ? "border-rose-600/50 bg-rose-950/50 text-rose-300 shadow-lg shadow-rose-950/20"
                          : "border-stone-800 bg-stone-950 text-stone-700 hover:border-stone-700"
                      }`}
                    >
                      {"$".repeat(level)}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !location.trim()}
              className="w-full py-4 px-6 bg-gradient-to-r from-rose-800 to-rose-900 text-rose-100 font-bold text-lg rounded-xl hover:from-rose-700 hover:to-rose-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-rose-950/60 hover:shadow-xl hover:shadow-rose-900/40 active:scale-[0.98] border border-rose-700/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">◌</span> Searching...
                </span>
              ) : (
                "Find me a table"
              )}
            </button>
          </form>

          {/* Mock data notice */}
          {usingMockData && searched && (
            <div className="mt-6 p-4 bg-amber-950/30 border border-amber-800/30 rounded-2xl text-sm text-amber-500/80 flex items-start gap-3">
              <span className="text-lg">🧪</span>
              <span>
                Restaurant data is demo — add Yelp & Google API keys to{" "}
                <code className="bg-amber-950/50 px-1.5 py-0.5 rounded-lg font-mono text-xs text-amber-400">
                  .env.local
                </code>{" "}
                for real listings. Michelin & Resy data is live.
              </span>
            </div>
          )}

          {/* Results */}
          {searched && !loading && (
            <div className="mt-10 space-y-10">
              {restaurants.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-5xl mb-4 opacity-40">🍷</p>
                  <p className="text-stone-600 text-lg">
                    Nothing found. Try a different neighborhood, date, or price range.
                  </p>
                </div>
              ) : (
                <>
                  {withReservations.length > 0 && (
                    <section>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-900/40 to-transparent" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-600 shrink-0">
                          ● {withReservations.length} with open tables
                        </h2>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-900/40 to-transparent" />
                      </div>
                      <div className="space-y-4">
                        {withReservations.map((r) => (
                          <RestaurantCard
                            key={r.id}
                            restaurant={r}
                            rank={++rank}
                            searchContext={{ date, mealTime, partySize }}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {withoutReservations.length > 0 && (
                    <section>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-800 to-transparent" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-stone-600 shrink-0">
                          🏆 {withoutReservations.length} top rated — no reservations found
                        </h2>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-800 to-transparent" />
                      </div>
                      <div className="space-y-4">
                        {withoutReservations.map((r) => (
                          <RestaurantCard
                            key={r.id}
                            restaurant={r}
                            rank={++rank}
                            searchContext={{ date, mealTime, partySize }}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
