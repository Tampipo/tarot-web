import type { HouseRuleId } from "@tarot/shared";

/** Whatever the wheel needs to know about tonight's table to fill in a name. */
export interface RouletteContext {
  /** Names of whoever's currently seated, in seat order. */
  seatedNames: string[];
  /** The current season's points leader, if anyone's played yet. */
  leaderName: string | null;
  /**
   * Tonight's tracked (non-guest) seats with their season total — only these
   * people can actually receive a "great-equalizer" transfer, since that's
   * the pool the API can attach it to. Missing from the season entirely
   * counts as a total of 0.
   */
  seatedStandings: { id: string; name: string; total: number }[];
}

export interface HouseRule {
  /** Saved with the deal, so it has to be an id the API knows. */
  id: HouseRuleId;
  emoji: string;
  label: string;
  /** Shown as-is unless `resolveDescription` overrides it with live details. */
  description: string;
  /** Relative odds of landing here — default 1 if omitted. */
  weight?: number;
  /** Overrides the wheel's default palette for this slice. */
  color?: string;
  /** Fills in a name the static description can't know ahead of time. */
  resolveDescription?: (ctx: RouletteContext) => string;
}

/** What actually gets shown and cached once the wheel lands — resolved text, no function to (fail to) serialize. */
export type SpunHouseRule = Pick<HouseRule, "id" | "emoji" | "label" | "description">;

/** Best season total to worst, among tonight's tracked seats — ties keep table order. */
function rankSeatedStandings(standings: RouletteContext["seatedStandings"]): typeof standings {
  return [...standings].sort((a, b) => b.total - a.total);
}

// Flavor rules for the roulette. Landing on one doesn't touch the scoring
// engine, except where noted. Weights are out of 100, so they read directly as
// percentages: "Nothing Happens" lands half the time, "Redistribution" is the
// rare 2%, "Cheating Allowed" is at 8%, and the six remaining rules split the
// last 40% at 6–7% each.
export const HOUSE_RULES: HouseRule[] = [
  {
    id: "nothing-happens",
    emoji: "😐",
    label: "Nothing Happens",
    description: "No twist this time — play a normal deal.",
    weight: 50,
  },
  {
    id: "forced-petite",
    emoji: "👑",
    label: "Forced Petite",
    description: "The season's leader has to take at least Petite this deal — unless someone already took.",
    weight: 6,
    resolveDescription: (ctx) =>
      ctx.leaderName
        ? `${ctx.leaderName} has to take at least Petite this deal — unless someone already took.`
        : "Nobody's on the board yet this season, so there's no forced Petite tonight.",
  },
  {
    id: "excuse-rule",
    emoji: "🃏",
    label: "The Excuse Rule",
    description: "",
    weight: 6,
  },
  {
    id: "twelve-is-twenty-two",
    emoji: "🔢",
    label: "The 12 is the 22",
    description: "The 12 is the 22.",
    weight: 6,
  },
  {
    id: "double-points",
    emoji: "2️⃣",
    label: "Double Points",
    description: "This deal's score counts double — for whoever wins it, and whoever doesn't.",
    weight: 6,
  },
  {
    id: "taker-gamble",
    emoji: "🎲",
    label: "Taker's Gamble",
    description:
      "After scoring, the taker may call a coin flip: heads doubles this deal's result, tails wipes it to zero.",
    weight: 6,
  },
  {
    id: "big-dog-no-partner",
    emoji: "🐕",
    label: "Big Dog, No Partner",
    description:
      "Only kicks in if you're playing 5 tonight: deal an 8-card dog and the taker goes it alone, no called partner — Garde Contre pays triple.",
    weight: 5,
  },
  {
    id: "pass-left",
    emoji: "👈",
    label: "Pass to the Left",
    description:
      "Each player takes one card from the player on their left.",
    weight: 5,
  },
  {
    id: "cheating-allowed",
    emoji: "🕵️",
    label: "Cheating Allowed",
    description: "Cheating is allowed this deal. Get caught, and it's −50 points — every single time.",
    weight: 8,
  },
  {
    id: "great-equalizer",
    emoji: "☭",
    label: "Redistribution",
    description:
      "Among tonight's players, the season's top three each send 100 points to whoever's currently last — and the leader chips in another 100 on top.",
    weight: 2,
    color: "#dc2626",
    resolveDescription: (ctx) => {
      const ranked = rankSeatedStandings(ctx.seatedStandings);
      if (ranked.length < 2) {
        return "Needs at least two members seated at the table — nobody to redistribute between, so no transfer tonight.";
      }
      const last = ranked[ranked.length - 1];
      const payers = ranked.slice(0, 3).filter((p) => p.id !== last.id);
      const payerNames = payers.map((p) => p.name).join(", ");
      const verb = payers.length === 1 ? "sends" : "send";
      const leaderBonus =
        ranked[0].id !== last.id ? ` ${ranked[0].name} (the leader) throws in another 100 on top.` : "";
      return `${payerNames} ${verb} 100 points each to ${last.name}, who's currently last at the table.${leaderBonus}`;
    },
  },
];
