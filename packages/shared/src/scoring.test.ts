import { describe, expect, it } from "vitest";
import { scoreEnculette, scoreGame, ScoringError, validateGame } from "./scoring";
import type { EnculetteInput, GameInput } from "./types";

/** A plain 4-player deal the taker just wins by 10 with 2 oudlers. */
function base4(overrides: Partial<GameInput> = {}): GameInput {
  return {
    playerIds: ["a", "b", "c", "d"],
    takerId: "a",
    partnerId: null,
    contract: "garde",
    oudlers: 2, // target 41
    pointsMade: 51, // écart +10
    petitAuBout: "none",
    poignee: "none",
    misere: "none",
    ...overrides,
  };
}

const sum = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0);

describe("scoreGame — base contract value", () => {
  it("won garde by 10 with 2 oudlers → (25+10)*2 = 70", () => {
    const r = scoreGame(base4());
    expect(r.won).toBe(true);
    expect(r.baseScore).toBe(70);
  });

  it("failed contract flips the sign", () => {
    const r = scoreGame(base4({ pointsMade: 31 })); // target 41, écart -10 → fail
    expect(r.won).toBe(false);
    expect(r.baseScore).toBe(-(25 + 10) * 2);
  });

  it("hitting the target exactly counts as won (+25 base)", () => {
    const r = scoreGame(base4({ pointsMade: 41 }));
    expect(r.won).toBe(true);
    expect(r.baseScore).toBe(25 * 2);
  });

  it("applies the contract multiplier", () => {
    expect(scoreGame(base4({ contract: "petite" })).baseScore).toBe(35);
    expect(scoreGame(base4({ contract: "garde_sans" })).baseScore).toBe(140);
    expect(scoreGame(base4({ contract: "garde_contre" })).baseScore).toBe(210);
  });
});

describe("scoreGame — bonuses", () => {
  it("petit au bout for the attack adds 10 × multiplier", () => {
    expect(scoreGame(base4({ petitAuBout: "attack" })).baseScore).toBe(70 + 20);
  });
  it("petit au bout for the defence subtracts 10 × multiplier", () => {
    expect(scoreGame(base4({ petitAuBout: "defense" })).baseScore).toBe(70 - 20);
  });
  it("poignée is a flat bonus, not multiplied", () => {
    expect(scoreGame(base4({ poignee: "double" })).baseScore).toBe(70 + 30);
  });

  // Official rule: the poignée goes to whoever WINS the deal, whoever declared
  // it — so on a failed contract it deepens the attack's loss.
  it("poignée follows the winner of the deal, not the declarer", () => {
    const lost = scoreGame(base4({ poignee: "simple", pointsMade: 31 })); // fails by 10
    expect(lost.won).toBe(false);
    expect(lost.baseScore).toBe(-(25 + 10) * 2 - 20);
  });

  it("misère follows the multiplier", () => {
    expect(scoreGame(base4({ misere: "defense" })).baseScore).toBe(70 - 20);
  });

  // A classic mis-implementation: folding petit-au-bout into the negated
  // contract. Failing by 5 while taking the petit is −30·m + 10·m, not −40·m.
  it("petit au bout is a separate term on a failed contract", () => {
    const r = scoreGame(base4({ pointsMade: 36, petitAuBout: "attack" })); // target 41
    expect(r.won).toBe(false);
    expect(r.baseScore).toBe(-(25 + 5) * 2 + 10 * 2);
  });
});

describe("scoreGame — zero-sum distribution", () => {
  it("3 players: taker +2·base, 2 defenders −base", () => {
    const r = scoreGame(base4({ playerIds: ["a", "b", "c"], oudlers: 2, pointsMade: 51 }));
    expect(r.scores).toEqual({ a: 2 * 70, b: -70, c: -70 });
    expect(sum(r.scores)).toBe(0);
  });

  it("4 players: taker +3·base, 3 defenders −base", () => {
    const r = scoreGame(base4());
    expect(r.scores).toEqual({ a: 3 * 70, b: -70, c: -70, d: -70 });
    expect(sum(r.scores)).toBe(0);
  });

  it("5 players with a called partner: taker +2, partner +1, 3 defenders −1", () => {
    const r = scoreGame(
      base4({ playerIds: ["a", "b", "c", "d", "e"], takerId: "a", partnerId: "b" }),
    );
    expect(r.scores).toEqual({ a: 2 * 70, b: 70, c: -70, d: -70, e: -70 });
    expect(sum(r.scores)).toBe(0);
  });

  it("5 players, taker alone: taker +4·base, 4 defenders −base", () => {
    const r = scoreGame(
      base4({ playerIds: ["a", "b", "c", "d", "e"], takerId: "a", partnerId: null }),
    );
    expect(r.scores).toEqual({ a: 4 * 70, b: -70, c: -70, d: -70, e: -70 });
    expect(sum(r.scores)).toBe(0);
  });

  it("stays zero-sum even when the taker loses", () => {
    const r = scoreGame(
      base4({ playerIds: ["a", "b", "c", "d", "e"], partnerId: "b", pointsMade: 20 }),
    );
    expect(sum(r.scores)).toBe(0);
    expect(r.scores.a).toBeLessThan(0);
  });
});

