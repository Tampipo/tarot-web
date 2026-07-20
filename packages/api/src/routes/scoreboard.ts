import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../lib/session";
import { currentSeason } from "../lib/seasons";

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
  /**
   * Aggregated standings. Defaults to the season in progress — that's what
   * makes a new season read as a score reset. `season=all` reaches across every
   * season, and any season id browses closed history.
   */
  app.get("/scoreboard", { preHandler: requireAuth }, async (req) => {
    const { season } = z.object({ season: z.string().optional() }).parse(req.query);

    let where: Prisma.Sql = Prisma.empty;
    if (season !== "all") {
      const id = season ?? (await currentSeason()).id;
      where = Prisma.sql`WHERE g."seasonId" = ${id}`;
    }

    return prisma.$queryRaw<Row[]>`
      SELECT
        u.id,
        u.name,
        COUNT(*)::int                                            AS games,
        -- float8, not int: a shared seat pays half, so totals can end in .5.
        SUM(gp.score)::float8                                    AS total,
        ROUND(AVG(gp.score)::numeric, 1)::float8                 AS mean,
        COALESCE(STDDEV_SAMP(gp.score), 0)::float8               AS std,
        MAX(gp.score)::float8                                    AS best,
        MIN(gp.score)::float8                                    AS worst,
        -- Sharing the taker's seat counts as having taken: gp is this user's
        -- row, so gp."sharesSeatWithId" is whoever sat with them.
        SUM(CASE WHEN g."takerId" = u.id OR g."takerId" = gp."sharesSeatWithId"
                 THEN 1 ELSE 0 END)::int                         AS "takerCount"
      FROM "User" u
      JOIN "GamePlayer" gp ON gp."userId" = u.id
      JOIN "Game" g        ON g.id = gp."gameId"
      ${where}
      GROUP BY u.id, u.name
      ORDER BY total DESC, games DESC`;
  });
}
