"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { AddedItemCard } from "@/components/added-item-card";
import { Button } from "@/components/ui/button";
import type { AddedItemDto } from "@/lib/debrid";

export function AddedItemsSections({ items }: { items: AddedItemDto[] }) {
  const grouped = groupAddedItems(items);
  const sections = [{ key: "recents", title: "Recents", items }, ...grouped];
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(
    {},
  );

  function toggleSection(key: string) {
    setCollapsedSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <AddedSection
          collapsed={Boolean(collapsedSections[section.key])}
          items={section.items}
          key={section.key}
          onToggle={() => toggleSection(section.key)}
          title={section.title}
        />
      ))}
    </div>
  );
}

function AddedSection({
  collapsed,
  items,
  onToggle,
  title,
}: {
  collapsed: boolean;
  items: AddedItemDto[];
  onToggle: () => void;
  title: string;
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
        <div className="min-w-0 space-y-3" id={contentId}>
          {items.map((item) => (
            <AddedItemCard item={item} key={item.id} />
          ))}
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
