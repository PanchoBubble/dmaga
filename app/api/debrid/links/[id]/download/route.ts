import {
  PlaybackError,
  resolveDownloadStream,
} from "@/lib/server/real-debrid/playback";

type RouteContext = { params: Promise<{ id: string }> };

// Always resolves a fresh Real-Debrid URL (stored ones expire), so never cache.
export const dynamic = "force-dynamic";

/**
 * Redirects to a freshly-unrestricted direct download URL for a debrid link.
 * Real-Debrid's stored `originalLink` is a restricted page (not a file) and a
 * cached `unrestrictedLink` can be expired, so we re-unrestrict on each click
 * and 302 the browser straight at the live CDN URL.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const { url } = await resolveDownloadStream(id, { refresh: true });
    return Response.redirect(url, 302);
  } catch (error) {
    if (error instanceof PlaybackError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Unable to resolve download.";
    return Response.json({ error: message }, { status: 500 });
  }
}
