import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

async function main() {
  const env = loadEnv();
  const app = await buildApp();

  await app.listen({
    port: env.port,
    host: env.host,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
