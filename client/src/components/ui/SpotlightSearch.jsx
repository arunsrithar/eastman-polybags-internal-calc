import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { SearchIcon, CheckIcon } from "./Icons";

export default function SpotlightSearch({
  open,
  onClose,
  onConfirm,
  items,
  getKey,
  getLabel,
  placeholder = "Search…",
  emptyMessage = "No matches",
  title,
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    setSelectedKeys(new Set());
    requestAnimationFrame(() => inputRef.current?.focus());
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleGlobalKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleGlobalKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleGlobalKey);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      getLabel(item).toLowerCase().includes(needle),
    );
  }, [items, query, getLabel]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.children[activeIndex];
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const toggleItem = useCallback(
    (item) => {
      const key = getKey(item);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [getKey],
  );

  const handleConfirm = useCallback(() => {
    if (selectedKeys.size === 0) return;
    const selected = items.filter((item) => selectedKeys.has(getKey(item)));
    onConfirm(selected);
  }, [selectedKeys, items, getKey, onConfirm]);

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % (filtered.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIndex]) toggleItem(filtered[activeIndex]);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Search"}
    >
      <div className="flex items-start justify-center pt-[20vh] px-4">
        <div
          className="w-full max-w-md rounded-2xl bg-grouped-background-2/92 backdrop-blur-xl backdrop-saturate-150 border border-separator/44 shadow-xl shadow-black/15 overflow-hidden"
          style={{ animation: "dropdown-menu-in-down 130ms ease-out" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-separator/44">
            <p className="text-sm font-semibold text-label">{title}</p>
            <button
              type="button"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors bg-tint text-white disabled:opacity-40"
              disabled={selectedKeys.size === 0}
              onMouseDown={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
            >
              Done{selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ""}
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-separator/44">
            <SearchIcon className="size-4 text-label-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none text-base text-label placeholder:text-label-3"
            />
          </div>

          {/* List */}
          <ul
            ref={listRef}
            className="max-h-[280px] overflow-y-auto p-1.5 space-y-1"
            role="listbox"
            aria-multiselectable="true"
          >
            {filtered.length === 0 ? (
              <li className="dropdown-empty">{emptyMessage}</li>
            ) : (
              filtered.map((item, index) => {
                const key = getKey(item);
                const isSelected = selectedKeys.has(key);
                const isActive = index === activeIndex;
                return (
                  <li
                    key={key}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-tint/12 text-label font-medium"
                        : isActive
                          ? "bg-fill-3 text-label"
                          : "text-label hover:bg-fill-3"
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleItem(item);
                    }}
                  >
                    <span
                      className={`size-4 shrink-0 ${isSelected ? "text-tint" : "invisible"}`}
                    >
                      <CheckIcon className="size-4" />
                    </span>
                    <span className="truncate">{getLabel(item)}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
