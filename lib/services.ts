export type RuntimeServiceId = "postgres" | "redis" | "flaresolverr";

export type RuntimeServiceTestResult = {
  id: RuntimeServiceId;
  ok: boolean;
  message: string;
};
