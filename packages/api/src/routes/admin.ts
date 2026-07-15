import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAdmin } from "../lib/session";

const publicUser = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

/** Refuse an operation that would leave the app with zero admins. */
async function wouldOrphanAdmins(targetId: string): Promise<boolean> {
  const remaining = await prisma.user.count({
    where: { role: "admin", status: "active", id: { not: targetId } },
  });
  return remaining === 0;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Every route here is admin-only.
  app.get("/admin/users", { preHandler: requireAdmin }, async () =>
    prisma.user.findMany({
      select: publicUser,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
  );

  // Approve a pending sign-up → the account can now log in.
  app.post("/admin/users/:id/approve", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "NOT_FOUND" });
    return prisma.user.update({
      where: { id },
      data: { status: "active" },
      select: publicUser,
    });
  });

  // Promote / demote. Promoting also activates the account; demoting the last
  // admin is refused so the app can never lock itself out.
  app.post("/admin/users/:id/role", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { role } = z.object({ role: z.enum(["admin", "member"]) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "NOT_FOUND" });
    if (role === "member" && user.role === "admin" && (await wouldOrphanAdmins(id))) {
      return reply.code(409).send({ error: "LAST_ADMIN" });
    }
    return prisma.user.update({
      where: { id },
      // A promoted admin must be active to be useful.
      data: role === "admin" ? { role, status: "active" } : { role },
      select: publicUser,
    });
  });

  // Delete an account (e.g. the temporary bootstrap admin, once a real one
  // exists). Never delete the last admin, and never someone who has played:
  // members *are* players, so dropping them would tear holes in past
  // leaderboards. Demote or leave them inactive instead.
  app.delete("/admin/users/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "NOT_FOUND" });
    if (user.role === "admin" && (await wouldOrphanAdmins(id))) {
      return reply.code(409).send({ error: "LAST_ADMIN" });
    }
    const games = await prisma.gamePlayer.count({ where: { userId: id } });
    if (games > 0) return reply.code(409).send({ error: "USER_HAS_GAMES", games });
    await prisma.user.delete({ where: { id } });
    return { ok: true };
  });
}
