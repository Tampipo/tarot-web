/** API DTOs returned by the tarot backend. */

export interface Player {
  id: string;
  name: string;
  createdAt: string;
}

export interface GamePlayerDTO {
  id: string;
  name: string;
  score: number;
  /** Enculette only: the card points this player's seat took. */
  cardPoints: number | null;
}

export interface GameDTO {
  id: string;
  playedAt: string;
  /**
   * "standard" = someone took. "enculette" = nobody did, so everyone played
   * for themselves to take as little as possible — which is why the contract
   * columns below are null for those deals.
   */
  mode: "standard" | "enculette";
  contract: string | null;
  oudlers: number | null;
  pointsMade: number | null;
  /** Seats at the table. May exceed players.length when guests played. */
  numPlayers: number;
  selfCalled: boolean;
  petitAuBout: string;
  poignee: string;
  misere: string;
  baseScore: number | null;
  /** null for an enculette — there is no attack, so nobody won it. */
  won: boolean | null;
  /** null = a guest took. `selfCalled` distinguishes "alone" from a guest partner. */
  taker: { id: string; name: string } | null;
  partner: { id: string; name: string } | null;
  players: GamePlayerDTO[];
}

/** A scoring period. Exactly one is open (endedAt === null) at a time. */
export interface Season {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  games: number;
  current: boolean;
}

/** A row of the aggregated leaderboard (see GET /scoreboard). */
export interface ScoreRow {
  id: string;
  name: string;
  games: number;
  total: number;
  mean: number;
  std: number;
  best: number;
  worst: number;
  takerCount: number;
}
