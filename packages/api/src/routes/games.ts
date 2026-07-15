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
    taker: { id: g.taker.id, name: g.taker.name },
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

    // The taker and partner anchor the game record (FKs to User), so they must
    // be members — a guest can only ever fill a defending seat.
    if (isGuest(body.takerId) || (body.partnerId && isGuest(body.partnerId))) {
      return reply.code(400).send({ error: "GUEST_CANNOT_TAKE" });
    }

    const realIds = [...new Set(body.playerIds.filter((id) => !isGuest(id)))];
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
        takerId: body.takerId,
        partnerId: body.partnerId,
        createdById: req.authUser!.id,
        // Only member seats are persisted; guests leave no trace.
        players: {
          create: realIds.map((uid) => ({ userId: uid, score: result.scores[uid] })),
        },
      },
      include: { taker: true, partner: true, players: { include: { user: true } } },
    });

    return reply.code(201).send({ game: serializeGame(game), result });
  });
}
