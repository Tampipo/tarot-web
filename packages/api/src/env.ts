import { z } from "zod";

/** Parse "true"/"false" env strings into real booleans (z.coerce.boolean is truthy-only). */
const boolString = (def: "true" | "false") =>
  z.enum(["true", "false"]).default(def).transform((v) => v === "true");

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  // Cookie/JWT signing secret — generate with `openssl rand -hex 32`.
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default("development"),

  // Browser-facing base URL of THIS api. The OIDC redirect_uri is
  // `${API_PUBLIC_URL}/auth/oidc/callback`, so it points at where nginx exposes
  // the api (e.g. http://localhost:8080/api).
  API_PUBLIC_URL: z.string().default("http://localhost:8080/api"),
  // Where to bounce the browser after a successful login / SSO.
  WEB_ORIGIN: z.string().default("http://localhost:8080"),

  AUTH_MODE: z.enum(["local", "oidc", "both"]).default("both"),
  ALLOW_SIGNUP: boolString("true"),

  OIDC_ISSUER: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_SCOPES: z.string().default("openid profile email"),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";

// Password login is available unless the deployment is OIDC-only.
export const localEnabled = env.AUTH_MODE !== "oidc";

// SSO is available only when it is turned on AND fully configured — a half-set
// OIDC block silently stays off rather than crashing at first login.
export const oidcEnabled =
  env.AUTH_MODE !== "local" &&
  Boolean(env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET);

if (env.AUTH_MODE === "oidc" && !oidcEnabled) {
  throw new Error("AUTH_MODE=oidc but OIDC_ISSUER/CLIENT_ID/CLIENT_SECRET are incomplete.");
}
