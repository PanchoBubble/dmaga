import { NextResponse } from "next/server";

import { env } from "@/lib/server/env";

export function GET() {
  return NextResponse.json({
    ok: true,
    services: {
      database: Boolean(env.DATABASE_URL),
      redis: Boolean(env.REDIS_URL),
      flaresolverr: Boolean(env.FLARESOLVERR_URL),
    },
  });
}
