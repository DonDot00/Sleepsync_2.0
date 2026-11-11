// Local development entry point: `npm run dev`
import { buildApp } from "./app.js";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // no .env — fine, env vars may come from the shell
}

const port = Number(process.env["PORT"] ?? 8000);
// Bound to localhost by default. Set HOST=0.0.0.0 if the iOS Shortcut must reach
// your PC over the LAN.
const host = process.env["HOST"] ?? "127.0.0.1";

buildApp()
  .listen({ port, host })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
