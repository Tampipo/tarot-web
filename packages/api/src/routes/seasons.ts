import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAdmin, requireAuth } from "../lib/session";
import { currentSeason, getSettings, startNewSeason } from "../lib/seasons";

export async function seasonRoutes(app: FastifyInstance): Promise<void> {
  // Every season, newest first, with how many games each holds. Rolls the
  // current season over first if it has come due.
  app.get("/seasons", { preHandler: requireAuth }, async () => {
    const current = await currentSeason();
    const seasons = await prisma.season.findMany({
      orderBy: { startedAt: "desc" },
      include: { _count: { select: { games: true } } },
    });
    return seasons.map((s) => ({
      id: s.id,
      name: s.name,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      games: s._count.games,
      current: s.id === current.id,
    }));
  });

  // How often the scoreboard resets. Readable by anyone signed in so the UI can
  // explain the current cadence; only admins may change it.
  app.get("/settings", { preHandler: requireAuth }, async () => {
    const s = await getSettings();
    return { seasonPeriodMonths: s.seasonPeriodMonths };
  });

  app.put("/admin/settings", { preHandler: requireAdmin }, async (req) => {
    const { seasonPeriodMonths } = z
      .object({ seasonPeriodMonths: z.number().int().min(1).max(120).nullable() })
      .parse(req.body);
    const s = await prisma.settings.upsert({
      where: { id: "singleton" },
      update: { seasonPeriodMonths },
      create: { id: "singleton", seasonPeriodMonths },
    });
    // Applying a shorter period may make the open season due immediately.
    await currentSeason();
    return { seasonPeriodMonths: s.seasonPeriodMonths };
  });

  // Manual score reset: close the open season, start a new one.
  app.post("/admin/seasons", { preHandler: requireAdmin }, async (req) => {
    const { name } = z
      .object({ name: z.string().trim().max(60).optional() })
      .parse(req.body ?? {});
    return startNewSeason(name);
  });
}
