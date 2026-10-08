import { CONTRACT_MULTIPLIER, DECK_POINTS, type Contract } from "./types";

/**
 * Medals. Two families, both derived from recorded results only — nothing is
 * stored, so they are always as current as the last saved deal:
 *
 *   • Standing medals: places on the scoreboard of the period being viewed
 *     (leader, second, third, last). They move with every new deal.
 *   • Season medals: awarded on a whole season's deals (champion, best deal,
 *     luckiest taker…) and carried through the season that follows it.
 *
 * Every medal goes to whoever holds the extreme value. Ties share it — but when
 * *every* candidate ties, nobody stands out and it isn't awarded.
 *
 * Petit-au-bout, poignée and misère are recorded per camp, not per player, so
 * no medal can credit an individual for them.
 */

/** One member's part in one deal: a GamePlayer row plus what medals need from its Game. */
export interface MedalDeal {
  userId: string;
  score: number;
  mode: "standard" | "enculette";
  /** Held the taker's seat, alone or sharing it. */
  took: boolean;
  /** Held the called partner's seat, alone or sharing it. */
  called: boolean;
  /**
   * Shared their seat with another member. A seat shared with a guest isn't
   * recorded as shared, so it can't count here.
   */
  shared: boolean;
  /** The deal's contract; null for an enculette. */
  contract: Contract | null;
  /** Whether the attack won; null for an enculette, which has no attack. */
  won: boolean | null;
  /** Attack's card points minus its target; null for an enculette. */
  margin: number | null;
  /**
   * Enculette only: took the fewest card points at the table (ties included).
   * null for a standard deal, or when guests make the table undecidable.
   */
  enculetteWin: boolean | null;
}

/** Below these, a rate is just noise. */
export const MIN_CALLS_FOR_BLACK_CAT = 3;
export const MIN_SPLITS_FOR_HANDICAP = 3;
export const MIN_DEALS_FOR_GAMBLER = 10;
/** A contract made or failed by this many card points or fewer was a close call. */
export const BARELY_MARGIN = 2;

export const STANDING_MEDALS = ["leader", "second", "third", "last"] as const;
export const SEASON_MEDALS = [
  "champion", //     top of the season's standings
  "loser", //        bottom of the season's standings
  "black_cat", //    highest defeat rate as called partner
  "handicap", //     highest defeat rate when sharing a seat
  "enculeur_pro", // most enculettes won (fewest card points at the table)
  "stonks", //       best single deal as taker
  "not_stonks", //   worst single deal as taker
  "gambler", //      highest stake per deal: Σ contract multipliers taken ÷ standard deals
  "lucky", //        most contracts made by BARELY_MARGIN or less
  "singe", //        most contracts failed by BARELY_MARGIN or less
] as const;
export type StandingMedalId = (typeof STANDING_MEDALS)[number];
export type SeasonMedalId = (typeof SEASON_MEDALS)[number];
export type MedalId = StandingMedalId | SeasonMedalId;

export interface MedalAward<Id extends MedalId = MedalId> {
  id: Id;
  /** Everyone tied on the winning value. */
  holders: string[];
  /** The winning value, in the medal's own unit (a rate, a score, a count…). */
  value: number;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Who holds the extreme value, or null when there's nothing to award: no
 * candidates, every candidate tied, or a winning value `keep` rejects (a
 * "best deal" that lost points is no feat). Floats are compared after
 * rounding, so values that differ only by float dust tie.
 */
function extreme(
  values: Map<string, number>,
  direction: "max" | "min",
  keep: (v: number) => boolean = () => true,
): { holders: string[]; value: number } | null {
  if (values.size === 0) return null;
  const sign = direction === "max" ? 1 : -1;
  let best = -Infinity;
  for (const v of values.values()) best = Math.max(best, sign * round(v));
  const value = sign * best;
  if (!keep(value)) return null;
  const holders = [...values].filter(([, v]) => sign * round(v) === best).map(([id]) => id);
  if (values.size > 1 && holders.length === values.size) return null;
  return { holders: holders.sort(), value };
}

/** Add `by` to the user's tally, starting from 0. */
function bump(m: Map<string, number>, id: string, by = 1): void {
  m.set(id, (m.get(id) ?? 0) + by);
}

/** `hits ÷ tries` for everyone with at least `min` tries. */
function rates(hits: Map<string, number>, tries: Map<string, number>, min: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, n] of tries) if (n >= min) out.set(id, (hits.get(id) ?? 0) / n);
  return out;
}

const positive = (v: number) => v > 0;
const negative = (v: number) => v < 0;

/**
 * Places on a scoreboard. Ranks are shared on equal totals (1, 1, 3…), so a
 * tie for first leaves no second. "Last" only goes to someone off the podium,
 * and nothing is awarded with fewer than two players or everyone level.
 */
