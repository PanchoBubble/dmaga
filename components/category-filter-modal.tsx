"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { FilterableMediaCategory } from "@/lib/mock-media";
import { cn } from "@/lib/utils";

type CategoryOption = { id: FilterableMediaCategory; label: string };

type CategoryFilterModalProps = {
  onClose: () => void;
  categories: ReadonlyArray<CategoryOption>;
  /** Currently committed scope; `null` means every category is selected. */
  selectedIds: FilterableMediaCategory[] | null;
  /** Commit a new scope; `null` collapses back to "all". */
  onApply: (ids: FilterableMediaCategory[] | null) => void;
};

/**
 * Modal for narrowing a search to a subset of media categories. Mirrors the
 * indexer filter modal: mount it only while open so the draft seeds fresh from
 * the committed scope, toggling only mutates the local draft, and it commits
 * (re-running the search) on Apply. An empty selection is allowed but warns and
 * blocks Apply, since it would search nothing.
 */
export function CategoryFilterModal({
  onClose,
  categories,
  selectedIds,
  onApply,
}: CategoryFilterModalProps) {
  const allIds = categories.map((category) => category.id);
  const [draft, setDraft] = useState<FilterableMediaCategory[]>(selectedIds ?? allIds);

  // Close on Escape.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const selectedSet = new Set(draft);
  const allSelected = categories.length > 0 && draft.length === categories.length;

  function toggle(id: FilterableMediaCategory) {
    setDraft((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function toggleAll() {
    setDraft(allSelected ? [] : allIds);
  }

  function handleApply() {
    // Collapse "everything" to null so callers persist the canonical "all"
    // sentinel; an explicit subset (including the warned empty case) passes through.
    onApply(allSelected ? null : draft);
    onClose();
  }

  return (
    <div
      aria-labelledby="category-filter-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
    >
      <button
        aria-label="Close"
        className="absolute inset-0 bg-foreground/40"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />

      <div className="relative flex max-h-[80dvh] w-full max-w-md flex-col border-2 border-foreground bg-card shadow-line">
        <div className="flex items-center justify-between gap-3 border-b-2 border-foreground p-4">
          <h2 className="text-lg font-black" id="category-filter-title">
            Categories
          </h2>
          <button
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center border-2 border-foreground bg-background shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-foreground px-4 py-3">
          <span className="text-xs font-black uppercase text-muted-foreground">
            {allSelected
              ? "All categories"
              : `${draft.length} of ${categories.length} selected`}
          </span>
          <Button onClick={toggleAll} size="sm" type="button" variant="outline">
            {allSelected ? "Deselect all" : "Select all"}
          </Button>
        </div>

        <ul className="flex-1 overflow-y-auto p-2">
          {categories.map((category) => {
            const checked = selectedSet.has(category.id);
            return (
              <li key={category.id}>
                <button
                  aria-pressed={checked}
                  className="flex w-full items-center gap-3 px-2 py-2.5 text-left text-sm font-semibold hover:bg-accent"
                  onClick={() => toggle(category.id)}
                  type="button"
                >
                  <span
                    className={cn(
                      "inline-flex size-5 shrink-0 items-center justify-center border-2 border-foreground",
                      checked ? "bg-primary text-primary-foreground" : "bg-background",
                    )}
                  >
                    {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                  <span className="truncate">{category.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {draft.length === 0 ? (
          <p className="border-t-2 border-dashed border-foreground px-4 py-2 text-xs font-bold text-destructive">
            Select at least one category to search.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t-2 border-foreground p-4">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={draft.length === 0} onClick={handleApply} type="button">
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
