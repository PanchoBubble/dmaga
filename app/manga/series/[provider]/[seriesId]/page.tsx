import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MangaSeries } from "@/components/manga-series";
import { DISCOVER_PROVIDERS } from "@/lib/server/manga-providers";
import type { MangaProviderKey } from "@/lib/server/manga-providers/types";

type SeriesPageProps = {
  params: Promise<{ provider: string; seriesId: string }>;
};

export const dynamic = "force-dynamic";

export default async function MangaSeriesPage({ params }: SeriesPageProps) {
  const { provider, seriesId } = await params;
  if (!DISCOVER_PROVIDERS.includes(provider as MangaProviderKey)) {
    notFound();
  }

  // The page shell renders instantly; chapters load client-side (behind a
  // spinner) because the byparr Cloudflare solve takes ~20s.
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        href="/manga/discover"
      >
        <ArrowLeft className="size-4" />
        Back to Browse
      </Link>

      <MangaSeries provider={provider} seriesId={seriesId} />
    </div>
  );
}
