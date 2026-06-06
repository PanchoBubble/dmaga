import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/server/env";
import * as schema from "@/lib/db/schema";

const globalForDb = globalThis as unknown as {
  dmagaPostgres?: postgres.Sql;
};

const sql =
  globalForDb.dmagaPostgres ??
  postgres(env.DATABASE_URL, {
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.dmagaPostgres = sql;
}

export const db = drizzle(sql, { schema });
