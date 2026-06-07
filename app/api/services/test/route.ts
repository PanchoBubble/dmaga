import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { testRuntimeService } from "@/lib/server/runtime-services";

const serviceTestSchema = z.object({
  id: z.enum(["postgres", "redis", "flaresolverr"]),
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = serviceTestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  return NextResponse.json(await testRuntimeService(parsed.data.id));
}
