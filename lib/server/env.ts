import { z } from "zod";

/**
 * Treat blank env vars as unset. Compose passes `${VAR:-}` and `.env` ships
 * `VAR=""` placeholders, so optional secrets arrive as empty strings rather
 * than undefined — which defeats `?? fallback` chains downstream.
 */
const optionalSecret = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://dmaga:dmaga@localhost:5432/dmaga"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  FLARESOLVERR_URL: z.string().default("http://localhost:8191/v1"),
  /**
   * HTTP proxy for outbound indexer lookups only. In the Compose stack this
   * points at a proxy that egresses through the NordVPN container, so indexer
   * search traffic is the only thing routed over the VPN. Unset → direct.
   */
  INDEXER_PROXY_URL: optionalSecret,
  REAL_DEBRID_CLIENT_ID: optionalSecret,
  REAL_DEBRID_CLIENT_SECRET: optionalSecret,
  MYANIMELIST_CLIENT_ID: optionalSecret,
  MYANIMELIST_CLIENT_SECRET: optionalSecret,
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  TOKEN_ENCRYPTION_KEY: optionalSecret,
  HOST_DOWNLOAD_DIR: z.string().default("./downloads"),
});

export const env = envSchema.parse(process.env);
