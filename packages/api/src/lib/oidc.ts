import { Issuer, generators, type Client } from "openid-client";
import { env } from "../env";

export const OIDC_REDIRECT_URI = `${env.API_PUBLIC_URL}/auth/oidc/callback`;
// Short-lived signed cookie carrying the PKCE state+verifier across the redirect.
export const OIDC_TX_COOKIE = "tarot_oidc_tx";

// Discovery is a network call; do it once and cache the configured client.
let clientPromise: Promise<Client> | null = null;

export function getOidcClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Issuer.discover(env.OIDC_ISSUER as string).then(
      (issuer) =>
        new issuer.Client({
          client_id: env.OIDC_CLIENT_ID as string,
          client_secret: env.OIDC_CLIENT_SECRET as string,
          redirect_uris: [OIDC_REDIRECT_URI],
          response_types: ["code"],
        }),
    );
  }
  return clientPromise;
}

export const pkce = {
  verifier: () => generators.codeVerifier(),
  challenge: (verifier: string) => generators.codeChallenge(verifier),
  state: () => generators.state(),
};
