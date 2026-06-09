import { NextRequest, NextResponse } from "next/server";

import { getChapterPages } from "@/lib/server/manga-providers";
import type { MangaProviderKey } from "@/lib/server/manga-providers/types";

export const dynamic = "force-dynamic";

const PROVIDERS = new Set<MangaProviderKey>(["mangadex", "comick", "weebcentral"]);

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider")?.trim();
  const id = request.nextUrl.searchParams.get("id")?.trim();

  if (!provider || !PROVIDERS.has(provider as MangaProviderKey) || !id) {
    return NextResponse.json(
      { error: "A valid provider and chapter id are required." },
      { status: 400 },
    );
  }

  try {
    const urls = await getChapterPages(provider as MangaProviderKey, id);
    // Serve every page through our image proxy (handles CORS/referer + SSRF
    // allowlisting) so the reader can just render the returned URLs.
    const pages = urls.map((url) => `/api/manga/proxy?u=${encodeURIComponent(url)}`);
    return NextResponse.json({ pages });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load chapter pages.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
