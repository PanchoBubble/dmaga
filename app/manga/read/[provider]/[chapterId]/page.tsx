import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ChapterPages } from "@/components/chapter-pages";
import type { MangaProviderKey } from "@/lib/server/manga-providers/types";

type ReadPageProps = {
  params: Promise<{ provider: string; chapterId: string }>;
  searchParams: Promise<{ ch?: string; t?: string; s?: string; sid?: string }>;
};

export const dynamic = "force-dynamic";

const PROVIDERS = new Set<MangaProviderKey>([
  "mangadex",
  "comick",
  "weebcentral",
  "vymanga",
]);

export default async function MangaReadPage({ params, searchParams }: ReadPageProps) {
  const { provider, chapterId } = await params;
  const { ch, t, s, sid } = await searchParams;

  // Native provider series (sid) link back to the provider-native series page;
  // MAL-path titles (s) link back to the MAL title page.
  const backHref = sid
    ? `/manga/series/${provider}/${sid}`
    : s
      ? `/manga/${s}`
      : "/manga";
  const title = [t, ch ? `Chapter ${ch}` : null].filter(Boolean).join(" · ") || "Reader";

  if (!PROVIDERS.has(provider as MangaProviderKey)) {
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
          <p className="text-lg font-black">Unknown reading provider.</p>
        </div>
      </div>
    );
  }

  // For VyManga the chapter id is the base64url of the source reader URL — decode
  // it so the reader can offer an "open on VyManga" fallback when image
  // extraction fails (protected readers).
  const sourceUrl =
    provider === "vymanga" ? decodeBase64Url(chapterId) : null;

  return (
    <ChapterPages
      backHref={backHref}
      chapterId={chapterId}
      provider={provider}
      sourceUrl={sourceUrl}
      title={title}
    />
  );
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
