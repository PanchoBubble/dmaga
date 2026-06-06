import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { VideoPlayer } from "@/components/video-player";
import { formatBytes } from "@/lib/search";
import { getPlayableLink, PlaybackError } from "@/lib/server/real-debrid/playback";

type PlayerPageProps = { params: Promise<{ id: string }> };

// Resolves the stream URL on each visit (links can expire), so never cache.
export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { id } = await params;

  let link: Awaited<ReturnType<typeof getPlayableLink>> | null = null;
  let errorMessage: string | null = null;
  try {
    link = await getPlayableLink(id);
  } catch (error) {
    errorMessage =
      error instanceof PlaybackError
        ? error.message
        : "Something went wrong resolving this stream.";
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
        <>
          <section className="border-2 border-foreground bg-card p-4 shadow-line">
            <h1 className="break-words text-xl font-black leading-tight sm:text-2xl">
              {link.fileName}
            </h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {[link.host, formatBytes(link.fileSizeBytes ?? undefined)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase">
              <span className="border-2 border-foreground bg-background px-2 py-1">
                {link.kind}
              </span>
              <span className="border-2 border-foreground bg-background px-2 py-1">
                {link.browserPlayable ? "Plays in browser" : "External player"}
              </span>
              {link.subtitles.length ? (
                <span className="border-2 border-foreground bg-background px-2 py-1">
                  {link.subtitles.length} subtitle
                  {link.subtitles.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </section>

          <VideoPlayer
            browserPlayable={link.browserPlayable}
            kind={link.kind}
            linkId={link.id}
            mimeType={link.mimeType}
            subtitles={link.subtitles}
            url={link.url}
          />
        </>
      ) : (
        <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">Can&apos;t play this file</p>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
          <Link
            className="mt-4 inline-flex items-center gap-2 border-2 border-foreground bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-line"
            href="/added"
          >
            <ArrowLeft className="size-4" />
            Back to Added
          </Link>
        </div>
      )}
    </div>
  );
}
