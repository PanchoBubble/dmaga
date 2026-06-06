import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://dmaga:dmaga@localhost:5432/dmaga"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  FLARESOLVERR_URL: z.string().default("http://localhost:8191/v1"),
  REAL_DEBRID_CLIENT_ID: z.string().optional(),
  REAL_DEBRID_CLIENT_SECRET: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  HOST_DOWNLOAD_DIR: z.string().default("./downloads"),
});

export const env = envSchema.parse(process.env);
