"use client";

import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Star,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { entryKey, useDebridStore } from "@/hooks/use-debrid-store";
import {
  formatBytes,
  formatRelativeAge,
  type DebridAvailability,
  type SearchResultDto,
} from "@/lib/search";
import { cn } from "@/lib/utils";

type TorrentResultCardProps = {
  result: SearchResultDto;
  index?: number;
};

const availabilityBadge: Record<
  "downloading" | "saved",
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  downloading: {
    label: "Downloading",
    icon: Loader2,
    className: "bg-accent text-accent-foreground",
  },
  saved: {
    label: "Saved to Debrid",
    icon: ArrowDownToLine,
    className: "bg-background",
  },
};

export function TorrentResultCard({ result, index = 0 }: TorrentResultCardProps) {
  const router = useRouter();
  const entry = useDebridStore((state) => state.entries[entryKey(result)]);
  const addToDebrid = useDebridStore((state) => state.addToDebrid);

  // The just-added state (from the store) wins over the search-time snapshot.
  const availability: DebridAvailability = entry?.availability ?? result.debridState;
  const isAdding = entry?.status === "adding";
  const isReady = availability === "ready";
  const canAdd = Boolean(result.magnetUrl || result.infoHash);

  const badge =
    availability === "downloading" || availability === "saved"
      ? availabilityBadge[availability]
      : null;

  async function handleAdd() {
    const response = await addToDebrid(result);
    // Refresh server components so the Added page + nav badge pick up the item.
    if (response) {
      router.refresh();
    }
  }

  const stats = [
    { label: "Size", value: formatBytes(result.sizeBytes) },
    { label: "Seeds", value: formatCount(result.seeders) },
    { label: "Peers", value: formatCount(result.leechers) },
    { label: "Age", value: formatRelativeAge(result.publishedAt) },
  ];

  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col border-2 border-foreground bg-card p-3 shadow-line sm:p-4"
      initial={{ opacity: 0, y: 8 }}
      transition={{ delay: Math.min(index, 8) * 0.05 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
            <Users className="size-3.5" />
            {result.indexerName}
          </p>
          <h2 className="mt-2 break-words text-lg font-black leading-tight sm:text-xl">
            {result.title}
          </h2>
        </div>
        <Button aria-label="Save torrent" size="icon" variant="outline">
          <Star className="size-5" />
        </Button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold sm:mt-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            className="border-2 border-foreground bg-background px-2 py-1"
            key={stat.label}
          >
            <dt className="text-[10px] uppercase text-muted-foreground">
              {stat.label}
            </dt>
            <dd className="tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {badge ? (
        <div
          className={cn(
            "mt-3 inline-flex w-fit items-center gap-2 border-2 border-foreground px-2 py-1 text-xs font-black",
            badge.className,
          )}
        >
          <badge.icon
            className={cn("size-4", availability === "downloading" && "animate-spin")}
          />
          {badge.label}
          {availability === "downloading" && entry && entry.progress > 0
            ? ` · ${entry.progress}%`
            : null}
        </div>
      ) : null}

      {entry?.status === "error" ? (
        <p className="mt-3 border-2 border-destructive bg-background px-2 py-1 text-xs font-bold text-destructive">
          {entry.error ?? "Failed to add to Real-Debrid."}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
        {result.sourceUrl ? (
          <Button asChild className="px-3" variant="outline">
            <a href={result.sourceUrl} rel="noreferrer" target="_blank">
              Details
            </a>
          </Button>
        ) : null}
        {isReady ? (
          <Button>
            <Download className="size-4" />
            Download
          </Button>
        ) : (
          <Button disabled={!canAdd || isAdding} onClick={() => void handleAdd()}>
            {isAdding ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Adding
              </>
            ) : (
              <>
                <Plus className="size-4" />
                {entry?.status === "error" ? "Retry" : "Add"}
              </>
            )}
          </Button>
        )}
      </div>
    </motion.article>
  );
}

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}
