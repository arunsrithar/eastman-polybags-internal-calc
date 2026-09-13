import { useState, useEffect, useCallback } from "react";
import CalculatorHeader from "../layout/CalculatorHeader";
import { SearchIcon } from "../ui/Icons";
import { getQuotes, deleteQuote } from "../../utils/quoteStorage";
import { groupByMonth } from "../../utils/format";
import QuoteListItem from "../ui/QuoteListItem";
import { useToast } from "../ui/Toast";

/**
 * SavedQuotesView — shared 2-column saved-quotes layout.
 *
 * Fetches quotes asynchronously (server- or localStorage-backed depending on
 * calcKey). Renders search + grouped quote list (left) and a calculator-
 * specific breakdown card (right).
 *
 * @param {string}    calcKey         — quote storage key ("gravure", "flexo-rate-calc", "job-cost")
 * @param {Component} icon            — calculator icon component
 * @param {string}    title           — page title
 * @param {Function}  calculateRate   — pure calculation function (form → result | null)
 * @param {Component} ResultComponent — breakdown card component
 * @param {Component} [PrintComponent] — optional print layout component (hidden on screen, shown on print)
 */
export default function SavedQuotesView({
  calcKey,
  icon,
  title,
  calculateRate,
  ResultComponent,
  PrintComponent,
  formatPrice,
}) {
  const [quotes, setQuotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, showToast] = useToast();

  const refetch = useCallback(async () => {
    try {
      const list = await getQuotes(calcKey);
      setQuotes(list);
      setError(null);
    } catch {
      setError("Couldn't load saved quotes. Check your connection.");
    }
  }, [calcKey]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- need to reset loading flag on calcKey change before async fetch
    setLoading(true);
    getQuotes(calcKey)
      .then((list) => {
        if (cancelled) return;
        setQuotes(list);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load saved quotes. Check your connection.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [calcKey]);

  // Cross-component sync (save / delete elsewhere triggers refetch).
  useEffect(() => {
    function handleUpdate(e) {
      if (e.detail === calcKey) refetch();
    }
    window.addEventListener("quotes-updated", handleUpdate);
    return () => window.removeEventListener("quotes-updated", handleUpdate);
  }, [calcKey, refetch]);

  const selectedQuote = selectedId
    ? quotes.find((q) => q.id === selectedId)
    : null;

  async function handleDelete() {
    if (!selectedQuote) return;
    const name = selectedQuote.quoteName;
    const idx = quotes.findIndex((q) => q.id === selectedId);
    const previous = quotes;

    // Optimistic remove
    const optimistic = quotes.filter((q) => q.id !== selectedId);
    const nextId =
      optimistic.length > 0
        ? (optimistic[Math.min(idx, optimistic.length - 1)]?.id ?? null)
        : null;
    setQuotes(optimistic);
    setSelectedId(nextId);

    try {
      await deleteQuote(calcKey, selectedId);
      window.dispatchEvent(
        new CustomEvent("quotes-updated", { detail: calcKey }),
      );
      showToast(name, "Deleted from saved quotes");
    } catch {
      // Roll back
      setQuotes(previous);
      setSelectedId(selectedId);
      showToast(name, "Couldn't delete — try again.");
    }
  }

  const filtered = search.trim()
    ? quotes.filter((q) => {
        const s = search.trim().toLowerCase();
        return (
          q.quoteName.toLowerCase().includes(s) ||
          (q.quoteId && q.quoteId.toLowerCase().includes(s))
        );
      })
    : quotes;

  const groups = groupByMonth(filtered);

  const selectedResult = selectedQuote
    ? calculateRate(selectedQuote.form)
    : null;

  return (
    <div className="calc-shell">
      {toast}
      <CalculatorHeader
        icon={icon}
        title={title}
        subtitle={`${quotes.length} saved quote${quotes.length !== 1 ? "s" : ""}`}
        onPrint={selectedQuote ? () => window.print() : null}
        onExport={selectedQuote ? () => {} : null}
        onDelete={selectedQuote ? handleDelete : null}
      />

      {/* 2-column layout: quote list | breakdown */}
      <div className="calc-grid">
        {/* Left — Quote list */}
        <div className="flex flex-col glass-panel min-h-0">
          <div className="shrink-0 p-3 pb-0">
            <div className="mb-3 relative">
              <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-label-3 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search quotes…"
                className="input-base text-sm pl-9 rounded-full"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loading ? (
              <p className="text-label-2 text-sm px-1 py-4">
                Loading saved quotes…
              </p>
            ) : error ? (
              <p className="text-red-500 text-sm px-1 py-4">{error}</p>
            ) : groups.length === 0 ? (
              <p className="text-label-2 text-sm px-1 py-4">
                No saved quotes yet.
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.label} className="mb-4 last:mb-0">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="month-label">{group.label}</span>
                    <div className="flex-1 h-px bg-separator" />
                  </div>
                  <div>
                    {group.items.map((q) => (
                      <QuoteListItem
                        key={q.id}
                        quote={q}
                        isActive={selectedId === q.id}
                        onSelect={() => setSelectedId(q.id)}
                        formatPrice={formatPrice}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right — Breakdown */}
        <div className="calc-column" data-print-area>
          <div className={PrintComponent ? "print:hidden" : undefined}>
            <ResultComponent
              result={selectedResult}
              form={selectedQuote?.form ?? null}
              status="Saved"
              date={selectedQuote?.savedAt}
            />
          </div>
          {PrintComponent ? (
            <PrintComponent
              result={selectedResult}
              form={selectedQuote?.form ?? null}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
