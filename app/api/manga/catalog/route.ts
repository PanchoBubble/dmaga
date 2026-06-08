import { NextRequest, NextResponse } from "next/server";

import {
  fetchPopularMangaCatalog,
  searchMangaCatalog,
} from "@/lib/server/metadata/jikan-manga";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const items = query
    ? await searchMangaCatalog(query, limit)
    : await fetchPopularMangaCatalog(limit);

  return NextResponse.json({ items });
}

function parseLimit(value: string | null) {
  if (!value) {
    return 18;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 24) : 18;
}
