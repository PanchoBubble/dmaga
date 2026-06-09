import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// SSRF guard: only proxy images from known manga-provider CDNs.
const ALLOWED_HOST_SUFFIXES = [
  "mangadex.network",
  "mangadex.org",
  "comick.pictures",
  "comick.fun",
  "comick.io",
  "pictures.comick.fun",
];

/**
 * Streams a provider page image through our server. Avoids browser CORS/referer
 * problems with provider CDNs and keeps the only outbound fetch host-restricted.
 * Chapter images are immutable, so they cache aggressively.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("u");
  if (!raw) {
    return Response.json({ error: "Missing image url." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return Response.json({ error: "Invalid image url." }, { status: 400 });
  }

  if (
    target.protocol !== "https:" ||
    !ALLOWED_HOST_SUFFIXES.some(
      (suffix) =>
        target.hostname === suffix || target.hostname.endsWith(`.${suffix}`),
    )
  ) {
    return Response.json({ error: "Host not allowed." }, { status: 403 });
  }

  const upstream = await fetch(target.toString(), {
    headers: { Accept: "image/*", Referer: `${target.origin}/` },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });

  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: `Image fetch failed (${upstream.status}).` },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