describe("scoreGame — shared seats", () => {
  it("halves a shared defender seat between its two occupants", () => {
    // 4 seats, base 70: taker +210, each defender −70. b's seat is shared.
    const r = scoreGame(base4({ splitWith: { b: "e" } }));
    expect(r.scores.a).toBe(210);
    expect(r.scores.b).toBe(-35);
    expect(r.scores.e).toBe(-35);
    expect(r.scores.c).toBe(-70);
    expect(sum(r.scores)).toBe(0);
  });

  it("halves a shared taker seat too", () => {
    const r = scoreGame(base4({ splitWith: { a: "e" } }));
    expect(r.scores.a).toBe(105);
    expect(r.scores.e).toBe(105);
    expect(sum(r.scores)).toBe(0);
  });

  it("stays zero-sum with several seats shared at once", () => {
    const r = scoreGame(base4({ splitWith: { a: "e", b: "f", c: "g" } }));
    expect(sum(r.scores)).toBe(0);
    expect(Object.keys(r.scores)).toHaveLength(7);
  });

  it("gives each occupant a half point when the seat is odd", () => {
    // petite (×1) hit exactly → base 25; a lone taker at 3 seats faces 2
    // defenders, so a defender seat is worth −25 and halves to −12.5.
    const r = scoreGame(
      base4({
        playerIds: ["a", "b", "c"],
        contract: "petite",
        oudlers: 2,
        pointsMade: 41,
        splitWith: { b: "e" },
      }),
    );
    expect(r.baseScore).toBe(25);
    expect(r.scores.b).toBe(-12.5);
    expect(r.scores.e).toBe(-12.5);
    expect(sum(r.scores)).toBe(0);
  });
});

describe("scoreEnculette", () => {
  /** 4 seats whose card points add up to the deck's 91. */
  function enc(overrides: Partial<EnculetteInput> = {}): EnculetteInput {
    return {
      playerIds: ["a", "b", "c", "d"],
      cardPoints: { a: 10, b: 20, c: 30, d: 31 },
      ...overrides,
    };
  }

  it("scores each seat the points it avoided", () => {
    const r = scoreEnculette(enc());
    expect(r.scores).toEqual({ a: 81, b: 71, c: 61, d: 60 });
  });

  it("rewards taking least — the cleanest hand scores highest", () => {
    const r = scoreEnculette(enc());
    expect(r.scores.a).toBeGreaterThan(r.scores.d);
  });

  it("hands out (n − 1) × 91 in total, not zero", () => {
    expect(sum(scoreEnculette(enc()).scores)).toBe(3 * 91);
  });

  it("halves a shared seat between its occupants", () => {
    // c's seat took 30, so it is worth 61 — split, that is 30.5 each.
    const r = scoreEnculette(enc({ splitWith: { c: "e" } }));
    expect(r.scores.c).toBe(30.5);
    expect(r.scores.e).toBe(30.5);
    expect(sum(r.scores)).toBe(3 * 91);
  });

  it("rejects a table whose card points don't add up to 91", () => {
    expect(() => scoreEnculette(enc({ cardPoints: { a: 10, b: 20, c: 30, d: 30 } }))).toThrow(
      ScoringError,
    );
  });

  it("rejects a seat with no card points entered", () => {
    expect(() => scoreEnculette(enc({ cardPoints: { a: 10, b: 20, c: 61 } }))).toThrow(
      ScoringError,
    );
  });

  it("rejects sharing a seat with someone already seated", () => {
    expect(() => scoreEnculette(enc({ splitWith: { a: "b" } }))).toThrow(ScoringError);
  });
});

describe("validateGame", () => {
  it("rejects fewer than 3 players", () => {
    expect(() => validateGame(base4({ playerIds: ["a", "b"] }))).toThrow(ScoringError);
  });
  it("rejects a taker who is not at the table", () => {
    expect(() => validateGame(base4({ takerId: "z" }))).toThrow(ScoringError);
  });
  it("rejects a partner in a non-5-player game", () => {
    expect(() => validateGame(base4({ partnerId: "b" }))).toThrow(ScoringError);
  });
  it("rejects duplicate players", () => {
    expect(() => validateGame(base4({ playerIds: ["a", "a", "c", "d"] }))).toThrow(ScoringError);
  });
  it("rejects out-of-range card points", () => {
    expect(() => validateGame(base4({ pointsMade: 92 }))).toThrow(ScoringError);
  });
  it("rejects sharing a seat that isn't at the table", () => {
    expect(() => validateGame(base4({ splitWith: { z: "e" } }))).toThrow(ScoringError);
  });
  it("rejects sharing a seat with someone already seated", () => {
    expect(() => validateGame(base4({ splitWith: { a: "b" } }))).toThrow(ScoringError);
  });
  it("rejects one person sharing two seats", () => {
    expect(() => validateGame(base4({ splitWith: { a: "e", b: "e" } }))).toThrow(ScoringError);
  });
});
