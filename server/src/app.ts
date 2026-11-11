import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { taskRoutes } from "./routes/tasks.js";
import { scheduleRoutes } from "./routes/schedule.js";
import { chatRoutes } from "./routes/chat.js";
import { sleepRoutes } from "./routes/sleep.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: process.env["NODE_ENV"] !== "test", routerOptions: { ignoreTrailingSlash: true } });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(422).send({ detail: err.issues });
    }
    app.log.error(err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.code(status).send({ detail: status === 500 ? "Internal server error" : (err as Error).message });
  });

  app.register(taskRoutes, { prefix: "/api/tasks" });
  app.register(scheduleRoutes, { prefix: "/api/schedule" });
  app.register(chatRoutes, { prefix: "/api/chat" });
  app.register(sleepRoutes, { prefix: "/api/sleep" });

  return app;
}
