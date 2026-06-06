"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2, Download, Plus, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MediaItem } from "@/lib/mock-media";
import { cn } from "@/lib/utils";

type MediaCardProps = {
  item: MediaItem;
  index?: number;
};

export function MediaCard({ item, index = 0 }: MediaCardProps) {
  const isReady = item.debridState === "ready";

  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-[104px_1fr] gap-3 border-2 border-foreground bg-card p-3 shadow-line sm:grid-cols-[132px_1fr] sm:gap-4"
      initial={{ opacity: 0, y: 8 }}
      transition={{ delay: index * 0.08 }}
    >
      <div
        className={cn(
          "relative aspect-[3/4] overflow-hidden border-2 border-foreground bg-emerald-100",
          item.previewTone === "blue" && "bg-sky-100",
        )}
      >
        <Image
          alt=""
          className="h-full w-full object-contain p-5"
          height={360}
          loading={index === 0 ? "eager" : "lazy"}
          src="/dmaga-logo.png"
          width={270}
        />
        <div className="absolute bottom-2 left-2 right-2 border-2 border-foreground bg-background px-2 py-1 text-center text-xs font-black">
          Preview
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-muted-foreground">
              {item.indexer}
            </p>
            <h2 className="mt-2 text-xl font-black leading-tight">{item.title}</h2>
          </div>
          <Button
            aria-label={item.saved ? "Remove from saved" : "Save torrent"}
            size="icon"
            variant={item.saved ? "secondary" : "outline"}
          >
            <Star className={cn("size-5", item.saved && "fill-current")} />
          </Button>
        </div>

        <div className="mt-3 grid gap-1 text-sm font-semibold sm:mt-4 sm:grid-cols-3 sm:gap-2">
          <div>Size: {item.size}</div>
          <div>Seeds: {item.seeds}</div>
          <div>Age: {item.age}</div>
        </div>

        {isReady ? (
          <div className="mt-4 inline-flex w-fit items-center gap-2 border-2 border-foreground bg-secondary px-2 py-1 text-xs font-black">
            <CheckCircle2 className="size-4" />
            In Debrid
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
          <Button className="px-3" variant="outline">
            Details
          </Button>
          <Button>
            {isReady ? (
              <>
                <Download className="size-4" />
                Download
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Add
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
