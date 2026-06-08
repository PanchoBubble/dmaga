"use client";

import { useMemo, useState } from "react";

import { TitleSources } from "@/components/title-sources";

export function MangaVolumes({
  title,
  totalVolumes,
}: {
  title: string;
  totalVolumes: number;
}) {
  const volumes = useMemo(
    () => Array.from({ length: totalVolumes }, (_, index) => index + 1),
    [totalVolumes],
  );
  const [volume, setVolume] = useState(volumes[0] ?? 1);

  if (!volumes.length) {
    return (
      <TitleSources
        args={{
          query: `${title} manga`,
          type: "manga",
          categories: ["7030"],
        }}
        mode="manga"
        title="Manga Sources"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label
          className="text-xs font-black uppercase text-muted-foreground"
          htmlFor="manga-volume"
        >
          Volume
        </label>
        <select
          className="h-9 border-2 border-foreground bg-background px-2 text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
          id="manga-volume"
          onChange={(event) => setVolume(Number(event.target.value))}
          value={volume}
        >
          {volumes.map((number) => (
            <option key={number} value={number}>
              Volume {number}
            </option>
          ))}
        </select>
      </div>

      <TitleSources
        args={{
          query: `${title} manga volume ${volume}`,
          type: "manga",
          categories: ["7030"],
        }}
        mode="manga"
        title={`Volume ${volume} Sources`}
      />
    </div>
  );
}
