// Test-only identity fixture. This module is never imported by app.ts/index.ts.
// Production always uses the real Clerk middleware; there is no env/header bypass.
import express from "express";
import cookieParser from "cookie-parser";
import accountRouter from "../routes/account";
import atlasRouter from "../routes/atlas";
export function testApp(defaultUser: string) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.get("x-fixture-user") || defaultUser;
    const auth = () => ({ userId: userId === "anonymous" ? null : userId, sessionId: req.get("x-fixture-session") || `fixture:${userId}`, tokenType: "session_token", isAuthenticated: userId !== "anonymous" });
    Object.assign(auth, { [Symbol.for("@clerk/express.auth")]: true });
    (req as any).auth = auth;
    (req as any).log = { error: () => {} };
    next();
  });
  app.use("/api/atlas/account", accountRouter);
  app.use("/api/atlas", atlasRouter);
  return app;
}
