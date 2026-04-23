/**
 * Shared date calculator for the next Interlinked live training session.
 *
 * Used by:
 *   - app/interlinked/page.tsx (client-side countdown timer)
 *   - app/interlinked/layout.tsx (server-side Event JSON-LD)
 *
 * Keeping one source of truth means the countdown UI and the Event
 * schema always announce the same startDate — if they drift, feed
 * readers / Google events panel / LLM retrievers would cite one date
 * while the page promises another.
 *
 * Pure function; no DOM or fetch. Works in both runtimes.
 *
 * Session cadence: three candidate slots per month —
 *   (a) 2nd Saturday @ 6:00 PM local
 *   (b) 11th @ 12:00 PM local
 *   (c) 28th @ 7:00 PM local
 * The next upcoming candidate wins. Walks forward up to six months
 * so we never return "today" if all three monthly slots have passed.
 *
 * Duration is fixed at 90 minutes (see SESSION_DURATION_MINUTES).
 */

export const SESSION_DURATION_MINUTES = 90;

function getSecondSaturday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const firstDayOfWeek = first.getDay();
  const firstSaturday = firstDayOfWeek <= 6 ? 6 - firstDayOfWeek + 1 : 1;
  const secondSaturday = firstSaturday + 7;
  return new Date(year, month, secondSaturday);
}

export function getNextSessionDate(): Date {
  const now = new Date();
  const candidates: Date[] = [];

  for (let offset = 0; offset < 6; offset++) {
    const monthOffset = now.getMonth() + offset;
    const month = monthOffset % 12;
    const y = now.getFullYear() + Math.floor(monthOffset / 12);

    const secondSat = getSecondSaturday(y, month);
    secondSat.setHours(18, 0, 0, 0);
    if (secondSat > now) candidates.push(secondSat);

    const eleventh = new Date(y, month, 11, 12, 0, 0, 0);
    if (eleventh > now) candidates.push(eleventh);

    const twentyEighth = new Date(y, month, 28, 19, 0, 0, 0);
    if (twentyEighth > now) candidates.push(twentyEighth);

    if (candidates.length > 0) break;
  }

  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] || new Date();
}
