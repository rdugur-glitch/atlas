import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cookieParser());
app.use(express.json({ limit: "64kb" }));
app.use(clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
})));

app.use("/api", router);
// Keep unknown API routes out of the SPA fallback.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API adresi bulunamadı." });
});

if (process.env.NODE_ENV === "production") {
  // The same Node process can serve the built web app and API on 8080.
  // Resolve from the deployed bundle, not a development working directory.
  const publicDir = fileURLToPath(new URL("../../atlas/dist/public/", import.meta.url));
  const indexFile = path.join(publicDir, "index.html");
  if (!existsSync(indexFile)) {
    throw new Error("ATLAS production web build is missing. Build artifacts/atlas before starting the production API.");
  }
  app.use(express.static(publicDir, { index: false, dotfiles: "deny" }));
  app.use((req, res) => {
    if ((req.method === "GET" || req.method === "HEAD") && req.accepts("html") && !path.extname(req.path)) {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexFile);
    } else {
      res.status(404).json({ error: "Adres bulunamadı." });
    }
  });
}
app.use(((error, req, res, _next) => {
  const tooLarge = error?.type === "entity.too.large";
  const malformed = error?.type === "entity.parse.failed";
  if (!tooLarge && !malformed) req.log.error({ type: error?.name }, "Request failed");
  res.status(tooLarge ? 413 : malformed ? 400 : 500).json({
    error: tooLarge ? "İstek çok büyük. Metninizi kısaltıp yeniden deneyin." : malformed ? "İstek okunamadı. Sayfayı yenileyip yeniden deneyin." : "Sunucu işlemi tamamlayamadı. Biraz sonra yeniden deneyin.",
  });
}) as express.ErrorRequestHandler);

export default app;
