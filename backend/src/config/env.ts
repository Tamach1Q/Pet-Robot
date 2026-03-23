export type Env = {
  port: number;
  host: string;
  storageMode: "memory" | "postgres";
  databaseUrl: string | null;
  openRouteServiceApiKey: string | null;
  openRouteServiceBaseUrl: string;
};

export function loadEnv(): Env {
  const storageMode = process.env.STORAGE_MODE === "postgres" ? "postgres" : "memory";

  return {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? "0.0.0.0",
    storageMode,
    databaseUrl: process.env.DATABASE_URL ?? null,
    openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY ?? null,
    openRouteServiceBaseUrl:
      process.env.OPENROUTESERVICE_BASE_URL ?? "https://api.openrouteservice.org",
  };
}
