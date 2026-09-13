import { CheckIcon, CloseIcon, PlusIcon, TrashIcon } from "../../ui/Icons";
import { formatDimension } from "../../../utils/dimensionUtils";

export default function FlexoSizeListColumn({
  canEdit,
  coverSizes,
  selectedSize,
  onSelectSize,
  onDeleteSize,
  addingSize,
  onStartAdd,
  widthInput,
  heightInput,
  onWidthChange,
  onHeightChange,
  onSizeInputKeyDown,
  onConfirmAdd,
  onCancelAdd,
}) {
  return (
    <section className="card overflow-hidden min-h-[22rem] flex flex-col">
      <div className="card-section border-b border-separator flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-label">Cover Sizes</p>
        {canEdit ? (
          <button
            type="button"
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
            onClick={onStartAdd}
          >
            <PlusIcon className="size-3.5" />
            Add
          </button>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {addingSize ? (
          <div className="rounded-lg border border-separator/60 bg-background/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={widthInput}
                onChange={(e) => onWidthChange(e.target.value)}
                onKeyDown={onSizeInputKeyDown}
                placeholder="W"
                autoFocus
                className="input-base py-1.5 text-sm flex-1 min-w-0"
              />
              <span className="text-label-3">x</span>
              <input
                type="text"
                value={heightInput}
                onChange={(e) => onHeightChange(e.target.value)}
                onKeyDown={onSizeInputKeyDown}
                placeholder="H"
                className="input-base py-1.5 text-sm flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={onConfirmAdd}
                className="table-action-btn text-tint hover:bg-tint/10 shrink-0"
                aria-label="Create cover size"
                title="Create (Enter)"
              >
                <CheckIcon className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onCancelAdd}
                className="table-action-btn text-label-3 hover:bg-fill shrink-0"
                aria-label="Cancel"
                title="Cancel (Esc)"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        ) : null}

        {coverSizes.length === 0 ? (
          <div className="card-section text-sm text-label-3">
            No cover sizes yet
          </div>
        ) : (
          coverSizes.map((size) => {
            const selected = size === selectedSize;
            return (
              <div
                key={size}
                onClick={() => onSelectSize(size)}
                className={`group rounded-lg px-3 py-2.5 transition-colors cursor-pointer flex items-center gap-2 ${selected ? "bg-tint/10 text-tint" : "hover:bg-fill text-label"}`}
              >
                <span className="text-sm font-medium truncate flex-1 min-w-0">
                  {formatDimension(size)}
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDeleteSize(size); }}
                    className="table-action-btn text-red-500 hover:bg-red-500/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${formatDimension(size)}`}
                  >
                    <TrashIcon />
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
