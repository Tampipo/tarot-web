import {
  SEASON_MEDALS,
  type MedalAward,
  type MedalId,
  type SeasonMedalId,
  type StandingMedalId,
} from "@tarot/shared";
import { signed } from "./format";

/** GET /medals — places on the period's scoreboard, and the season medals carried into it. */
export interface MedalsDTO {
  standings: MedalAward<StandingMedalId>[];
  seasons: {
    seasonId: string;
    seasonName: string;
    awards: MedalAward<SeasonMedalId>[];
  }[];
}

/** A medal as shown to people: one per holder. */
export interface Medal {
  key: string;
  icon: string;
  name: string;
  /** The season it was earned in; only for season medals. */
  season?: string;
  tagline: string;
  description: string;
  /** The winning figure, e.g. "+240" or "67%" — or, for a tally, how many times. */
  value: string;
  /** How many times it was earned; only for a player's tally of past seasons. */
  count?: number;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const count = (unit: string) => (v: number) => `${v} ${unit}${v === 1 ? "" : "s"}`;

const INFO: Record<
  MedalId,
  { icon: string; name: string; tagline: string; description: string; value: (v: number) => string }
> = {
  champion: {
    icon: "🏆",
    name: "Champion",
    tagline: "What a legend",
    description: "Won the previous season",
    value: signed,
  },
  loser: {
    icon: "🩼",
    name: "Loser",
    tagline: "Next season will be better …",
    description: "Lost the previous season",
    value: signed,
  },
  black_cat: {
    icon: "🐈‍⬛",
    name: "Chat noir",
    tagline: "Can I change my call ?",
    description: "Was the worst player to call last season",
    value: (v) => `${pct(v)} lost`,
  },
  handicap: {
    icon: "👨‍🦼‍➡️",
    name: "Handicap",
    tagline: "Better let them play alone",
    description: "Was the worst player to split with last season",
    value: (v) => `${pct(v)} lost`,
  },
  enculeur_pro: {
    icon: "🍆",
    name: "Enculeur pro",
    tagline: "No one does it like them",
    description: "Was the king of enculette last season",
    value: count("win"),
  },
  stonks: {
    icon: "📈",
    name: "Stonks",
    tagline: "That was a good one",
    description: "Made the best deal last season",
    value: signed,
  },
  not_stonks: {
    icon: "📉",
    name: "Not Stonks",
    tagline: "They should have stayed quiet",
    description: "Made the worst deal last season",
    value: signed,
  },
  gambler: {
    icon: "🎰",
    name: "Gambler",
    tagline: "They prefer « data analyst »",
    description: "Bet the most last season",
    value: (v) => `${v.toFixed(2)} per deal`,
  },
  lucky: {
    icon: "🍀",
    name: "Lucky",
    tagline: "LA CHAAAAAATTE",
    description: "Was the player with the most barely-won games last season",
    value: count("close win"),
  },
  singe: {
    icon: "🦧",
    name: "Singe",
    tagline: "They were so close…",
    description: "Was the player with the most barely-lost games last season",
    value: count("close loss"),
  },
  candauliste: {
    icon: "🪑",
    name: "Candauliste",
    tagline: "Sharing is caring",
    description: "Shared the most their hand last season",
    value: (v) => `${pct(v)} shared`,
  },
  chomeur: {
    icon: "🏖️",
    name: "Chomeur",
    tagline: "That's a full-time job",
    description: "Played the most games last season",
    value: count("game"),
  },
  rip: {
    icon: "👻",
    name: "RIP",
    tagline: "Who's that ?",
    description: "Played the least games last season",
    value: count("game"),
  },
  leader: {
    icon: "🥇",
    name: "Leader",
    tagline: "Will it last ?",
    description: "Currently leading the scoreboard",
    value: signed,
  },
  second: {
    icon: "🥈",
    name: "Dauphin",
    tagline: "Keep pushing !",
    description: "Currently second on the scoreboard",
    value: signed,
  },
  third: {
    icon: "🥉",
    name: "Troisième",
    tagline: "Not that bad",
    description: "Currently third on the scoreboard",
    value: signed,
  },
  last: {
    icon: "🐢",
    name: "À la traîne",
    tagline: "They should play better",
    description: "Currently last on the scoreboard",
    value: signed,
  },
};

function toMedal(award: MedalAward, season?: { seasonId: string; seasonName: string }): Medal {
  const info = INFO[award.id];
  return {
    key: season ? `${award.id}-${season.seasonId}` : award.id,
    icon: info.icon,
    name: info.name,
    season: season?.seasonName,
    tagline: info.tagline,
    description: info.description,
    value: info.value(award.value),
  };
}

/** A player's places on the period's scoreboard. */
export function standingsOf(data: MedalsDTO | null, userId: string | undefined): Medal[] {
  if (!data || !userId) return [];
  return data.standings.filter((a) => a.holders.includes(userId)).map((a) => toMedal(a));
}

/**
 * A player's tally of every closed season (from GET /medals?season=all): one
 * entry per kind of medal with how many times they earned it, most earned
 * first, then in catalogue order.
 */
export function tallyOf(data: MedalsDTO | null, userId: string | undefined): Medal[] {
  if (!data || !userId) return [];
  const counts = new Map<SeasonMedalId, number>();
  for (const s of data.seasons) {
    for (const a of s.awards) if (a.holders.includes(userId)) counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a, n], [b, m]) => m - n || SEASON_MEDALS.indexOf(a) - SEASON_MEDALS.indexOf(b))
    .map(([id, n]) => {
      const info = INFO[id];
      return {
        key: `tally-${id}`,
        icon: info.icon,
        name: info.name,
        tagline: info.tagline,
        description: info.description,
        value: `${n} time${n === 1 ? "" : "s"}`,
        count: n,
      };
    });
}

/** Everything one player holds: standings first, then season medals, newest season first. */
export function medalsOf(data: MedalsDTO | null, userId: string | undefined): Medal[] {
  if (!data || !userId) return [];
  const mine = (a: MedalAward) => a.holders.includes(userId);
  return [
    ...data.standings.filter(mine).map((a) => toMedal(a)),
    ...[...data.seasons]
      .reverse()
      .flatMap((s) => s.awards.filter(mine).map((a) => toMedal(a, s))),
  ];
}
