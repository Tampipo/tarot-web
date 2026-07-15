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
}

export interface GameDTO {
  id: string;
  playedAt: string;
  contract: string;
  oudlers: number;
  pointsMade: number;
  /** Seats at the table. May exceed players.length when guests played. */
  numPlayers: number;
  selfCalled: boolean;
  petitAuBout: string;
  poignee: string;
  misere: string;
  baseScore: number;
  won: boolean;
  taker: { id: string; name: string };
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
