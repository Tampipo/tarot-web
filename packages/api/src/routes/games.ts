import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CONTRACTS, scoreGame, type GameInput } from "@tarot/shared";
import { prisma } from "../prisma";
import { requireAuth } from "../lib/session";
import { currentSeason } from "../lib/seasons";

const sideSchema = z.enum(["none", "attack", "defense"]);

/**
 * A seat is either a registered player's id or a guest marker ("guest:<seat>").
 * Guests fill a chair so the deal scores correctly, but nothing about them is
 * stored — no GamePlayer row, so they never reach a leaderboard.
 */
const GUEST_PREFIX = "guest:";
const isGuest = (id: string) => id.startsWith(GUEST_PREFIX);

const createGameSchema = z.object({
  playerIds: z.array(z.string()).min(3).max(5),
  // Seat -> the person sharing it. Lets more than five play a five-seat deal;
  // the pair splits that seat's score. The engine rejects an incoherent map.
  splitWith: z.record(z.string(), z.string()).default({}),
  takerId: z.string(),
  partnerId: z.string().nullable().default(null),
  contract: z.enum(CONTRACTS),
  oudlers: z.number().int().min(0).max(3),
  pointsMade: z.number().int().min(0).max(91),
  petitAuBout: sideSchema.default("none"),
  poignee: z.enum(["none", "simple", "double", "triple"]).default("none"),
  misere: sideSchema.default("none"),
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
    baseScore: g.baseScore,
    won: g.baseScore >= 0,
    // null in either role = a guest played it (see selfCalled for "alone").
    taker: g.taker ? { id: g.taker.id, name: g.taker.name } : null,
    partner: g.partner ? { id: g.partner.id, name: g.partner.name } : null,
    // Members only — guest seats were never stored.
    players: g.players.map((p) => ({ id: p.user.id, name: p.user.name, score: p.score })),
  };
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
    const body = createGameSchema.parse(req.body);

    // Whoever shares a seat is playing too, so they need a GamePlayer row and
    // the same "is an approved member" check as anyone seated.
    const realIds = [
      ...new Set(
        [...body.playerIds, ...Object.values(body.splitWith)].filter((id) => !isGuest(id)),
      ),
    ];
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

    // The shared engine validates the deal (guests included, so the split stays
    // correct) and throws ScoringError (→ 400) on anything inconsistent.
    const input: GameInput = { ...body };
    const result = scoreGame(input);

    // Who shared a seat with whom, readable from either end.
    const seatMate: Record<string, string> = {};
    for (const [seatId, coId] of Object.entries(body.splitWith)) {
      seatMate[seatId] = coId;
      seatMate[coId] = seatId;
    }

    // Deals always land in the season that is open right now (rolling it over
    // first if it has come due).
    const season = await currentSeason();

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
        baseScore: result.baseScore,
        // A guest in either role stores as null; selfCalled still records
        // whether the taker had a partner at all.
        takerId: isGuest(body.takerId) ? null : body.takerId,
        partnerId: body.partnerId && !isGuest(body.partnerId) ? body.partnerId : null,
        createdById: req.authUser!.id,
        // Only member seats are persisted; guests leave no trace.
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

    return reply.code(201).send({ game: serializeGame(game), result });
  });
}
