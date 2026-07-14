/** French-Tarot domain types shared between the API and the web SPA. */

/** The four bids, ordered by ambition. Each carries a score multiplier. */
export const CONTRACTS = ["petite", "garde", "garde_sans", "garde_contre"] as const;
export type Contract = (typeof CONTRACTS)[number];

export const CONTRACT_MULTIPLIER: Record<Contract, number> = {
  petite: 1,
  garde: 2,
  garde_sans: 4,
  garde_contre: 6,
};

export const CONTRACT_LABEL: Record<Contract, string> = {
  petite: "Petite",
  garde: "Garde",
  garde_sans: "Garde sans",
  garde_contre: "Garde contre",
};

/**
 * A bonus that belongs to one camp. `attack` = the taker's team scored it,
 * `defense` = the defenders scored it, `none` = not in play. Kept as an enum
 * (rather than a bare boolean) because petit-au-bout and the poignée can be
 * won by *either* side, which flips the sign of their contribution.
 */
export type Side = "none" | "attack" | "defense";
export const SIDE_SIGN: Record<Side, number> = { none: 0, attack: 1, defense: -1 };

/** Poignée (a declared handful of trumps) — three sizes, mutually exclusive. */
export type Poignee = "none" | "simple" | "double" | "triple";
export const POIGNEE_VALUE: Record<Poignee, number> = {
  none: 0,
  simple: 20,
  double: 30,
  triple: 40,
};

/** Card points the attack must reach, indexed by number of oudlers (bouts) held. */
export const TARGET_BY_OUDLERS: Record<number, number> = {
  0: 56,
  1: 51,
  2: 41,
  3: 36,
};

/** Everything needed to score one deal. Player ids are opaque strings. */
export interface GameInput {
  /** Every player at the table (3, 4 or 5), including the taker and partner. */
  playerIds: string[];
  takerId: string;
  /** The called partner (5 players only). null when the taker plays alone. */
  partnerId: string | null;
  contract: Contract;
  /** Number of oudlers (0–3) held by the attack at the end of the deal. */
  oudlers: number;
  /** Card points won by the attack (0–91). */
  pointsMade: number;
  petitAuBout: Side;
  poignee: Poignee;
  poigneeSide: Side;
  /** House-rule "misère" bonus, ±10 × multiplier, awarded to either camp. */
  misere: Side;
}

export interface GameResult {
  /** True when the attack reached its point target. */
  won: boolean;
  /** The deal's value from the attack's perspective (one "unit" of score). */
  baseScore: number;
  /** Signed score for every player id; always sums to zero. */
  scores: Record<string, number>;
}
