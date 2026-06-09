import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ChapterReader } from "@/components/chapter-reader";
import { getChapterPages } from "@/lib/server/manga-providers";
import type { MangaProviderKey } from "@/lib/server/manga-providers/types";

type ReadPageProps = {
  params: Promise<{ provider: string; chapterId: string }>;
  searchParams: Promise<{ ch?: string; t?: string; s?: string }>;
};

export const dynamic = "force-dynamic";

const PROVIDERS = new Set<MangaProviderKey>(["mangadex", "comick"]);

export default async function MangaReadPage({ params, searchParams }: ReadPageProps) {
  const { provider, chapterId } = await params;
  const { ch, t, s } = await searchParams;

  const backHref = s ? `/manga/${s}` : "/manga";
  const title = [t, ch ? `Chapter ${ch}` : null].filter(Boolean).join(" · ") || "Reader";

  let pages: string[] = [];
  let errorMessage: string | null = null;

  if (!PROVIDERS.has(provider as MangaProviderKey)) {
    errorMessage = "Unknown reading provider.";
  } else {
    try {
      const urls = await getChapterPages(provider as MangaProviderKey, chapterId);
      pages = urls.map((url) => `/api/manga/proxy?u=${encodeURIComponent(url)}`);
      if (pages.length === 0) {
        errorMessage = "This chapter has no readable pages.";
      }
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Unable to load this chapter.";
    }
  }

  if (errorMessage) {
    return (
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
          href={backHref}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">Can&apos;t open this chapter</p>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return <ChapterReader backHref={backHref} pages={pages} title={title} />;
}
