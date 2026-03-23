import cors from "@fastify/cors";
import Fastify from "fastify";
import { createContainer } from "./container.js";
import { NotFoundError } from "./lib/errors.js";
import { registerRoutes } from "./routes/index.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: [
      "http://127.0.0.1:3001",
      "http://localhost:3001",
    ],
  });

  const container = createContainer();

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  await registerRoutes(app, container.controllers);

  app.addHook("onClose", async () => {
    await container.cleanup();
  });

  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (error instanceof NotFoundError) {
      reply.status(404).send({
        status: "error",
        message,
      });
      return;
    }

    reply.status(500).send({
      status: "error",
      message,
    });
  });

  return app;
}
