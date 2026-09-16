import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: string | number }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    credentials: true,
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);


if (process.env.NODE_ENV === "production") {
  // Só confie em headers de proxy quando realmente houver um proxy HTTPS na frente.
  if (process.env.COOKIE_SECURE === "true") {
    app.set("trust proxy", 1);
  }

  const clientDir = path.resolve(process.cwd(), "dist/public");

  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));


    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(clientDir, "index.html"));
    });
  } else {
    logger.warn(
      { clientDir },
      "Build do front-end não encontrado; servindo apenas a API",
    );
  }
}

export default app;
