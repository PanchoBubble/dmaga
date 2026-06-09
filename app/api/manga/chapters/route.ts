import { NextRequest, NextResponse } from "next/server";

import { getMergedChapters } from "@/lib/server/manga-providers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim();
  const malId = request.nextUrl.searchParams.get("malId")?.trim() || undefined;

  if (!title) {
    return NextResponse.json({ error: "A manga title is required." }, { status: 400 });
  }

  try {
    const { chapters, sources } = await getMergedChapters(malId, title);
    return NextResponse.json({ chapters, sources });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load chapters.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
