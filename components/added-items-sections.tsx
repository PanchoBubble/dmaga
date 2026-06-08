"use client";

import { ChevronDown, ChevronRight, LayoutGrid, Rows3 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { AddedItemCard, AddedItemRow } from "@/components/added-item-card";
import { Button } from "@/components/ui/button";
import type { AddedItemDto } from "@/lib/debrid";
import { cn } from "@/lib/utils";

type AddedView = "card" | "row";

const ADDED_VIEW_KEY = "dmaga:added-view";

// Tracked as external state so the toggle survives reloads (localStorage) and
// stays in sync across tabs (storage event) and sibling renders (listeners).
const viewListeners = new Set<() => void>();

/**
 * Reads the persisted layout preference. Rows are the default — the card view
 * is the opt-in.
 */
function readAddedView(): AddedView {
  try {
    return window.localStorage.getItem(ADDED_VIEW_KEY) === "card" ? "card" : "row";
  } catch {
    return "row";
  }
}

function writeAddedView(next: AddedView) {
  try {
    window.localStorage.setItem(ADDED_VIEW_KEY, next);
  } catch {
    // Best-effort persistence; a full/disabled store just falls back to memory.
  }
  viewListeners.forEach((listener) => listener());
}

function subscribeAddedView(callback: () => void) {
  viewListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    viewListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Hydration-safe layout preference: the server (and first client render) sees
 * the "row" default, then the persisted value is reconciled without a manual
 * mount effect.
 */
function useAddedView(): [AddedView, (next: AddedView) => void] {
  const view = useSyncExternalStore(
    subscribeAddedView,
    readAddedView,
    () => "row" as AddedView,
  );
  return [view, writeAddedView];
}

export function AddedItemsSections({ items }: { items: AddedItemDto[] }) {
  const grouped = groupAddedItems(items);
  const sections = [{ key: "recents", title: "Recents", items }, ...grouped];
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(
    {},
  );
  const [view, changeView] = useAddedView();

  function toggleSection(key: string) {
    setCollapsedSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ViewToggle onChange={changeView} view={view} />
      </div>
      <div className="space-y-8">
        {sections.map((section) => (
          <AddedSection
            collapsed={Boolean(collapsedSections[section.key])}
            items={section.items}
            key={section.key}
            onToggle={() => toggleSection(section.key)}
            title={section.title}
            view={view}
          />
        ))}
      </div>
    </div>
  );
}

function ViewToggle({
  onChange,
  view,
}: {
  onChange: (view: AddedView) => void;
  view: AddedView;
}) {
  return (
    <div
      className="inline-flex border-2 border-foreground bg-background shadow-line"
      role="group"
      aria-label="Layout"
    >
      {(
        [
          { value: "row", label: "Rows", icon: Rows3 },
          { value: "card", label: "Cards", icon: LayoutGrid },
        ] as const
      ).map((option) => {
        const active = view === option.value;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-foreground text-background"
                : "text-foreground hover:bg-accent",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <option.icon className="size-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AddedSection({
  collapsed,
  items,
  onToggle,
  title,
  view,
}: {
  collapsed: boolean;
  items: AddedItemDto[];
  onToggle: () => void;
  title: string;
  view: AddedView;
}) {
  const contentId = `added-section-${title.toLowerCase().replace(/\W+/g, "-")}`;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          aria-controls={contentId}
          aria-expanded={!collapsed}
          className="group flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onToggle}
          type="button"
        >
          {collapsed ? (
            <ChevronRight className="size-5 shrink-0" />
          ) : (
            <ChevronDown className="size-5 shrink-0" />
          )}
          <h2 className="truncate text-xl font-black">{title}</h2>
          <span className="shrink-0 border-2 border-foreground bg-background px-2 py-0.5 text-xs font-black">
            {items.length}
          </span>
        </button>
        <Button
          aria-controls={contentId}
          aria-expanded={!collapsed}
          onClick={onToggle}
          size="sm"
          variant="outline"
        >
          {collapsed ? "Show" : "Hide"}
        </Button>
      </div>
      {collapsed ? null : (
        <div className={cn("min-w-0", view === "row" ? "space-y-2" : "space-y-3")} id={contentId}>
          {items.map((item) =>
            view === "row" ? (
              <AddedItemRow item={item} key={item.id} />
            ) : (
              <AddedItemCard item={item} key={item.id} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

const sectionTitles: Record<AddedItemDto["originSection"], string> = {
  movie: "Movies",
  show: "Shows",
  mal: "MyAnimeList",
  manga: "Manga",
  other: "Other",
};

function groupAddedItems(items: AddedItemDto[]) {
  const order: AddedItemDto["originSection"][] = [
    "movie",
    "show",
    "mal",
    "manga",
    "other",
  ];

  return order
    .map((key) => ({
      key,
      title: sectionTitles[key],
      items: items.filter((item) => item.originSection === key),
    }))
    .filter((group) => group.items.length > 0);
}
