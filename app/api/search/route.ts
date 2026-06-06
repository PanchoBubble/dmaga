import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Search query is required." }, { status: 400 });
  }

  return NextResponse.json({
    query,
    results: [],
    note: "Indexer persistence and Torznab parsing are the next implementation step.",
  });
}
