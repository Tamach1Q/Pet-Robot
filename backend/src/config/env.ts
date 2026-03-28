import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

export type Env = {
  port: number;
  host: string;
  storageMode: "memory" | "postgres";
  databaseUrl: string | null;
  openRouteServiceApiKey: string | null;
  openRouteServiceBaseUrl: string;
};

let envFilesLoaded = false;

function loadLocalEnvFiles() {
  if (envFilesLoaded) {
    return;
  }

  envFilesLoaded = true;

  const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const projectDir = resolve(backendDir, "..");
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
    resolve(backendDir, ".env.local"),
    resolve(backendDir, ".env"),
    resolve(projectDir, ".env.local"),
    resolve(projectDir, ".env"),
  ];
  const seen = new Set<string>();

  for (const filePath of candidates) {
    if (seen.has(filePath) || !existsSync(filePath)) {
      continue;
    }

    loadEnvFile(filePath);
    seen.add(filePath);
  }
}

export function loadEnv(): Env {
  loadLocalEnvFiles();

  const storageMode = process.env.STORAGE_MODE === "postgres" ? "postgres" : "memory";

  return {
    port: Number(process.env.PORT ?? 3002),
    host: process.env.HOST ?? "0.0.0.0",
    storageMode,
    databaseUrl: process.env.DATABASE_URL ?? null,
    openRouteServiceApiKey:
      process.env.ORS_API_KEY ?? process.env.OPENROUTESERVICE_API_KEY ?? null,
    openRouteServiceBaseUrl:
      process.env.OPENROUTESERVICE_BASE_URL ?? "https://api.openrouteservice.org",
  };
}
