import { NextRequest, NextResponse } from "next/server";

import type { SearchStreamEvent } from "@/lib/search";
import { streamIndexerSearch } from "@/lib/server/indexers/search";

const MAX_RESULTS = 200;

// Streaming responses must never be statically cached or buffered.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Search query is required." }, { status: 400 });
  }

  const categories = request.nextUrl.searchParams
    .getAll("cat")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  // Optional scope: when present, search only these indexer ids; absent means
  // every enabled indexer (the default fan-out).
  const indexerIds = request.nextUrl.searchParams
    .getAll("indexer")
    .map((value) => value.trim())
    .filter(Boolean);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SearchStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for await (const event of streamIndexerSearch(
          { query, categories, limit: MAX_RESULTS },
          request.signal,
          indexerIds,
        )) {
          send(event);
        }
      } catch (error) {
        // Client disconnects surface as an abort; nothing to report then.
        if (!request.signal.aborted) {
          send({
            type: "fatal",
            message:
              error instanceof Error ? error.message : "Search failed unexpectedly.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
