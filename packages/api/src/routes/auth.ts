import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma";
import { env } from "../env";
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
  // Tells the SPA whether the register link should show.
  app.get("/auth/config", async () => ({ allowSignup: env.ALLOW_SIGNUP }));

  if (env.ALLOW_SIGNUP) {
    // Registration creates a PENDING account and does NOT start a session — an
    // admin must approve it first. Keeps uninvited people from getting in.
    app.post("/auth/signup", async (req, reply) => {
      const body = signupSchema.parse(req.body);
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) return reply.code(409).send({ error: "EMAIL_TAKEN" });

      await prisma.user.create({
        data: {
          email: body.email,
          name: body.name,
          passwordHash: await hashPassword(body.password),
          role: "member",
          status: "pending",
        },
      });
      return reply.code(202).send({ status: "pending" });
    });
  }

  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }
    // Correct password but not yet approved → distinct, actionable status.
    if (user.status !== "active") {
      return reply.code(403).send({ error: "PENDING_APPROVAL" });
    }
    issueSession(app, reply, user);
    return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status };
  });

  app.post("/auth/logout", async (_req, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (req) => req.authUser);
}
