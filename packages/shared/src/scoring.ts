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
  if (!Number.isInteger(input.oudlers) || input.oudlers < 0 || input.oudlers > 3) {
    throw new ScoringError("Oudlers must be an integer between 0 and 3.");
  }
  if (!Number.isInteger(input.pointsMade) || input.pointsMade < 0 || input.pointsMade > 91) {
    throw new ScoringError("Card points must be an integer between 0 and 91.");
  }
  if (input.poignee !== "none" && input.poigneeSide === "none") {
    throw new ScoringError("A poignée must be attributed to a camp.");
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
 * where `sign` is +1 when the attack reaches its point target and −1 otherwise,
 * and each bonus term carries the sign of the camp that earned it (+attack /
 * −defense). Petit-au-bout and the misère follow the contract multiplier; the
 * poignée is a flat bonus, exactly as in the standard rules.
 *
 * The base is then split zero-sum across the table:
 *   • 3 players  → taker ±2·base, each of 2 defenders ∓base
 *   • 4 players  → taker ±3·base, each of 3 defenders ∓base
 *   • 5 players, taker alone     → taker ±4·base, each of 4 defenders ∓base
 *   • 5 players, called partner  → taker ±2·base, partner ±base, 3 defenders ∓base
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
  const petit = SIDE_SIGN[input.petitAuBout] * 10 * multiplier;
  const misere = SIDE_SIGN[input.misere] * 10 * multiplier;
  const poignee = SIDE_SIGN[input.poigneeSide] * POIGNEE_VALUE[input.poignee];

  const base = contract + petit + misere + poignee;

  const scores = distribute(input, base);
  return { won, baseScore: base, scores };
}

/**
 * Zero-sum split of `base` across the table. The taker's team collectively
 * gains `base` per opponent, so the whole table nets to zero.
 */
function distribute(input: GameInput, base: number): Record<string, number> {
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
