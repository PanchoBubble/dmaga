import "server-only";

import { env } from "@/lib/server/env";

/**
 * Minimal client for the qBittorrent WebUI API (v2), used by the non-debrid
 * torrent download path. Auth is cookie-based: {@link login} captures the `SID`
 * cookie and subsequent requests replay it, re-logging in once on a 403.
 *
 * We deliberately send no `Origin`/`Referer` headers — qBittorrent's CSRF guard
 * only rejects requests that *carry* a mismatching one, so a bare server-side
 * call passes. Host-header validation defaults to `*` (all domains), so calling
 * via `gluetun:8080` works.
 */
export class QBittorrentError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "QBittorrentError";
  }
}

/** A torrent as reported by `/torrents/info`. Progress is 0–1. */
export type QbTorrent = {
  hash: string;
  name: string;
  state: string;
  progress: number;
  size: number;
  /** Directory the torrent saves into (what we passed as `savepath`). */
  save_path: string;
  /** Absolute path to the torrent's root (single file or top folder). */
  content_path: string;
  amount_left: number;
};

/** A file within a torrent. `name` is relative to {@link QbTorrent.save_path}. */
export type QbFile = {
  name: string;
  size: number;
  progress: number;
  index: number;
};

type QbConfig = {
  baseUrl?: string;
  username?: string;
  password?: string;
  fetcher?: typeof fetch;
};

type RequestInitLite = {
  method?: "GET" | "POST";
  body?: BodyInit;
  searchParams?: URLSearchParams;
};

export class QBittorrentClient {
  private readonly baseUrl: string;
  private readonly username: string | undefined;
  private readonly password: string | undefined;
  private readonly fetcher: typeof fetch;
  private cookie: string | null = null;

  constructor(config: QbConfig = {}) {
    this.baseUrl = (config.baseUrl ?? env.QBITTORRENT_URL).replace(/\/+$/, "");
    this.username = config.username ?? env.QBITTORRENT_USERNAME;
    this.password = config.password ?? env.QBITTORRENT_PASSWORD;
    this.fetcher = config.fetcher ?? fetch;
  }

  /** True when credentials are present; the add path checks this up front. */
  isConfigured(): boolean {
    return Boolean(this.username && this.password);
  }

  /**
   * Adds a magnet, saving into `savePath` under the given `category`. Returns
   * nothing useful (qBittorrent answers "Ok."); track the result by its info
   * hash via {@link getTorrent}.
   */
  async addMagnet(
    magnet: string,
    options: { savePath: string; category?: string },
  ): Promise<void> {
    const form = new FormData();
    form.set("urls", magnet);
    form.set("savepath", options.savePath);
    form.set("autoTMM", "false");
    if (options.category) {
      form.set("category", options.category);
    }

    const text = await this.requestText("/torrents/add", { method: "POST", body: form });
    if (text.trim().toLowerCase().startsWith("fail")) {
      throw new QBittorrentError("qBittorrent rejected the magnet.");
    }
  }

  /** Fetches a single torrent by (lowercase) info hash, or null if unknown. */
  async getTorrent(hash: string): Promise<QbTorrent | null> {
    const searchParams = new URLSearchParams({ hashes: hash.toLowerCase() });
    const torrents = await this.requestJson<QbTorrent[]>("/torrents/info", {
      searchParams,
    });
    return torrents[0] ?? null;
  }

  /** Lists the files of a torrent (relative paths under its save_path). */
  async getFiles(hash: string): Promise<QbFile[]> {
    const searchParams = new URLSearchParams({ hash: hash.toLowerCase() });
    return this.requestJson<QbFile[]>("/torrents/files", { searchParams });
  }

  /** Removes a torrent, optionally deleting its files from disk. */
  async deleteTorrent(hash: string, deleteFiles: boolean): Promise<void> {
    const form = new FormData();
    form.set("hashes", hash.toLowerCase());
    form.set("deleteFiles", deleteFiles ? "true" : "false");
    await this.requestText("/torrents/delete", { method: "POST", body: form });
  }

  /** Authenticates and caches the SID cookie. */
  private async login(): Promise<void> {
    if (!this.username || !this.password) {
      throw new QBittorrentError(
        "qBittorrent is not configured (set QBITTORRENT_USERNAME/PASSWORD).",
        503,
      );
    }

    const body = new URLSearchParams({
      username: this.username,
      password: this.password,
    });
    const response = await this.fetcher(`${this.baseUrl}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const text = await response.text();
    if (!response.ok || text.trim().toLowerCase() !== "ok.") {
      throw new QBittorrentError(
        `qBittorrent login failed (${response.status}).`,
        response.status === 403 ? 401 : 502,
      );
    }

    const setCookie = response.headers.get("set-cookie");
    const sid = setCookie?.match(/SID=[^;]+/)?.[0];
    if (!sid) {
      throw new QBittorrentError("qBittorrent login returned no session cookie.");
    }
    this.cookie = sid;
  }

  private async send(path: string, init: RequestInitLite): Promise<Response> {
    if (!this.cookie) {
      await this.login();
    }

    const url = new URL(`${this.baseUrl}/api/v2${path}`);
    if (init.searchParams) {
      url.search = init.searchParams.toString();
    }

    const doFetch = () =>
      this.fetcher(url.toString(), {
        method: init.method ?? "GET",
        body: init.body,
        headers: this.cookie ? { Cookie: this.cookie } : undefined,
      });

    let response = await doFetch();
    // Session expired — re-authenticate once and retry.
    if (response.status === 403) {
      this.cookie = null;
      await this.login();
      response = await doFetch();
    }

    if (!response.ok) {
      throw new QBittorrentError(
        `qBittorrent request failed: ${response.status} ${response.statusText}`,
        response.status,
      );
    }
    return response;
  }

  private async requestText(path: string, init: RequestInitLite): Promise<string> {
    return (await this.send(path, init)).text();
  }

  private async requestJson<T>(path: string, init: RequestInitLite): Promise<T> {
    return (await this.send(path, init)).json() as Promise<T>;
  }
}

/**
 * qBittorrent states that mean the download has finished (seeding/complete) vs.
 * still working. See https://github.com/qbittorrent/qBittorrent WebUI API docs.
 */
const COMPLETED_STATES = new Set([
  "uploading",
  "pausedUP",
  "queuedUP",
  "stalledUP",
  "forcedUP",
  "checkingUP",
]);

const ERROR_STATES = new Set(["error", "missingFiles"]);

export function isQbCompleted(state: string): boolean {
  return COMPLETED_STATES.has(state);
}

export function isQbErrored(state: string): boolean {
  return ERROR_STATES.has(state);
}
