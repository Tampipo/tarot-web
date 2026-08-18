/**
 * One-off backfill: re-score every enculette already stored, from the old
 * "seat = 91 − its card points" to the zero-sum "seat = 91 − n · its card points".
 *
 * Everything the new rule needs is on the rows: Game.numPlayers is the seat
 * count (guests included) and GamePlayer.cardPoints is what that seat took. The
 * one thing that isn't recorded is whether a member shared a seat with a guest
 * — that pairing leaves sharesSeatWithId null even though the score was halved
 * — so a seat's share is read back off the stored score rather than trusted
 * from the column.
 *
 * Any row that can't be read as exactly one of {already re-scored, an old whole
 * seat, an old half seat} takes its whole game out of the run, untouched and
 * reported. That is what makes this safe to re-run: a re-scored row is
 * recognised as such and left alone, and the handful of scores that are
 * genuinely ambiguous (a seat that took all 91 scored 0 either way; a 4-seat
 * row on 13 points scores 39 both as an old half and as a new whole) are never
 * guessed at.
 *
 * Dry run by default; --apply writes. Runs in the api builder image, which
 * already carries the compiled dist and the Prisma client:
 *
 *   docker compose run --rm migrate node packages/api/dist/scripts/backfill-enculette-scores.js
 *   docker compose run --rm migrate node packages/api/dist/scripts/backfill-enculette-scores.js --apply
 *
 * Against the deployed database, run the same file from the api image with that
 * DATABASE_URL. Take a dump first — this rewrites GamePlayer.score in place.
 */
import { DECK_POINTS } from "@tarot/shared";
import { prisma } from "../prisma";

/** Scores are floats: a shared seat halves to .5. */
const EPS = 1e-9;
const near = (a: number, b: number): boolean => Math.abs(a - b) < EPS;

type StoredSeat = {
  userId: string;
  score: number;
  cardPoints: number | null;
  sharesSeatWithId: string | null;
};

/**
 * What a stored score is: already on the new rule ("done"), an old score for a
 * share of a seat (1 = whole, 0.5 = shared), or unreadable ("unknown").
 *
 * "Done" is tested first, so a score that could be read either way is taken as
 * already migrated — the reading that writes nothing.
 */
type Verdict = "done" | "unknown" | 1 | 0.5;

function classify(row: StoredSeat, points: number, seats: number): Verdict {
  const oldWhole = DECK_POINTS - points;
  const newWhole = DECK_POINTS - seats * points;

  // A member sharing with a member is known to hold half a seat from the column.
  if (row.sharesSeatWithId !== null) {
    if (near(row.score, newWhole / 2)) return "done";
    if (near(row.score, oldWhole / 2)) return 0.5;
    return "unknown";
  }
  if (near(row.score, newWhole)) return "done";
  if (near(row.score, newWhole / 2)) return "done"; // shared with a guest
  // A seat that took all 91 scored 0 whole and 0 halved alike — unreadable.
  if (near(oldWhole, 0)) return "unknown";
  if (near(row.score, oldWhole)) return 1;
  if (near(row.score, oldWhole / 2)) return 0.5;
  return "unknown";
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const games = await prisma.game.findMany({
    where: { mode: "enculette" },
    include: { players: true },
    orderBy: { playedAt: "asc" },
  });

  let migrated = 0;
  let untouched = 0;
  let skipped = 0;

  for (const game of games) {
    const updates: { userId: string; from: number; to: number }[] = [];
    let problem: string | null = null;

    for (const row of game.players) {
      const points = row.cardPoints;
      if (points === null) {
        problem = `${row.userId} has no cardPoints stored`;
        break;
      }
      const verdict = classify(row, points, game.numPlayers);
      if (verdict === "unknown") {
        problem = `${row.userId} scores ${row.score} on ${points} card points, which no rule explains`;
        break;
      }
      if (verdict === "done") continue;
      updates.push({
        userId: row.userId,
        from: row.score,
        to: (DECK_POINTS - game.numPlayers * points) * verdict,
      });
    }

    const label = `${game.id} (${game.playedAt.toISOString().slice(0, 10)}, ${game.numPlayers} seats)`;
    if (problem !== null) {
      skipped += 1;
      console.warn(`skip     ${label}: ${problem}`);
      continue;
    }
    if (updates.length === 0) {
      untouched += 1;
      console.log(`ok       ${label}: already on the new rule`);
      continue;
    }

    migrated += 1;
    console.log(`${apply ? "update  " : "would   "} ${label}`);
    for (const u of updates) console.log(`           ${u.userId}: ${u.from} → ${u.to}`);

    if (apply) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.gamePlayer.update({
            where: { gameId_userId: { gameId: game.id, userId: u.userId } },
            data: { score: u.to },
          }),
        ),
      );
    }
  }

  console.log(
    `\n${games.length} enculette(s): ${migrated} ${apply ? "re-scored" : "to re-score"}, ` +
      `${untouched} already current, ${skipped} skipped.`,
  );
  if (!apply && migrated > 0) console.log("Dry run — re-run with --apply to write.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
