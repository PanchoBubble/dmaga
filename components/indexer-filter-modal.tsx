"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { IndexerOption } from "@/hooks/use-search-store";
import { cn } from "@/lib/utils";

type IndexerFilterModalProps = {
  onClose: () => void;
  indexers: IndexerOption[];
  /** Currently committed scope; `null` means every indexer is selected. */
  selectedIds: string[] | null;
  /** Commit a new scope; `null` collapses back to "all". */
  onApply: (ids: string[] | null) => void;
};

/**
 * Modal for choosing which enabled indexers a search is dispatched to. Mount it
 * only while open (the parent gates it) so the draft seeds fresh from the
 * committed scope each time and a cancelled edit never leaks into the next
 * open. Toggling checkboxes only mutates the local draft; it commits (and
 * re-runs the search) on Apply. An empty selection is allowed but warns, since
 * it would search nothing.
 */
export function IndexerFilterModal({
  onClose,
  indexers,
  selectedIds,
  onApply,
}: IndexerFilterModalProps) {
  const allIds = indexers.map((indexer) => indexer.id);
  const [draft, setDraft] = useState<string[]>(selectedIds ?? allIds);

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
  const allSelected = indexers.length > 0 && draft.length === indexers.length;

  function toggle(id: string) {
    setDraft((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function toggleAll() {
    setDraft(allSelected ? [] : allIds);
  }

  function handleApply() {
    // Collapse "everything" to null so callers persist the canonical sentinel.
    onApply(allSelected ? null : draft);
    onClose();
  }

  return (
    <div
      aria-labelledby="indexer-filter-title"
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
          <h2 className="text-lg font-black" id="indexer-filter-title">
            Search indexers
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

        {indexers.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No enabled indexers. Enable at least one in settings to search.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-foreground px-4 py-3">
              <span className="text-xs font-black uppercase text-muted-foreground">
                {`${draft.length} of ${indexers.length} selected`}
              </span>
              <Button onClick={toggleAll} size="sm" type="button" variant="outline">
                {allSelected ? "Deselect all" : "Select all"}
              </Button>
            </div>

            <ul className="flex-1 overflow-y-auto p-2">
              {indexers.map((indexer) => {
                const checked = selectedSet.has(indexer.id);
                return (
                  <li key={indexer.id}>
                    <button
                      aria-pressed={checked}
                      className="flex w-full items-center gap-3 px-2 py-2.5 text-left text-sm font-semibold hover:bg-accent"
                      onClick={() => toggle(indexer.id)}
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
                      <span className="truncate">{indexer.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {draft.length === 0 ? (
              <p className="border-t-2 border-dashed border-foreground px-4 py-2 text-xs font-bold text-destructive">
                Select at least one indexer to search.
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
          </>
        )}
      </div>
    </div>
  );
}
