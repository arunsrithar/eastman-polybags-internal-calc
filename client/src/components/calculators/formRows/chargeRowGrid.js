/**
 * Shared column track for charge rows so every row in a card lines up, and a
 * card's column-header labels line up with the rows beneath them.
 *
 * The "from" connector column is opt-out: screens that label their columns
 * with a header row pass connector={null} and get the tighter 3-column track.
 */
/**
 * Track for the Flexo Job Cost processing table, where every charge is a row
 * rather than its own card: Process | Detail | Supplier | Rate.
 */
export const PROCESS_TABLE_GRID =
  "grid-cols-[3.5fr_1.5fr_2fr_1.5fr]";

/**
 * Same track without the Rate column, for screens where the calc resolves
 * every rate itself (Flexo Rate Calculator) rather than storing an editable
 * price in form state — showing a column of dashes there isn't worth the width.
 */
export const PROCESS_TABLE_GRID_NO_RATE = "grid-cols-[3.5fr_2fr_3fr]";

export function chargeRowGrid(hasConnector, hasPrice, hasQty = false) {
  if (hasConnector) {
    return hasPrice
      ? "grid-cols-[16rem_4.5rem_minmax(0,1fr)_10rem]"
      : "grid-cols-[16rem_4.5rem_minmax(0,1fr)]";
  }
  if (hasQty) {
    return hasPrice
      ? "grid-cols-[16rem_7rem_minmax(0,1fr)_10rem]"
      : "grid-cols-[16rem_7rem_minmax(0,1fr)]";
  }
  return hasPrice
    ? "grid-cols-[16rem_minmax(0,1fr)_10rem]"
    : "grid-cols-[16rem_minmax(0,1fr)]";
}
