import type { GameInput, GameResult } from "./types";

/**
 * Every rule the roulette can land on. A deal records the one it was played
 * under (Game.houseRule), so this list is also what the API accepts and what
 * the stats can group by. Only five of them change how a deal scores — see
 * applyHouseRule. The rest (nothing-happens, forced-petite, the Excuse rule,
 * the 12, pass-left) are table talk only. "nothing-happens" is also what a
 * deal played without spinning the wheel is recorded as.
 */
export const HOUSE_RULE_IDS = [
  "nothing-happens",
  "forced-petite",
  "excuse-rule",
  "twelve-is-twenty-two",
  "double-points",
  "taker-gamble",
  "big-dog-no-partner",
  "pass-left",
  "cheating-allowed",
  "great-equalizer",
] as const;

export type HouseRuleId = (typeof HOUSE_RULE_IDS)[number];

export interface HouseRuleAdjustment {
  id: HouseRuleId;
  /** "cheating-allowed": tracked player id -> times caught this deal. */
  cheatingCatches?: Record<string, number>;
  /**
   * "taker-gamble": the coin's outcome. Left undefined means the taker didn't
   * gamble (or hasn't decided yet) — the deal scores normally. Callers should
   * resolve the flip themselves (server-side, so it can't be rigged) rather
   * than let this function roll it.
   */
  gambleOutcome?: "doubled" | "zeroed";
  /**
   * "great-equalizer": tonight's tracked seat ids, best season total to
   * worst. Derived from the standings, so callers should compute it
   * themselves (server-side, from the DB) rather than trust a client's copy.
   */
  seasonRanking?: string[];
}

const CHEATING_PENALTY = 50;
const EQUALIZER_SHARE = 100;

/**
 * Deterministic house-rule adjustments layered on top of an already-scored
 * deal. Shared so the web's live preview and the API's saved result always
 * agree — the one exception is `taker-gamble`, whose coin flip only exists
 * once a caller resolves it into `gambleOutcome` (see above). A table-talk
 * rule has no case below, so the deal comes back scored as it was.
 */
export function applyHouseRule(
  result: GameResult,
  input: GameInput,
  rule: HouseRuleAdjustment | undefined,
): GameResult {
  if (!rule) return result;

  let baseScore = result.baseScore;
  const scores = { ...result.scores };

  function scaleAll(factor: number): void {
    baseScore *= factor;
    for (const id of Object.keys(scores)) scores[id] *= factor;
  }

  switch (rule.id) {
    case "double-points":
      scaleAll(2);
      break;
    case "big-dog-no-partner":
      // Only the specific contract this house rule calls out is affected —
      // everything else about the deal scores as usual.
      if (input.contract === "garde_contre") scaleAll(3);
      break;
    case "taker-gamble":
      if (rule.gambleOutcome === "doubled") scaleAll(2);
      else if (rule.gambleOutcome === "zeroed") scaleAll(0);
      break;
    case "cheating-allowed":
      // Flat, not scaled by the deal's own value — getting caught costs the
      // same whether the deal was worth 25 points or 250.
      for (const [id, catches] of Object.entries(rule.cheatingCatches ?? {})) {
        if (id in scores) scores[id] -= CHEATING_PENALTY * catches;
      }
      break;
    case "great-equalizer": {
      // Pure transfers, so the table still sums to zero — communism doesn't
      // create points, it just moves them around.
      const ranking = rule.seasonRanking ?? [];
      if (ranking.length < 2) break;
      const lastId = ranking[ranking.length - 1];
      const leaderId = ranking[0];
      const transfer = (payerId: string) => {
        if (!(payerId in scores) || !(lastId in scores)) return;
        scores[payerId] -= EQUALIZER_SHARE;
        scores[lastId] += EQUALIZER_SHARE;
      };
      // Top three, minus whoever that already is last (never double-pays
      // themselves).
      for (const payerId of ranking.slice(0, 3)) {
        if (payerId !== lastId) transfer(payerId);
      }
      // The season leader throws in one more share on top.
      if (leaderId !== lastId) transfer(leaderId);
      break;
    }
  }

  return { won: result.won, baseScore, scores };
}
