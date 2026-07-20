import {
  CONTRACT_MULTIPLIER,
  POIGNEE_VALUE,
  SIDE_SIGN,
  TARGET_BY_OUDLERS,
  type GameInput,
  type GameResult,
} from "./types";

/** Thrown when a deal is internally inconsistent (bad player set, taker, etc.). */
export class ScoringError extends Error {}

/**
 * Validate a deal and reject anything the score formula can't represent.
 * Runs on the server before persisting and is safe to reuse on the client.
 */
export function validateGame(input: GameInput): void {
  const n = input.playerIds.length;
  if (n < 3 || n > 5) {
    throw new ScoringError("A game must have between 3 and 5 players.");
  }
  if (new Set(input.playerIds).size !== n) {
    throw new ScoringError("The same player was selected more than once.");
  }
  if (!input.playerIds.includes(input.takerId)) {
    throw new ScoringError("The taker must be one of the players.");
  }
  if (input.partnerId !== null) {
    if (n !== 5) {
      throw new ScoringError("A partner can only be called in a 5-player game.");
    }
    if (!input.playerIds.includes(input.partnerId)) {
      throw new ScoringError("The partner must be one of the players.");
    }
    if (input.partnerId === input.takerId) {
      throw new ScoringError("The partner must be different from the taker.");
    }
  }
  // A shared seat still holds exactly one hand, so its two occupants must be a
  // genuine pair from outside the table: nobody sits twice, nobody shares two
  // seats. Without this the halves would double-count someone.
  const seated = new Set(input.playerIds);
  const sharers = new Set<string>();
  for (const [seatId, coId] of Object.entries(input.splitWith ?? {})) {
    if (!seated.has(seatId)) {
      throw new ScoringError("A shared seat must be one of the players.");
    }
    if (coId === seatId) {
      throw new ScoringError("A seat cannot be shared with the player already in it.");
    }
    if (seated.has(coId)) {
      throw new ScoringError("Someone sharing a seat already has a seat of their own.");
    }
    if (sharers.has(coId)) {
      throw new ScoringError("The same player cannot share two seats.");
    }
    sharers.add(coId);
  }
  if (!Number.isInteger(input.oudlers) || input.oudlers < 0 || input.oudlers > 3) {
    throw new ScoringError("Oudlers must be an integer between 0 and 3.");
  }
  if (!Number.isInteger(input.pointsMade) || input.pointsMade < 0 || input.pointsMade > 91) {
    throw new ScoringError("Card points must be an integer between 0 and 91.");
  }
}

/**
 * Score one deal of French Tarot.
 *
 * The deal's value to the attack (the "base") is:
 *
 *     base = sign · (25 + |pointsMade − target|) · multiplier      (contract)
 *          + petit  · 10 · multiplier                              (petit au bout)
 *          + misère · 10 · multiplier                              (house rule)
 *          + poignée·value                                          (flat, un-multiplied)
 *
 * where `sign` is +1 when the attack reaches its point target and −1 otherwise.
 * Petit-au-bout and the misère carry the sign of the camp that earned them
 * (+attack / −defense) and follow the contract multiplier. The poignée is a
 * flat, un-multiplied bonus awarded to whichever camp *wins the deal* — so it
 * takes the contract's own sign, regardless of who declared it.
 *
 * The base is then split zero-sum across the table:
 *   • 3 players  → taker ±2·base, each of 2 defenders ∓base
 *   • 4 players  → taker ±3·base, each of 3 defenders ∓base
 *   • 5 players, taker alone     → taker ±4·base, each of 4 defenders ∓base
 *   • 5 players, called partner  → taker ±2·base, partner ±base, 3 defenders ∓base
 *
 * Any seat may then be shared by two people (`splitWith`), who take half of it
 * each — that's how six or more play a five-seat deal. Halves may be fractional.
 *
 * (The previous implementation only handled 5 players and let the partnered
 * taker take 3·base — which did not sum to zero. Both are fixed here.)
 */
export function scoreGame(input: GameInput): GameResult {
  validateGame(input);

  const target = TARGET_BY_OUDLERS[input.oudlers];
  const won = input.pointsMade >= target;
  const multiplier = CONTRACT_MULTIPLIER[input.contract];

  const contractSign = won ? 1 : -1;
  const contract = contractSign * (25 + Math.abs(input.pointsMade - target)) * multiplier;
  // Petit-au-bout is a term of its own, signed by whoever won the last trick —
  // NOT folded into the contract before it is negated. Failing by 5 while
  // taking the petit is −30·m + 10·m, not −(25+5+10)·m.
  const petit = SIDE_SIGN[input.petitAuBout] * 10 * multiplier;
  const misere = SIDE_SIGN[input.misere] * 10 * multiplier;
  // The poignée always goes to the camp that wins the deal, whoever declared it.
  const poignee = contractSign * POIGNEE_VALUE[input.poignee];

  const base = contract + petit + misere + poignee;

  const scores = distribute(input, base);
  return { won, baseScore: base, scores };
}

/**
 * Zero-sum split of `base` across the table, then across shared seats. The
 * taker's team collectively gains `base` per opponent, so the whole table nets
 * to zero; halving a seat between two people preserves that exactly, since the
 * two halves still add up to the seat's own score.
 */
function distribute(input: GameInput, base: number): Record<string, number> {
  return splitSeats(seatScores(input, base), input.splitWith);
}

/**
 * Hand each shared seat's score to its two occupants, half each. Scores can
 * land on .5 — a seat worth an odd number simply doesn't halve evenly, and
 * rounding here would break the zero-sum.
 */
function splitSeats(
  seats: Record<string, number>,
  splitWith: Record<string, string> | undefined,
): Record<string, number> {
  if (!splitWith) return seats;
  const scores: Record<string, number> = {};
  for (const [seatId, score] of Object.entries(seats)) {
    const coId = splitWith[seatId];
    if (coId === undefined) {
      scores[seatId] = score;
    } else {
      scores[seatId] = score / 2;
      scores[coId] = score / 2;
    }
  }
  return scores;
}

/** The per-seat split, before any seat is shared out between two people. */
function seatScores(input: GameInput, base: number): Record<string, number> {
  const withPartner = input.partnerId !== null;
  const defenders = input.playerIds.filter(
    (id) => id !== input.takerId && id !== input.partnerId,
  );

  const scores: Record<string, number> = {};
  for (const id of defenders) scores[id] = -base;

  if (withPartner) {
    // Taker keeps 2 shares, the partner 1 — together they cover the 3 defenders.
    scores[input.takerId] = 2 * base;
    scores[input.partnerId as string] = base;
  } else {
    // Lone taker faces every other player and covers all of them alone.
    scores[input.takerId] = defenders.length * base;
  }
  return scores;
}
