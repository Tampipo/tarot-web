import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  applyHouseRule,
  CONTRACTS,
  scoreEnculette,
  scoreGame,
  type GameInput,
  type HouseRuleAdjustment,
  type ScoringHouseRuleId,
} from "@tarot/shared";
import { prisma } from "../prisma";
import { requireAuth } from "../lib/session";
import { currentSeason } from "../lib/seasons";

const SCORING_HOUSE_RULE_IDS: readonly ScoringHouseRuleId[] = [
  "double-points",
  "big-dog-no-partner",
  "taker-gamble",
  "cheating-allowed",
  "great-equalizer",
];

/**
 * What the client reports about the roulette's active house rule. Only the
 * six rules that actually change scoring are accepted here — the flavor-only
 * ones (nothing-happens, forced-petite, the Excuse rule, pass-left) have
 * nothing for the API to do, so the client simply doesn't send them.
 *
 * Neither the gamble's coin nor the equalizer's ranking are taken from the
 * client: `gamble: true` just means the taker opted in, and both the flip and
 * the season standings are resolved server-side so neither can be rigged from
 * a browser console.
 */
const houseRuleRequestSchema = z.object({
  id: z.enum(SCORING_HOUSE_RULE_IDS as [ScoringHouseRuleId, ...ScoringHouseRuleId[]]),
  gamble: z.boolean().optional(),
  cheatingCatches: z.record(z.string(), z.number().int().min(0).max(20)).optional(),
});

const sideSchema = z.enum(["none", "attack", "defense"]);

/**
 * A seat is either a registered player's id or a guest marker ("guest:<seat>").
 * Guests fill a chair so the deal scores correctly, but nothing about them is
 * stored — no GamePlayer row, so they never reach a leaderboard.
 */
const GUEST_PREFIX = "guest:";
const isGuest = (id: string) => id.startsWith(GUEST_PREFIX);

/** Which scoring rules a deal was played under; absent means the usual ones. */
const modeSchema = z.object({
  mode: z.enum(["standard", "enculette"]).default("standard"),
});

/** Seats and their sharing — common to both modes. */
const tableSchema = {
  playerIds: z.array(z.string()).min(3).max(5),
  // Seat -> the person sharing it. Lets more than five play a five-seat deal;
  // the pair splits that seat's score. The engine rejects an incoherent map.
  splitWith: z.record(z.string(), z.string()).default({}),
};

/**
 * An enculette: no taker, no contract, no bonuses — just what each seat took.
 * The engine checks the counts add up to the deck's 91.
 */
const createEnculetteSchema = z.object({
  ...tableSchema,
  cardPoints: z.record(z.string(), z.number().int().min(0).max(91)),
});

const createGameSchema = z.object({
  ...tableSchema,
  takerId: z.string(),
  partnerId: z.string().nullable().default(null),
  contract: z.enum(CONTRACTS),
  oudlers: z.number().int().min(0).max(3),
  pointsMade: z.number().int().min(0).max(91),
  petitAuBout: sideSchema.default("none"),
  poignee: z.enum(["none", "simple", "double", "triple"]).default("none"),
  misere: sideSchema.default("none"),
  // Absent = play it by the book. Enculette has no taker or contract, so none
  // of these rules apply there — the schema simply doesn't offer the field.
  houseRule: houseRuleRequestSchema.optional(),
});

type GameWithRelations = Awaited<ReturnType<typeof loadGame>>;

function loadGame(id: string) {
  return prisma.game.findUniqueOrThrow({
    where: { id },
    include: { taker: true, partner: true, players: { include: { user: true } } },
  });
}

function serializeGame(g: NonNullable<GameWithRelations>) {
  return {
    id: g.id,
    playedAt: g.playedAt,
    contract: g.contract,
    oudlers: g.oudlers,
    pointsMade: g.pointsMade,
    numPlayers: g.numPlayers,
    selfCalled: g.selfCalled,
    petitAuBout: g.petitAuBout,
    poignee: g.poignee,
    misere: g.misere,
    mode: g.mode,
    baseScore: g.baseScore,
    // An enculette has no attack, so nobody "won" it — hence null rather than
    // a misleading true/false.
    won: g.baseScore === null ? null : g.baseScore >= 0,
    // null in either role = a guest played it (see selfCalled for "alone").
    taker: g.taker ? { id: g.taker.id, name: g.taker.name } : null,
    partner: g.partner ? { id: g.partner.id, name: g.partner.name } : null,
    // Members only — guest seats were never stored.
    players: g.players.map((p) => ({
      id: p.user.id,
      name: p.user.name,
      score: p.score,
      cardPoints: p.cardPoints,
    })),
  };
}

/**
 * Everyone with a hand in the deal who has an account: seated or sharing a
 * seat, minus the guests (who are never recorded).
 */
function trackedIds(playerIds: string[], splitWith: Record<string, string>): string[] {
  return [...new Set([...playerIds, ...Object.values(splitWith)].filter((id) => !isGuest(id)))];
}

/** Who shared a seat with whom, readable from either end. */
function seatMates(splitWith: Record<string, string>): Record<string, string> {
  const mates: Record<string, string> = {};
  for (const [seatId, coId] of Object.entries(splitWith)) {
    mates[seatId] = coId;
    mates[coId] = seatId;
  }
  return mates;
}

