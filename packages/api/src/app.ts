import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { ZodError } from "zod";
import { ScoringError } from "@tarot/shared";
import { env } from "./env";
import { prisma } from "./prisma";
import { SESSION_COOKIE } from "./lib/session";
import { authRoutes } from "./routes/auth";
import { oidcRoutes } from "./routes/oidc";
import { playerRoutes } from "./routes/players";
import { gameRoutes } from "./routes/games";
import { scoreboardRoutes } from "./routes/scoreboard";

/**
 * Build the fully wired Fastify app WITHOUT listening. index.ts calls listen();
 * tests can boot it in-process with app.inject().
 */
export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true });

  // Turn validation / domain errors into clean 400s instead of 500s.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "VALIDATION", issues: err.issues });
    }
    if (err instanceof ScoringError) {
      return reply.code(400).send({ error: "INVALID_GAME", message: err.message });
    }
    app.log.error(err);
    return reply
      .code(err.statusCode ?? 500)
      .send({ error: err.code ?? "INTERNAL_ERROR", message: err.message });
  });

  await app.register(cors, { origin: true, credentials: true });
  // Same secret signs the session JWT and the short-lived OIDC transaction cookie.
  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(jwt, {
    secret: env.SESSION_SECRET,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
  });

  app.get("/health", async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "ok" };
    } catch {
      return reply.code(503).send({ status: "ok", db: "down" });
    }
  });

  await app.register(authRoutes);
  await app.register(oidcRoutes);
  await app.register(playerRoutes);
  await app.register(gameRoutes);
  await app.register(scoreboardRoutes);

  return app;
}
