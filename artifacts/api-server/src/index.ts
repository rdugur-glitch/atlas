import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { ensureAccountSchema } from "./lib/atlas-account";
import { assertProductionConfig } from "./lib/startup-config";

assertProductionConfig();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await ensureAccountSchema();
const server = app.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Release the listener and DB connections on managed workflow/deployment stop.
// Never reset workspace data or credentials during shutdown.
let stopping = false;
function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "Server shutting down");
  const deadline = setTimeout(() => {
    logger.error("Graceful shutdown timed out");
    server.closeAllConnections();
    process.exit(1);
  }, 25000).unref();
  server.close(() => {
    void pool.end().then(() => {
      clearTimeout(deadline);
      process.exit(0);
    }).catch(() => {
      logger.error("Database connection shutdown failed");
      process.exit(1);
    });
  });
  server.closeIdleConnections();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
