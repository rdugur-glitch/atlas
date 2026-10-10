import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "apiKey",
    "*.apiKey",
    "req.body",
    "req.headers['x-api-key']",
    "headers['x-api-key']",
    "headers.authorization",
    "headers.Authorization",
    "Authorization",
    "authorization",
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
