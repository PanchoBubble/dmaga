import { ArrowLeft, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TitleSources } from "@/components/title-sources";
import { parseMangaCatalogSlug } from "@/lib/manga";
import { fetchMangaCatalogItem } from "@/lib/server/metadata/jikan-manga";

type MangaTitlePageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: MangaTitlePageProps) {
  const { slug } = await params;
  const id = parseMangaCatalogSlug(slug);
  const item = id ? await fetchMangaCatalogItem(id) : null;
  return {
    title: item ? `${item.title} · Manga · dmaga` : "Manga · dmaga",
  };
}

export default async function MangaTitlePage({ params }: MangaTitlePageProps) {
  const { slug } = await params;
  const id = parseMangaCatalogSlug(slug);
  const item = id ? await fetchMangaCatalogItem(id) : null;

  if (!item) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        href="/manga"
      >
        <ArrowLeft className="size-4" />
        Back to Manga
      </Link>

      <section className="grid gap-4 border-2 border-foreground bg-card p-4 shadow-line sm:grid-cols-[9rem_1fr]">
        <div className="relative aspect-[2/3] w-36 max-w-full overflow-hidden border-2 border-foreground bg-secondary sm:w-full">
          {item.poster ? (
            <Image
              alt={item.title}
              className="object-cover"
              fill
              sizes="9rem"
              src={item.poster}
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center p-3 text-center text-sm font-black">
              {item.title}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-black leading-tight sm:text-3xl">
            {item.title}
          </h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {item.subtitle}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
            {item.score ? (
              <span className="inline-flex items-center gap-1 border-2 border-foreground bg-background px-2 py-1">
                <Star className="size-3 fill-yellow-400 text-yellow-400" />
                {item.score.toFixed(1)}
              </span>
            ) : null}
            {item.chapters ? (
              <span className="border-2 border-foreground bg-background px-2 py-1">
                {item.chapters} chapters
              </span>
            ) : null}
            {item.volumes ? (
              <span className="border-2 border-foreground bg-background px-2 py-1">
                {item.volumes} volumes
              </span>
            ) : null}
          </div>
          {item.synopsis ? (
            <p className="mt-3 line-clamp-4 text-sm font-semibold leading-6">
              {item.synopsis}
            </p>
          ) : null}
        </div>
      </section>

      {/* One bare-title search, organized by the volume/chapter grouping —
          no separate unit/number dropdown (it over-constrained the query and
          fought the grouping). */}
      <TitleSources
        args={{
          query: item.query,
          displayTitle: item.title,
          previewImageUrl: item.poster,
          type: "manga",
          categories: ["7030"],
        }}
        mode="manga"
        title="Manga Sources"
      />
    </div>
  );
}
