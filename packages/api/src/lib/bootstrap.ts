import { prisma } from "../prisma";
import { env } from "../env";
import { hashPassword } from "./session";

/**
 * Ensure at least one admin exists. Runs on startup: if there are no admins and
 * ADMIN_EMAIL/ADMIN_PASSWORD are set, (re)create that account as an active
 * admin. Because it only fires when zero admins remain, promoting a real user
 * and deleting this bootstrap account is permanent — a restart won't recreate
 * it — while still acting as a break-glass if every admin is ever removed.
 */
export async function ensureAdmin(log?: {
  info: (msg: string) => void;
  warn: (msg: string) => void;
}): Promise<void> {
  const admins = await prisma.user.count({ where: { role: "admin" } });
  if (admins > 0) return;

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    log?.warn(
      "No admin account exists and ADMIN_EMAIL/ADMIN_PASSWORD are not set — nobody can approve sign-ups.",
    );
    return;
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: { role: "admin", status: "active", passwordHash },
    create: {
      email: env.ADMIN_EMAIL,
      name: "Admin",
      role: "admin",
      status: "active",
      passwordHash,
    },
  });
  log?.info(`Bootstrapped admin account for ${env.ADMIN_EMAIL}`);
}
