import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  TARGET_BY_OUDLERS,
  enculetteWinners,
  seasonMedals,
  standingMedals,
  type Contract,
  type EnculetteSeat,
  type MedalDeal,
} from "@tarot/shared";
import { prisma } from "../prisma";
import { requireAuth } from "../lib/session";
import { currentSeason } from "../lib/seasons";

type Row = Awaited<ReturnType<typeof loadRows>>[number];

function loadRows(seasonIds: string[] | null) {
  return prisma.gamePlayer.findMany({
    where: seasonIds ? { game: { seasonId: { in: seasonIds } } } : {},
    select: {
      gameId: true,
      userId: true,
      score: true,
      cardPoints: true,
      sharesSeatWithId: true,
      game: {
        select: {
          seasonId: true,
          mode: true,
          contract: true,
          oudlers: true,
          pointsMade: true,
          numPlayers: true,
          takerId: true,
          partnerId: true,
          baseScore: true,
        },
      },
    },
  });
}

/**
 * Who won each enculette, by game id (null = undecidable). Two members sharing
 * a seat each carry that seat's count, so the pair is folded back into one seat.
 */
function enculetteResults(rows: Row[]): Map<string, Set<string> | null> {
  const seatsByGame = new Map<string, Map<string, EnculetteSeat>>();
  const numPlayers = new Map<string, number>();
  for (const r of rows) {
    if (r.game.mode !== "enculette" || r.cardPoints === null) continue;
    numPlayers.set(r.gameId, r.game.numPlayers);
    const seats = seatsByGame.get(r.gameId) ?? new Map<string, EnculetteSeat>();
    seatsByGame.set(r.gameId, seats);
    const key = r.sharesSeatWithId ? [r.userId, r.sharesSeatWithId].sort().join("+") : r.userId;
    const seat = seats.get(key) ?? { userIds: [], cardPoints: r.cardPoints };
    seat.userIds.push(r.userId);
    seats.set(key, seat);
  }
  const out = new Map<string, Set<string> | null>();
  for (const [gameId, seats] of seatsByGame) {
    const winners = enculetteWinners(numPlayers.get(gameId)!, [...seats.values()]);
    out.set(gameId, winners && new Set(winners));
  }
  return out;
}

/** GamePlayer rows shaped for the medal rules. */
function toDeals(rows: Row[]): MedalDeal[] {
  const enculettes = enculetteResults(rows);
  return rows.map((r) => {
    const g = r.game;
    // Sharing a seat shares its role, exactly as the scoreboard counts takes.
    const holds = (seatId: string | null) =>
      seatId !== null && (seatId === r.userId || seatId === r.sharesSeatWithId);
    const standard = g.mode !== "enculette";
    const winners = enculettes.get(r.gameId);
    return {
      userId: r.userId,
      score: r.score,
      mode: standard ? "standard" : "enculette",
      took: holds(g.takerId),
      called: holds(g.partnerId),
      shared: r.sharesSeatWithId !== null,
      contract: g.contract as Contract | null,
      // Same reading as GET /games: the deal's value to the attack carries its sign.
      won: g.baseScore === null ? null : g.baseScore >= 0,
      margin:
        standard && g.pointsMade !== null && g.oudlers !== null
          ? g.pointsMade - TARGET_BY_OUDLERS[g.oudlers]
          : null,
      enculetteWin: standard || winners == null ? null : winners.has(r.userId),
    };
  });
}

/** Sum of each member's scores. */
function totals(deals: MedalDeal[]): { userId: string; total: number }[] {
  const sums = new Map<string, number>();
  for (const d of deals) sums.set(d.userId, (sums.get(d.userId) ?? 0) + d.score);
  return [...sums].map(([userId, total]) => ({ userId, total }));
}

export async function medalRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Medals for a period — same `season` parameter as /scoreboard:
   *   • standings: places on that period's scoreboard;
   *   • seasons: the season medals carried into it, i.e. those of the season
   *     before it. `season=all` lists every closed season's instead.
   */
  app.get("/medals", { preHandler: requireAuth }, async (req) => {
    const { season } = z.object({ season: z.string().optional() }).parse(req.query);
    const current = await currentSeason();
    const periodId = season === "all" ? null : (season ?? current.id);

    const all = await prisma.season.findMany({ orderBy: { startedAt: "asc" } });
    let previous: typeof all;
    if (periodId === null) {
      previous = all.filter((s) => s.endedAt !== null);
    } else {
      const i = all.findIndex((s) => s.id === periodId);
      previous = i > 0 ? [all[i - 1]] : [];
    }

    const periodDeals = toDeals(await loadRows(periodId ? [periodId] : null));
    const previousRows = await loadRows(previous.map((s) => s.id));

    return {
      standings: standingMedals(totals(periodDeals)),
      seasons: previous.map((s) => ({
        seasonId: s.id,
        seasonName: s.name,
        awards: seasonMedals(toDeals(previousRows.filter((r) => r.game.seasonId === s.id))),
      })),
    };
  });
}
