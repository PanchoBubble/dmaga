import { NextResponse } from "next/server";

import { HostDownloadError, queueHostDownload } from "@/lib/server/host-downloads";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const download = await queueHostDownload(id);
    return NextResponse.json({ download }, { status: 202 });
  } catch (error) {
    if (error instanceof HostDownloadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Unable to queue host download.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
