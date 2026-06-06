import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

import { env } from "@/lib/server/env";

const algorithm = "aes-256-gcm";

function getKey() {
  if (!env.TOKEN_ENCRYPTION_KEY) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required for encrypted token storage.");
  }

  return scryptSync(env.TOKEN_ENCRYPTION_KEY, "dmaga-token-store", 32);
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string) {
  const [iv, authTag, encrypted] = value.split(".");

  if (!iv || !authTag || !encrypted) {
    throw new Error("Encrypted secret payload is invalid.");
  }

  const decipher = createDecipheriv(algorithm, getKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
