import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../lib/session";

// Every column is cast in SQL (::int / ::float8) so nothing comes back as a
// BigInt or Decimal that JSON.stringify would choke on.
interface Row {
  id: string;
  name: string;
  games: number;
  total: number;
  mean: number;
  std: number;
  best: number;
  worst: number;
  takerCount: number;
}

export async function scoreboardRoutes(app: FastifyInstance): Promise<void> {
  // Aggregated leaderboard / per-player stats, optionally scoped to one month.
  app.get("/scoreboard", { preHandler: requireAuth }, async (req) => {
    const { month } = z
      .object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() })
      .parse(req.query);

    let where: Prisma.Sql = Prisma.empty;
    if (month) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));
      where = Prisma.sql`WHERE g."playedAt" >= ${start} AND g."playedAt" < ${end}`;
    }

    return prisma.$queryRaw<Row[]>`
      SELECT
        p.id,
        p.name,
        COUNT(*)::int                                            AS games,
        SUM(gp.score)::int                                       AS total,
        ROUND(AVG(gp.score)::numeric, 1)::float8                 AS mean,
        COALESCE(STDDEV_SAMP(gp.score), 0)::float8               AS std,
        MAX(gp.score)::int                                       AS best,
        MIN(gp.score)::int                                       AS worst,
        SUM(CASE WHEN g."takerId" = p.id THEN 1 ELSE 0 END)::int AS "takerCount"
      FROM "Player" p
      JOIN "GamePlayer" gp ON gp."playerId" = p.id
      JOIN "Game" g        ON g.id = gp."gameId"
      ${where}
      GROUP BY p.id, p.name
      ORDER BY total DESC, games DESC`;
  });

  // Distinct months that have games — powers the month selector on the client.
  app.get("/scoreboard/months", { preHandler: requireAuth }, async () => {
    const rows = await prisma.$queryRaw<{ month: string }[]>`
      SELECT DISTINCT to_char("playedAt", 'YYYY-MM') AS month
      FROM "Game"
      ORDER BY month DESC`;
    return rows.map((r) => r.month);
  });
}
