import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TitleSources } from "@/components/title-sources";
import { getMangaCatalogItem, mangaCatalogItems } from "@/lib/manga";

type MangaTitlePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return mangaCatalogItems.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: MangaTitlePageProps) {
  const { slug } = await params;
  const item = getMangaCatalogItem(slug);
  return {
    title: item ? `${item.title} · Manga · dmaga` : "Manga · dmaga",
  };
}

export default async function MangaTitlePage({ params }: MangaTitlePageProps) {
  const { slug } = await params;
  const item = getMangaCatalogItem(slug);

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
          <p className="mt-3 text-sm font-bold">
            Supported inline: CBZ/ZIP image archives, PDF, and loose image files.
          </p>
        </div>
      </section>

      <TitleSources
        args={{
          query: item.query,
          type: "manga",
          categories: ["7030"],
        }}
        mode="manga"
      />
    </div>
  );
}
