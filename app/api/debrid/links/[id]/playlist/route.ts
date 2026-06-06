import { getPlayableLink, PlaybackError } from "@/lib/server/real-debrid/playback";

type RouteContext = { params: Promise<{ id: string }> };

// The playlist embeds a freshly-resolved URL, so never cache it.
export const dynamic = "force-dynamic";

/**
 * Returns an `.m3u` playlist pointing at the resolved stream URL. Opening it
 * hands the stream off to a desktop player (VLC, etc.) for formats browsers
 * can't decode natively (mkv/avi/...). Always resolves a fresh URL so the
 * handed-off link is current.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const link = await getPlayableLink(id, { refresh: true });
    const playlist = `#EXTM3U\n#EXTINF:-1,${link.fileName}\n${link.url}\n`;
    const downloadName = `${stripExtension(link.fileName)}.m3u`;

    return new Response(playlist, {
      status: 200,
      headers: {
        "Content-Type": "audio/x-mpegurl; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sanitizeHeaderFilename(downloadName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PlaybackError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Unable to build playlist.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Keep the Content-Disposition filename to a safe ASCII subset. */
function sanitizeHeaderFilename(fileName: string): string {
  return fileName.replace(/[^\w .()[\]-]+/g, "_").replace(/"/g, "");
}
