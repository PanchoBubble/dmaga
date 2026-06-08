"use client";

import { useMemo, useState } from "react";

import { TitleSources } from "@/components/title-sources";

type MangaUnit = "volume" | "chapter";

export function MangaVolumes({
  poster,
  title,
  totalVolumes,
  totalChapters,
}: {
  poster?: string;
  title: string;
  totalVolumes: number;
  totalChapters?: number;
}) {
  const hasVolumes = totalVolumes > 0;
  const hasChapters = (totalChapters ?? 0) > 0;

  const [unit, setUnit] = useState<MangaUnit>(hasVolumes ? "volume" : "chapter");
  const [volume, setVolume] = useState(1);
  const [chapter, setChapter] = useState(1);

  const count = unit === "volume" ? totalVolumes : totalChapters ?? 0;
  const numbers = useMemo(
    () => Array.from({ length: count }, (_, index) => index + 1),
    [count],
  );

  if (!hasVolumes && !hasChapters) {
    return (
      <TitleSources
        args={{
          query: `${title} manga`,
          displayTitle: title,
          previewImageUrl: poster,
          type: "manga",
          categories: ["7030"],
        }}
        mode="manga"
        title="Manga Sources"
      />
    );
  }

  const selected = unit === "volume" ? volume : chapter;
  const setSelected = unit === "volume" ? setVolume : setChapter;
  const unitLabel = unit === "volume" ? "Volume" : "Chapter";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {hasVolumes && hasChapters ? (
          <div className="flex border-2 border-foreground">
            {(["volume", "chapter"] as const).map((value) => (
              <button
                className={`h-9 px-3 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-ring ${
                  unit === value
                    ? "bg-foreground text-background"
                    : "bg-background text-foreground"
                }`}
                key={value}
                onClick={() => setUnit(value)}
                type="button"
              >
                {value === "volume" ? "Volumes" : "Chapters"}
              </button>
            ))}
          </div>
        ) : null}

        <label
          className="text-xs font-black uppercase text-muted-foreground"
          htmlFor="manga-unit-number"
        >
          {unitLabel}
        </label>
        <select
          className="h-9 border-2 border-foreground bg-background px-2 text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
          id="manga-unit-number"
          onChange={(event) => setSelected(Number(event.target.value))}
          value={selected}
        >
          {numbers.map((number) => (
            <option key={number} value={number}>
              {unitLabel} {number}
            </option>
          ))}
        </select>
      </div>

      <TitleSources
        args={{
          query: `${title} manga ${unit} ${selected}`,
          displayTitle: title,
          previewImageUrl: poster,
          type: "manga",
          categories: ["7030"],
        }}
        key={`${unit}-${selected}`}
        mode="manga"
        title={`${unitLabel} ${selected} Sources`}
      />
    </div>
  );
}
