import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../lib/session";

export async function playerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/players", { preHandler: requireAuth }, async () =>
    prisma.player.findMany({ orderBy: { name: "asc" } }),
  );

  app.post("/players", { preHandler: requireAuth }, async (req, reply) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(40) }).parse(req.body);
    const existing = await prisma.player.findUnique({ where: { name } });
    if (existing) return reply.code(409).send({ error: "PLAYER_EXISTS" });
    return prisma.player.create({ data: { name } });
  });

  // Deletable only while they have no recorded games — otherwise their past
  // scores would silently vanish from every leaderboard.
  app.delete("/players/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const games = await prisma.gamePlayer.count({ where: { playerId: id } });
    if (games > 0) return reply.code(409).send({ error: "PLAYER_HAS_GAMES", games });
    await prisma.player.delete({ where: { id } });
    return { ok: true };
  });
}
