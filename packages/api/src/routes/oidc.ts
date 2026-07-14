import type { FastifyInstance } from "fastify";
import { env, isProd, oidcEnabled } from "../env";
import { getOidcClient, OIDC_REDIRECT_URI, OIDC_TX_COOKIE, pkce } from "../lib/oidc";
import { prisma } from "../prisma";
import { issueSession } from "../lib/session";

export async function oidcRoutes(app: FastifyInstance): Promise<void> {
  // Registers nothing when SSO is off, so the routes 404 instead of throwing.
  if (!oidcEnabled) return;

  // Kick off the auth-code + PKCE flow; stash state+verifier in a signed cookie.
  app.get("/auth/oidc/start", async (_req, reply) => {
    const client = await getOidcClient();
    const state = pkce.state();
    const verifier = pkce.verifier();
    const url = client.authorizationUrl({
      scope: env.OIDC_SCOPES,
      state,
      code_challenge: pkce.challenge(verifier),
      code_challenge_method: "S256",
    });
    reply.setCookie(OIDC_TX_COOKIE, JSON.stringify({ state, verifier }), {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      signed: true,
    });
    return reply.redirect(url);
  });

  app.get("/auth/oidc/callback", async (req, reply) => {
    const raw = req.cookies[OIDC_TX_COOKIE];
    if (!raw) return reply.code(400).send({ error: "OIDC_NO_TX" });
    const unsigned = req.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) {
      return reply.code(400).send({ error: "OIDC_BAD_TX" });
    }
    reply.clearCookie(OIDC_TX_COOKIE, { path: "/" });
    const { state, verifier } = JSON.parse(unsigned.value) as {
      state: string;
      verifier: string;
    };

    const client = await getOidcClient();
    const params = client.callbackParams(req.raw);
    const tokenSet = await client.callback(OIDC_REDIRECT_URI, params, {
      state,
      code_verifier: verifier,
    });

    const claims = tokenSet.claims();
    const sub = claims.sub;
    const email = claims.email ?? `${sub}@oidc.local`;
    const name =
      (typeof claims.name === "string" && claims.name) ||
      (typeof claims.preferred_username === "string" && claims.preferred_username) ||
      email;

    // Match on the IdP subject first; otherwise adopt a local account that
    // already owns this email (links the two identities), else create fresh.
    let user = await prisma.user.findUnique({ where: { oidcSub: sub } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      user = byEmail
        ? await prisma.user.update({ where: { id: byEmail.id }, data: { oidcSub: sub } })
        : await prisma.user.create({ data: { email, name, oidcSub: sub } });
    }

    issueSession(app, reply, user);
    return reply.redirect(env.WEB_ORIGIN);
  });
}
