import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { MangaReader } from "@/components/manga-reader";
import { getReadableMangaLink } from "@/lib/server/manga-reader";
import { PlaybackError } from "@/lib/server/real-debrid/playback";

type ReaderPageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { id } = await params;

  let link: Awaited<ReturnType<typeof getReadableMangaLink>> | null = null;
  let errorMessage: string | null = null;
  try {
    link = await getReadableMangaLink(id);
  } catch (error) {
    errorMessage =
      error instanceof PlaybackError
        ? error.message
        : "Something went wrong resolving this file.";
  }

  return (
    <div className="space-y-4">
      <Link
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        href="/added"
      >
        <ArrowLeft className="size-4" />
        Back to Added
      </Link>

      {link ? (
        <MangaReader
          fileName={link.fileName}
          fileSizeBytes={null}
          kind={link.kind}
          linkId={id}
        />
      ) : (
        <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">Can&apos;t open this file</p>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
