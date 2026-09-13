import { useState } from "react";
import { PlusIcon, TrashIcon } from "../../ui/Icons";
import IOSToggle from "../../ui/IOSToggle";

export default function FlexoCompanyColumn({
  selectedSize,
  companiesForSize,
  unassignedCompanies,
  selectedCompanyId,
  onSelectCompany,
  onAddCompany,
  onDeleteCompany,
  onToggleCompany,
  canEdit,
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <section className="card overflow-hidden min-h-[22rem] flex flex-col">
      <div className="card-section border-b border-separator flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-label">Companies</p>
        <div className="flex items-center gap-2 min-w-0">
          {selectedSize ? (
            <span className="text-xs text-label-3 truncate">
              {selectedSize}
            </span>
          ) : null}
          {canEdit && selectedSize && unassignedCompanies.length > 0 ? (
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
              onClick={() => setShowAdd((v) => !v)}
            >
              <PlusIcon className="size-3.5" />
              Add
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {showAdd && unassignedCompanies.length > 0 ? (
          <div className="rounded-lg border border-separator/60 bg-background/40 px-3 py-2 mb-2">
            <p className="text-[11px] text-label-3 mb-1.5">Assign company:</p>
            <div className="space-y-1">
              {unassignedCompanies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left text-sm text-label hover:bg-fill rounded-md px-2 py-1.5 transition-colors"
                  onClick={() => {
                    onAddCompany(c.id);
                    setShowAdd(false);
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!selectedSize ? (
          <div className="card-section text-sm text-label-3">
            Select a cover size first
          </div>
        ) : companiesForSize.length === 0 ? (
          <div className="card-section text-sm text-label-3">
            No companies for this size
          </div>
        ) : (
          companiesForSize.map(({ company, coverSizeEntry }) => {
            const selected = company.id === selectedCompanyId;
            const enabled = coverSizeEntry.enabled !== false;
            return (
              <div
                key={company.id}
                className={`rounded-lg px-3 py-2 transition-colors ${selected ? "bg-tint/10" : "hover:bg-fill"}`}
              >
                <div className="flex items-center gap-2">
                  <IOSToggle
                    on={enabled}
                    onToggle={() => onToggleCompany(company.id, !enabled)}
                    disabled={!canEdit}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectCompany(company.id)}
                    className={`text-sm font-medium text-left flex-1 min-w-0 truncate cursor-pointer ${selected ? "text-tint" : enabled ? "text-label" : "text-label-3"}`}
                  >
                    {company.name}
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => onDeleteCompany(company.id)}
                      className="table-action-btn text-red-500 hover:bg-red-500/10 shrink-0"
                      aria-label={`Remove ${company.name}`}
                    >
                      <TrashIcon />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