export async function gameRoutes(app: FastifyInstance): Promise<void> {
  app.get("/games", { preHandler: requireAuth }, async (req) => {
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(20) })
      .parse(req.query);
    const games = await prisma.game.findMany({
      orderBy: { playedAt: "desc" },
      take: limit,
      include: { taker: true, partner: true, players: { include: { user: true } } },
    });
    return games.map(serializeGame);
  });

  app.post("/games", { preHandler: requireAuth }, async (req, reply) => {
    // Mode first, so each set of rules gets the schema that fits it. An older
    // client that sends no mode still means a standard deal.
    const { mode } = modeSchema.parse(req.body);
    const body =
      mode === "enculette"
        ? createEnculetteSchema.parse(req.body)
        : createGameSchema.parse(req.body);

    // Whoever shares a seat is playing too, so they need a GamePlayer row and
    // the same "is an approved member" check as anyone seated.
    const realIds = trackedIds(body.playerIds, body.splitWith);
    // Anyone may take, guests included — we simply record the members' scores
    // and the guest's share goes unstored (so the saved rows won't sum to zero).
    // A deal with nobody tracked would record nothing at all, though.
    if (realIds.length === 0) {
      return reply.code(400).send({ error: "NO_TRACKED_PLAYER" });
    }
    // Every seated id must be an approved member: a bad or unapproved id is a
    // clean 400 rather than an FK 500.
    const found = await prisma.user.count({
      where: { id: { in: realIds }, status: "active" },
    });
    if (found !== realIds.length) {
      return reply.code(400).send({ error: "UNKNOWN_PLAYER" });
    }

    const seatMate = seatMates(body.splitWith);

    // Deals always land in the season that is open right now (rolling it over
    // first if it has come due).
    const season = await currentSeason();

    // An enculette is scored on its own terms and stores none of the contract
    // columns — there was no contract to store.
    if ("cardPoints" in body) {
      const result = scoreEnculette(body);
      const enculette = await prisma.game.create({
        data: {
          seasonId: season.id,
          mode: "enculette",
          numPlayers: body.playerIds.length,
          selfCalled: false, // no taker at all, let alone one playing alone
          createdById: req.authUser!.id,
          players: {
            create: realIds.map((uid) => {
              const co = seatMate[uid];
              // A shared seat played one hand, so both occupants carry its count.
              const seatId = body.playerIds.includes(uid) ? uid : co;
              return {
                userId: uid,
                score: result.scores[uid],
                cardPoints: body.cardPoints[seatId],
                sharesSeatWithId: co && !isGuest(co) ? co : null,
              };
            }),
          },
        },
        include: { taker: true, partner: true, players: { include: { user: true } } },
      });
      return reply.code(201).send({ game: serializeGame(enculette), result });
    }

    // The shared engine validates the deal (guests included, so the split stays
    // correct) and throws ScoringError (→ 400) on anything inconsistent.
    const input: GameInput = { ...body };
    const rawResult = scoreGame(input);

    // The gamble's coin gets flipped here, never trusted from the client — a
    // browser console could otherwise always call "doubled".
    let gambleOutcome: "doubled" | "zeroed" | undefined;
    if (body.houseRule?.id === "taker-gamble" && body.houseRule.gamble) {
      gambleOutcome = Math.random() < 0.5 ? "doubled" : "zeroed";
    }

    // Same idea for the equalizer's ranking: who's up and who's down this
    // season is read fresh from the DB, not accepted from the client. Missing
    // from the sum entirely (nobody's played them yet this season) counts as
    // a season total of zero.
    let seasonRanking: string[] | undefined;
    if (body.houseRule?.id === "great-equalizer") {
      const totals = await prisma.$queryRaw<{ id: string; total: number }[]>`
        SELECT gp."userId" as id, SUM(gp.score)::float8 as total
        FROM "GamePlayer" gp
        JOIN "Game" g ON g.id = gp."gameId"
        WHERE gp."userId" IN (${Prisma.join(realIds)}) AND g."seasonId" = ${season.id}
        GROUP BY gp."userId"`;
      const totalById = new Map(totals.map((t) => [t.id, t.total]));
      seasonRanking = [...realIds].sort(
        (a, b) => (totalById.get(b) ?? 0) - (totalById.get(a) ?? 0),
      );
    }

    const adjustment: HouseRuleAdjustment | undefined = body.houseRule && {
      id: body.houseRule.id,
      cheatingCatches: body.houseRule.cheatingCatches,
      gambleOutcome,
      seasonRanking,
    };
    const result = applyHouseRule(rawResult, input, adjustment);

    const game = await prisma.game.create({
      data: {
        seasonId: season.id,
        contract: body.contract,
        oudlers: body.oudlers,
        pointsMade: body.pointsMade,
        numPlayers: body.playerIds.length,
        selfCalled: body.partnerId === null,
        petitAuBout: body.petitAuBout,
        poignee: body.poignee,
        misere: body.misere,
        mode: "standard",
        baseScore: result.baseScore,
        // A guest in either role stores as null; selfCalled still records
        // whether the taker had a partner at all.
        takerId: isGuest(body.takerId) ? null : body.takerId,
        partnerId: body.partnerId && !isGuest(body.partnerId) ? body.partnerId : null,
        createdById: req.authUser!.id,
        // Only member seats are persisted; guests leave no trace — including
        // whatever a house rule adjusted their score to, since it's never read.
        players: {
          create: realIds.map((uid) => {
            // Seat-sharing is symmetric, so store it from both sides — but only
            // when the other half is a member (a guest has no row to point at).
            const co = seatMate[uid];
            return {
              userId: uid,
              score: result.scores[uid],
              sharesSeatWithId: co && !isGuest(co) ? co : null,
            };
          }),
        },
      },
      include: { taker: true, partner: true, players: { include: { user: true } } },
    });

    return reply.code(201).send({ game: serializeGame(game), result, gambleOutcome });
  });
}