export function standingMedals(
  totals: { userId: string; total: number }[],
): MedalAward<StandingMedalId>[] {
  if (totals.length < 2) return [];
  const values = totals.map((t) => round(t.total));
  if (values.every((v) => v === values[0])) return [];

  const rankOf = (v: number) => 1 + values.filter((o) => o > v).length;
  const awards: MedalAward<StandingMedalId>[] = [];
  const places: [StandingMedalId, number][] = [["leader", 1], ["second", 2], ["third", 3]];
  for (const [id, rank] of places) {
    const at = totals.filter((t) => rankOf(round(t.total)) === rank);
    if (at.length > 0) awards.push({ id, holders: at.map((t) => t.userId).sort(), value: at[0].total });
  }
  const lowest = Math.min(...values);
  if (rankOf(lowest) > 3) {
    const at = totals.filter((t) => round(t.total) === lowest);
    awards.push({ id: "last", holders: at.map((t) => t.userId).sort(), value: at[0].total });
  }
  return awards;
}

/** Every season medal for one season's deals. Medals nobody qualifies for are left out. */
export function seasonMedals(deals: MedalDeal[]): MedalAward<SeasonMedalId>[] {
  const totals = new Map<string, number>();
  const calls = new Map<string, number>();
  const callsLost = new Map<string, number>();
  const splits = new Map<string, number>();
  const splitsLost = new Map<string, number>();
  const enculetteWins = new Map<string, number>();
  const bestTake = new Map<string, number>();
  const worstTake = new Map<string, number>();
  const standardDeals = new Map<string, number>();
  const stake = new Map<string, number>();
  const takers = new Map<string, number>();
  const barelyWon = new Map<string, number>();
  const barelyLost = new Map<string, number>();

  for (const d of deals) {
    bump(totals, d.userId, d.score);
    if (d.shared) {
      bump(splits, d.userId);
      if (d.score < 0) bump(splitsLost, d.userId);
    }

    if (d.mode === "enculette") {
      // Everyone who played one is a candidate, so a lone winner stands out.
      bump(enculetteWins, d.userId, d.enculetteWin ? 1 : 0);
      continue;
    }

    bump(standardDeals, d.userId);
    if (d.called) {
      bump(calls, d.userId);
      if (d.won === false) bump(callsLost, d.userId);
    }
    if (d.took && d.contract) {
      bestTake.set(d.userId, Math.max(bestTake.get(d.userId) ?? -Infinity, d.score));
      worstTake.set(d.userId, Math.min(worstTake.get(d.userId) ?? Infinity, d.score));
      bump(stake, d.userId, CONTRACT_MULTIPLIER[d.contract]);
      bump(takers, d.userId, 0);
      const m = d.margin ?? 0;
      if (d.won && m <= BARELY_MARGIN) bump(barelyWon, d.userId);
      if (d.won === false && -m <= BARELY_MARGIN) bump(barelyLost, d.userId);
    }
  }

  const gambling = new Map<string, number>();
  for (const [id, n] of standardDeals) {
    if (n >= MIN_DEALS_FOR_GAMBLER) gambling.set(id, (stake.get(id) ?? 0) / n);
  }
  // Every taker is a candidate for the close calls, so one lucky deal among
  // several takers is enough to stand out.
  const withTakers = (m: Map<string, number>) => new Map([...takers].map(([id]) => [id, m.get(id) ?? 0]));

  const candidates: [SeasonMedalId, ReturnType<typeof extreme>][] = [
    // A lone player would be both champion and loser of their own season.
    ["champion", totals.size > 1 ? extreme(totals, "max") : null],
    ["loser", totals.size > 1 ? extreme(totals, "min") : null],
    ["black_cat", extreme(rates(callsLost, calls, MIN_CALLS_FOR_BLACK_CAT), "max", positive)],
    ["handicap", extreme(rates(splitsLost, splits, MIN_SPLITS_FOR_HANDICAP), "max", positive)],
    ["enculeur_pro", extreme(enculetteWins, "max", positive)],
    ["stonks", extreme(bestTake, "max", positive)],
    ["not_stonks", extreme(worstTake, "min", negative)],
    ["gambler", extreme(gambling, "max", positive)],
    ["lucky", extreme(withTakers(barelyWon), "max", positive)],
    ["singe", extreme(withTakers(barelyLost), "max", positive)],
  ];
  return candidates.flatMap(([id, win]) => (win ? [{ id, ...win }] : []));
}

/** One seat of an enculette: the member(s) in it and the card points it took. */
export interface EnculetteSeat {
  userIds: string[];
  cardPoints: number;
}

/**
 * The members who took the fewest card points at an enculette table (ties all
 * win). Guest seats aren't recorded, but their combined count is whatever the
 * members' seats leave of the deck's 91:
 *
 *   • one guest — their count is known exactly;
 *   • several — only their total is. If it's too small for every one of them to
 *     have taken at least the best member's count, a guest won outright; if the
 *     best member took 0, nobody can beat them. Otherwise it's undecidable and
 *     this returns null.
 */
export function enculetteWinners(numPlayers: number, seats: EnculetteSeat[]): string[] | null {
  if (seats.length === 0) return [];
  const best = Math.min(...seats.map((s) => s.cardPoints));
  const winners = seats.filter((s) => s.cardPoints === best).flatMap((s) => s.userIds);
  const guests = numPlayers - seats.length;
  if (guests <= 0) return winners;

  const guestTotal = DECK_POINTS - seats.reduce((a, s) => a + s.cardPoints, 0);
  if (guests === 1) return guestTotal < best ? [] : winners;
  if (best === 0) return winners;
  if (guestTotal < guests * best) return [];
  return null;
}
