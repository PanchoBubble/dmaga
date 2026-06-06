/**
 * Shared BitTorrent info-hash helpers used by every indexer adapter. Kept in
 * one module so the Cardigann and Torrentio adapters normalize and build
 * magnets identically (40-hex, upper-cased, `dn` display name).
 */

/** Returns the upper-cased hash only when it is a valid 40-char hex string. */
export function normalizeHash(value: string | undefined): string | undefined {
  const hash = value?.trim().toUpperCase();
  return hash && /^[A-F0-9]{40}$/.test(hash) ? hash : undefined;
}

/** Pulls the (normalized) info hash out of a `magnet:?xt=urn:btih:` URI. */
export function infoHashFromMagnet(magnetUrl: string | undefined): string | undefined {
  if (!magnetUrl) {
    return undefined;
  }
  const match = magnetUrl.match(/btih:([a-zA-Z0-9]+)/);
  return normalizeHash(match?.[1]);
}

/** Builds a bare magnet URI from an info hash, attaching a `dn` display name. */
export function magnetFromInfoHash(
  infoHash: string,
  title: string | undefined,
): string {
  const url = new URL(`magnet:?xt=urn:btih:${infoHash}`);
  if (title) {
    url.searchParams.set("dn", title);
  }
  return url.toString();
}
