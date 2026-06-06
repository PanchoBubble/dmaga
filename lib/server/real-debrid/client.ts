import type {
  AddMagnetResponse,
  RealDebridDownload,
  RealDebridErrorPayload,
  RealDebridTorrent,
  RealDebridUser,
  UnrestrictLinkResponse,
} from "@/lib/server/real-debrid/types";
import { realDebridRateLimiter, RateLimiter } from "./rate-limiter";

type RealDebridClientOptions = {
  accessToken: string;
  fetcher?: typeof fetch;
  rateLimiter?: RateLimiter;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  searchParams?: URLSearchParams;
  body?: BodyInit;
};

export class RealDebridApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: RealDebridErrorPayload,
  ) {
    super(message);
    this.name = "RealDebridApiError";
  }
}

export class RealDebridClient {
  private readonly baseUrl = "https://api.real-debrid.com/rest/1.0";
  private readonly accessToken: string;
  private readonly fetcher: typeof fetch;
  private readonly rateLimiter: RateLimiter;

  constructor({
    accessToken,
    fetcher = fetch,
    rateLimiter = realDebridRateLimiter,
  }: RealDebridClientOptions) {
    this.accessToken = accessToken;
    this.fetcher = fetcher;
    this.rateLimiter = rateLimiter;
  }

  getUser() {
    return this.request<RealDebridUser>("/user");
  }

  listDownloads(params: { page?: number; limit?: number } = {}) {
    const searchParams = new URLSearchParams();

    if (params.page) {
      searchParams.set("page", String(params.page));
    }

    if (params.limit) {
      searchParams.set("limit", String(params.limit));
    }

    return this.request<RealDebridDownload[]>("/downloads", { searchParams });
  }

  deleteDownload(downloadId: string) {
    return this.request<Record<string, never>>(`/downloads/delete/${downloadId}`, {
      method: "DELETE",
    });
  }

  addMagnet(magnet: string) {
    const body = new URLSearchParams({ magnet });

    return this.request<AddMagnetResponse>("/torrents/addMagnet", {
      method: "POST",
      body,
    });
  }

  addTorrent(torrentFile: Blob) {
    return this.request<AddMagnetResponse>("/torrents/addTorrent", {
      method: "PUT",
      body: torrentFile,
    });
  }

  listTorrents(params: { page?: number; limit?: number } = {}) {
    const searchParams = new URLSearchParams();

    if (params.page) {
      searchParams.set("page", String(params.page));
    }

    if (params.limit) {
      searchParams.set("limit", String(params.limit));
    }

    return this.request<RealDebridTorrent[]>("/torrents", { searchParams });
  }

  selectAllFiles(torrentId: string) {
    const body = new URLSearchParams({ files: "all" });

    return this.request<Record<string, never>>(`/torrents/selectFiles/${torrentId}`, {
      method: "POST",
      body,
    });
  }

  getTorrent(torrentId: string) {
    return this.request<RealDebridTorrent>(`/torrents/info/${torrentId}`);
  }

  deleteTorrent(torrentId: string) {
    return this.request<Record<string, never>>(`/torrents/delete/${torrentId}`, {
      method: "DELETE",
    });
  }

  unrestrictLink(link: string) {
    const body = new URLSearchParams({ link });

    return this.request<UnrestrictLinkResponse>("/unrestrict/link", {
      method: "POST",
      body,
    });
  }

  private async request<T>(path: string, options: RequestOptions = {}) {
    await this.rateLimiter.waitForTurn();

    const url = new URL(`${this.baseUrl}${path}`);

    if (options.searchParams) {
      options.searchParams.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await this.fetcher(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(options.body instanceof URLSearchParams
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body: options.body,
    });

    if (!response.ok) {
      const payload = await parseErrorPayload(response);
      throw new RealDebridApiError(
        payload?.error ??
          `Real-Debrid request failed: ${response.status} ${response.statusText}`,
        response.status,
        payload,
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }
}

async function parseErrorPayload(response: Response) {
  try {
    return (await response.json()) as RealDebridErrorPayload;
  } catch {
    return undefined;
  }
}
