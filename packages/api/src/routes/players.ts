import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireAuth } from "../lib/session";

/**
 * The people who can be seated in a game: every approved member. There is no
 * separate roster and nothing to create here — you become a player by
 * registering an account and having an admin approve it (see routes/admin).
 * One-off visitors sit as guests instead, and are never recorded.
 */
export async function playerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/players", { preHandler: requireAuth }, async () =>
    prisma.user.findMany({
      where: { status: "active" },
      select: { id: true, name: true, createdAt: true },
      orderBy: { name: "asc" },
    }),
  );
}
