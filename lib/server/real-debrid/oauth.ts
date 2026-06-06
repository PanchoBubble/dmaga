import type {
  RealDebridDeviceCredentialsResponse,
  RealDebridDeviceCodeResponse,
  RealDebridErrorPayload,
  RealDebridTokenResponse,
} from "@/lib/server/real-debrid/types";
import { realDebridRateLimiter, RateLimiter } from "./rate-limiter";

const oauthBaseUrl = "https://api.real-debrid.com/oauth/v2";
const deviceGrantType = "http://oauth.net/grant_type/device/1.0";

type OAuthClientOptions = {
  clientId: string;
  clientSecret?: string;
  fetcher?: typeof fetch;
  rateLimiter?: RateLimiter;
};

type OAuthCredentials = {
  clientId: string;
  clientSecret?: string;
};

export class RealDebridOAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: RealDebridErrorPayload,
  ) {
    super(message);
    this.name = "RealDebridOAuthError";
  }
}

export class RealDebridOAuthClient {
  private readonly clientId: string;
  private readonly clientSecret?: string;
  private readonly fetcher: typeof fetch;
  private readonly rateLimiter: RateLimiter;

  constructor({
    clientId,
    clientSecret,
    fetcher = fetch,
    rateLimiter = realDebridRateLimiter,
  }: OAuthClientOptions) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.fetcher = fetcher;
    this.rateLimiter = rateLimiter;
  }

  async createDeviceCode(options: { newCredentials?: boolean } = {}) {
    const searchParams = new URLSearchParams({ client_id: this.clientId });

    if (options.newCredentials) {
      searchParams.set("new_credentials", "yes");
    }

    return this.request<RealDebridDeviceCodeResponse>(
      `/device/code?${searchParams.toString()}`,
      { method: "GET" },
    );
  }

  getDeviceCredentials(deviceCode: string) {
    const searchParams = new URLSearchParams({
      client_id: this.clientId,
      code: deviceCode,
    });

    return this.request<RealDebridDeviceCredentialsResponse>(
      `/device/credentials?${searchParams.toString()}`,
      { method: "GET" },
    );
  }

  async exchangeDeviceCode(deviceCode: string, credentials?: OAuthCredentials) {
    return this.exchangeCode(deviceCode, credentials);
  }

  async refreshAccessToken(refreshToken: string, credentials?: OAuthCredentials) {
    return this.exchangeCode(refreshToken, credentials);
  }

  private exchangeCode(code: string, credentials?: OAuthCredentials) {
    const body = new URLSearchParams({
      client_id: credentials?.clientId ?? this.clientId,
      code,
      grant_type: deviceGrantType,
    });

    const clientSecret = credentials?.clientSecret ?? this.clientSecret;

    if (clientSecret) {
      body.set("client_secret", clientSecret);
    }

    return this.request<RealDebridTokenResponse>("/token", {
      method: "POST",
      body,
    });
  }

  private async request<T>(
    path: string,
    options: { method: "GET" | "POST"; body?: URLSearchParams },
  ) {
    await this.rateLimiter.waitForTurn();

    const response = await this.fetcher(`${oauthBaseUrl}${path}`, {
      method: options.method,
      headers: options.body
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : undefined,
      body: options.body,
    });

    if (!response.ok) {
      const payload = await parseErrorPayload(response);
      throw new RealDebridOAuthError(
        payload?.error ??
          `Real-Debrid OAuth request failed: ${response.status} ${response.statusText}`,
        response.status,
        payload,
      );
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
