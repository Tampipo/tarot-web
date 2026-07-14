import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CONTRACTS, scoreGame, type GameInput } from "@tarot/shared";
import { prisma } from "../prisma";
import { requireAuth } from "../lib/session";

const sideSchema = z.enum(["none", "attack", "defense"]);

const createGameSchema = z.object({
  playerIds: z.array(z.string()).min(3).max(5),
  takerId: z.string(),
  partnerId: z.string().nullable().default(null),
  contract: z.enum(CONTRACTS),
  oudlers: z.number().int().min(0).max(3),
  pointsMade: z.number().int().min(0).max(91),
  petitAuBout: sideSchema.default("none"),
  poignee: z.enum(["none", "simple", "double", "triple"]).default("none"),
  poigneeSide: sideSchema.default("none"),
  misere: sideSchema.default("none"),
});

type GameWithRelations = Awaited<ReturnType<typeof loadGame>>;

function loadGame(id: string) {
  return prisma.game.findUniqueOrThrow({
    where: { id },
    include: { taker: true, partner: true, players: { include: { player: true } } },
  });
}

function serializeGame(g: NonNullable<GameWithRelations>) {
  return {
    id: g.id,
    playedAt: g.playedAt,
    contract: g.contract,
    oudlers: g.oudlers,
    pointsMade: g.pointsMade,
    selfCalled: g.selfCalled,
    petitAuBout: g.petitAuBout,
    poignee: g.poignee,
    poigneeSide: g.poigneeSide,
    misere: g.misere,
    baseScore: g.baseScore,
    won: g.baseScore >= 0,
    taker: { id: g.taker.id, name: g.taker.name },
    partner: g.partner ? { id: g.partner.id, name: g.partner.name } : null,
    players: g.players.map((p) => ({ id: p.player.id, name: p.player.name, score: p.score })),
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
      include: { taker: true, partner: true, players: { include: { player: true } } },
    });
    return games.map(serializeGame);
  });

  app.post("/games", { preHandler: requireAuth }, async (req, reply) => {
    const body = createGameSchema.parse(req.body);

    // Reject unknown players up front so a bad id is a clean 400, not an FK 500.
    const found = await prisma.player.count({ where: { id: { in: body.playerIds } } });
    if (found !== new Set(body.playerIds).size) {
      return reply.code(400).send({ error: "UNKNOWN_PLAYER" });
    }

    // The shared engine validates the deal and throws ScoringError (→ 400) on
    // anything inconsistent, so scoring and persistence never disagree.
    const input: GameInput = { ...body };
    const result = scoreGame(input);

    const game = await prisma.game.create({
      data: {
        contract: body.contract,
        oudlers: body.oudlers,
        pointsMade: body.pointsMade,
        selfCalled: body.partnerId === null,
        petitAuBout: body.petitAuBout,
        poignee: body.poignee,
        poigneeSide: body.poigneeSide,
        misere: body.misere,
        baseScore: result.baseScore,
        takerId: body.takerId,
        partnerId: body.partnerId,
        createdById: req.authUser!.id,
        players: {
          create: body.playerIds.map((pid) => ({ playerId: pid, score: result.scores[pid] })),
        },
      },
      include: { taker: true, partner: true, players: { include: { player: true } } },
    });

    return reply.code(201).send({ game: serializeGame(game), result });
  });
}
