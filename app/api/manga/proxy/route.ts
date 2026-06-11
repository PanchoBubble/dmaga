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
  // Weeb Central image mirrors.
  "planeptune.us",
  "lastation.us",
  "lowee.us",
  // VyManga cover CDN + the Google-hosted CDNs its readers serve pages from
  // (Blogger/blogspot + googleusercontent — common scanlation image hosts).
  "cdnxyz.xyz",
  "vymanga.net",
  "bp.blogspot.com",
  "blogspot.com",
  "googleusercontent.com",
];

// Hosts whose CDN checks the Referer — send the site's referer, not the CDN's.
const WEEB_CENTRAL_HOSTS = ["planeptune.us", "lastation.us", "lowee.us"];
const VYMANGA_HOSTS = ["cdnxyz.xyz", "vymanga.net"];

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

  const matchesHost = (hosts: string[]) =>
    hosts.some(
      (suffix) => target.hostname === suffix || target.hostname.endsWith(`.${suffix}`),
    );

  const referer = matchesHost(WEEB_CENTRAL_HOSTS)
    ? "https://weebcentral.com/"
    : matchesHost(VYMANGA_HOSTS)
      ? "https://vymanga.net/"
      : `${target.origin}/`;

  const upstream = await fetch(target.toString(), {
    headers: { Accept: "image/*", Referer: referer },
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
