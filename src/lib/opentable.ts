import { MealTime, MEAL_TIME_HOURS } from "./types";

/**
 * Build a deep-link to OpenTable's search page for a given restaurant name,
 * date, meal time, and party size. OpenTable aggressively blocks automated
 * availability checks (Akamai Bot Manager), so we fall back to funnelling
 * the user to their search page rather than verifying availability ourselves.
 */
export function buildOpenTableSearchUrl(
  restaurantName: string,
  date: string,
  mealTime: MealTime,
  partySize: number
): string {
  const startHour = MEAL_TIME_HOURS[mealTime].start;
  const hh = String(startHour).padStart(2, "0");
  const dateTime = `${date}T${hh}:00:00`;
  const params = new URLSearchParams({
    term: restaurantName,
    dateTime,
    covers: String(partySize),
  });
  return `https://www.opentable.com/s?${params}`;
}
