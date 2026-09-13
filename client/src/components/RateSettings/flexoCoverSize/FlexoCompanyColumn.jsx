import { useState } from "react";
import { PlusIcon, TrashIcon } from "../../ui/Icons";
import IOSToggle from "../../ui/IOSToggle";
import SpotlightSearch from "../../ui/SpotlightSearch";

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

      <SpotlightSearch
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onConfirm={(selected) => {
          selected.forEach((company) => onAddCompany(company.id));
          setShowAdd(false);
        }}
        items={unassignedCompanies}
        getKey={(c) => c.id}
        getLabel={(c) => c.name}
        placeholder="Search companies…"
        emptyMessage="No matching companies"
        title="Assign Company"
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
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
                className={`group rounded-lg px-3 py-2 transition-colors cursor-pointer ${selected ? "bg-tint/10" : "hover:bg-fill"}`}
                onClick={() => onSelectCompany(company.id)}
              >
                <div className="flex items-center gap-2">
                  <span onClick={(e) => e.stopPropagation()}>
                    <IOSToggle
                      on={enabled}
                      onToggle={() => onToggleCompany(company.id, !enabled)}
                      disabled={!canEdit}
                    />
                  </span>
                  <span
                    className={`text-sm font-medium text-left flex-1 min-w-0 truncate ${selected ? "text-tint" : enabled ? "text-label" : "text-label-3"}`}
                  >
                    {company.name}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteCompany(company.id); }}
                      className="table-action-btn text-red-500 hover:bg-red-500/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
