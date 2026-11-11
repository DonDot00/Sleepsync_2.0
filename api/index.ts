// Vercel serverless entry point — every /api/* request lands here.
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../server/src/app.js";

const app = buildApp();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await app.ready();
  app.server.emit("request", req, res);
}
