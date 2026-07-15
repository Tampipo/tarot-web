import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { isProd } from "../env";

export const SESSION_COOKIE = "tarot_session";
export const SESSION_TTL_S = 7 * 24 * 60 * 60; // 7 days

/** The current principal, resolved fresh from the DB on every request. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string; // "admin" | "member"
  status: string; // "active" | "pending"
}

// `request.user` is owned by @fastify/jwt (the raw verified payload); we expose
// our resolved user under a separate property to avoid clashing with it.
declare module "fastify" {
  interface FastifyRequest {
    authUser?: SessionUser;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

/** Set the httpOnly session cookie holding a signed JWT for `user`. */
export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/**
 * preHandler: require a valid session AND an active account. The JWT only
 * carries the user id, so role/status are read live — an account that gets
 * deactivated or deleted loses access on its very next request.
 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  let sub: string;
  try {
    ({ sub } = await req.jwtVerify<{ sub: string }>());
  } catch {
    return reply.code(401).send({ error: "UNAUTHORIZED" });
  }
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user || user.status !== "active") {
    return reply.code(401).send({ error: "UNAUTHORIZED" });
  }
  req.authUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

/** preHandler: 403 unless the (already-authenticated) caller is an admin. */
export async function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.authUser?.role !== "admin") {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }
}

/** Sign a session JWT for `user` and drop it in the httpOnly cookie. */
export function issueSession(
  app: FastifyInstance,
  reply: FastifyReply,
  user: { id: string },
): void {
  const token = app.jwt.sign({ sub: user.id }, { expiresIn: SESSION_TTL_S });
  setSessionCookie(reply, token);
}

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
