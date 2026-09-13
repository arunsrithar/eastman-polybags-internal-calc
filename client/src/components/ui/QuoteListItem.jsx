import { fmt, formatDate } from "../../utils/format";

/**
 * QuoteListItem — a single row in the saved-quotes list.
 *
 * @param {Object}  quote     — quote object with quoteName, pricePerKg, savedAt, savedBy
 * @param {boolean} isActive  — whether this item is currently selected
 * @param {Function} onSelect — called when the item is clicked
 */
export default function QuoteListItem({
  quote,
  isActive,
  onSelect,
  formatPrice = (q) => "₹" + fmt(q.pricePerKg) + "/kg",
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`quote-list-item ${isActive ? "quote-list-item-active" : "hover:bg-fill"}`}
    >
      {/* Quote name + price */}
      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-sm font-medium truncate ${isActive ? "text-tint" : "text-label"}`}
        >
          {quote.quoteName}
        </span>
        <span className="text-xs font-semibold text-label-2 tabular-nums whitespace-nowrap">
          {formatPrice(quote)}
        </span>
      </div>

      {/* Quote ID badge */}
      {quote.quoteId && (
        <span className="inline-block text-[10px] font-mono font-semibold text-tint bg-tint/10 rounded px-1.5 py-0.5 mt-0.5">
          {quote.quoteId}
        </span>
      )}

      {/* Meta row: date + saved by */}
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[11px] text-label-3">
          {formatDate(quote.savedAt)}
        </span>
        {quote.savedBy ? (
          <>
            <span className="text-[11px] text-label-3">·</span>
            <span className="text-[11px] text-label-3">{quote.savedBy}</span>
          </>
        ) : null}
      </div>
    </button>
  );
}
