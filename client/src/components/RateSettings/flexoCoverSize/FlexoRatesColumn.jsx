import IOSToggle from "../../ui/IOSToggle";
import { PRINTING_COL_KEYS } from "../flexoSettingsConfig";

function PriceInput({ value, disabled, onChange, onCommit }) {
  return (
    <div
      className={`flex items-center input-base p-0 overflow-hidden min-w-0 w-36 shrink ${disabled ? "opacity-50" : ""}`}
    >
      <span className="px-2.5 text-label-3 text-sm border-r border-separator shrink-0 select-none">
        ₹
      </span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onCommit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        disabled={disabled}
        className="flex-1 bg-transparent px-2 py-2 text-sm text-left outline-none input-no-spinner w-0 tabular-nums"
      />
      <span className="px-2 text-label-3 text-xs shrink-0">per kg</span>
    </div>
  );
}

function PrintingMatrix({
  printingRates,
  rateDrafts,
  canEdit,
  onChangeDraft,
  onCommitDraft,
}) {
  const chunks = [printingRates.slice(0, 4), printingRates.slice(4, 8)];

  return (
    <div className="rounded-lg border border-separator overflow-hidden">
      {chunks.map((chunk, chunkIndex) => (
        <div
          key={chunkIndex}
          className={chunkIndex > 0 ? "border-t border-separator" : ""}
        >
          <div className="grid grid-cols-4">
            {chunk.map((rate, cellIndex) => (
              <div
                key={rate.key}
                className={`text-center text-xs text-label-3 py-1 border-b border-separator ${
                  cellIndex < chunk.length - 1
                    ? "border-r border-separator"
                    : ""
                }`}
              >
                {rate.colorCount}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 bg-tint/10">
            {chunk.map((rate, cellIndex) => {
              const value =
                rateDrafts[rate.key] ?? String(rate.cell?.price ?? 0);
              const hasValue = Number(value) > 0;
              return (
                <input
                  key={rate.key}
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(event) =>
                    onChangeDraft(rate.key, event.target.value)
                  }
                  onBlur={(event) =>
                    onCommitDraft(rate.key, rate.patch, event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                  disabled={!canEdit}
                  aria-label={`${rate.colorCount} colour price per kg`}
                  className={`h-11 text-center text-sm bg-transparent outline-none input-no-spinner tabular-nums ${
                    cellIndex < chunk.length - 1
                      ? "border-r border-separator"
                      : ""
                  } ${hasValue ? "text-label font-medium" : "text-label-3"}`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FlexoRatesColumn({
  selectedCoverSize,
  selectedCompanyName,
  selectedSizeLabel,
  canEdit,
  rateDrafts,
  onChangeDraft,
  onCommitDraft,
  onToggleRate,
}) {
  const singleRates = selectedCoverSize
    ? [
        {
          key: "gusset",
          label: "Gusset",
          cell: selectedCoverSize.gussetRate,
          patch: { category: "gusset" },
        },
        {
          key: "cutting",
          label: "Cutting",
          cell: selectedCoverSize.cuttingRate,
          patch: { category: "cutting" },
        },
      ]
    : [];

  const printingRates = selectedCoverSize
    ? PRINTING_COL_KEYS.map((colorCount) => ({
        key: `printing:${colorCount}`,
        colorCount,
        cell: selectedCoverSize.printingColors?.[colorCount],
        patch: { category: "printing", colorCount },
      }))
    : [];

  function draftValue(rate) {
    return rateDrafts[rate.key] ?? String(rate.cell?.price ?? 0);
  }

  return (
    <section className="card overflow-hidden min-h-[22rem] flex flex-col">
      <div className="card-section border-b border-separator flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-label">Rates</p>
        <p className="text-xs text-label-3 truncate">
          {selectedCoverSize
            ? `${selectedSizeLabel || selectedCoverSize.coverSize}${selectedCompanyName ? ` · ${selectedCompanyName}` : ""}`
            : "Select a company"}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {!selectedCoverSize ? (
          <div className="card-section text-sm text-label-3">
            Pick a cover size and company to edit rates
          </div>
        ) : (
          <>
            {singleRates.map((rate) => {
              const isAvailable = rate.cell?.isAvailable !== false;
              return (
                <div
                  key={rate.key}
                  className="rounded-xl border border-separator/60 bg-background/40 overflow-hidden"
                >
                  <div className="py-3 px-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <IOSToggle
                        on={isAvailable}
                        onToggle={() =>
                          onToggleRate(rate.key, rate.patch, !isAvailable)
                        }
                        disabled={!canEdit}
                      />
                      <span className="text-sm font-medium text-label truncate">
                        {rate.label}
                      </span>
                    </div>
                    <PriceInput
                      value={draftValue(rate)}
                      disabled={!canEdit || !isAvailable}
                      onChange={(v) => onChangeDraft(rate.key, v)}
                      onCommit={(v) => onCommitDraft(rate.key, rate.patch, v)}
                    />
                  </div>
                </div>
              );
            })}

            <div className="pt-3 pb-1">
              <p className="text-xs font-semibold text-label-3 uppercase tracking-wider">
                Printing Charges
              </p>
              <p className="text-[11px] text-label-3">
                No. of colours &middot; price per kg (₹)
              </p>
            </div>

            <PrintingMatrix
              printingRates={printingRates}
              rateDrafts={rateDrafts}
              canEdit={canEdit}
              onChangeDraft={onChangeDraft}
              onCommitDraft={onCommitDraft}
            />
          </>
        )}
      </div>
    </section>
  );
}
