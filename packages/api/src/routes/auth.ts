import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma";
import { env, localEnabled, oidcEnabled } from "../env";
import {
  clearSessionCookie,
  hashPassword,
  issueSession,
  requireAuth,
  verifyPassword,
} from "../lib/session";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1).max(60),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Lets the SPA render only the login methods this deployment actually offers.
  app.get("/auth/config", async () => ({
    local: localEnabled,
    oidc: oidcEnabled,
    allowSignup: localEnabled && env.ALLOW_SIGNUP,
  }));

  if (localEnabled && env.ALLOW_SIGNUP) {
    app.post("/auth/signup", async (req, reply) => {
      const body = signupSchema.parse(req.body);
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) return reply.code(409).send({ error: "EMAIL_TAKEN" });

      const user = await prisma.user.create({
        data: {
          email: body.email,
          name: body.name,
          passwordHash: await hashPassword(body.password),
        },
      });
      issueSession(app, reply, user);
      return { id: user.id, email: user.email, name: user.name };
    });
  }

  if (localEnabled) {
    app.post("/auth/login", async (req, reply) => {
      const body = loginSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { email: body.email } });
      // Same 401 whether the account is missing, OIDC-only, or the password is
      // wrong — never reveal which.
      if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      }
      issueSession(app, reply, user);
      return { id: user.id, email: user.email, name: user.name };
    });
  }

  app.post("/auth/logout", async (_req, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (req) => req.authUser);
}
