import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { isProd } from "../env";

export const SESSION_COOKIE = "tarot_session";
export const SESSION_TTL_S = 7 * 24 * 60 * 60; // 7 days

/** What we sign into the session cookie and hang on `request.authUser`. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
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
    payload: { sub: string; email: string; name: string };
    user: { sub: string; email: string; name: string };
  }
}

/** Set the httpOnly session cookie holding a signed JWT for `user`. */
export function setSessionCookie(
  reply: FastifyReply,
  token: string,
): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    // `lax` still sends the cookie on the top-level GET redirect back from the
    // IdP, so the SSO round-trip keeps working.
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/**
 * preHandler: require a valid session. Reads the JWT from the cookie (configured
 * on the @fastify/jwt plugin), populates `request.authUser`, else 401s.
 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const payload = await req.jwtVerify<{ sub: string; email: string; name: string }>();
    req.authUser = { id: payload.sub, email: payload.email, name: payload.name };
  } catch {
    return reply.code(401).send({ error: "UNAUTHORIZED" });
  }
}

/** Sign a session JWT for `user` and drop it in the httpOnly cookie. */
export function issueSession(
  app: FastifyInstance,
  reply: FastifyReply,
  user: SessionUser,
): void {
  const token = app.jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    { expiresIn: SESSION_TTL_S },
  );
  setSessionCookie(reply, token);
}

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
