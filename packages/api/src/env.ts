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

  // Registration is open by default; set false to freeze sign-ups entirely.
  ALLOW_SIGNUP: boolString("true"),

  // Bootstrap admin. On startup, if no admin exists yet, one is created from
  // these credentials (see lib/bootstrap). Optional so you can run without it
  // once a real admin has been promoted.
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 chars").optional(),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
