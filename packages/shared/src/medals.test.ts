import { describe, expect, it } from "vitest";
import {
  enculetteWinners,
  seasonMedals,
  standingMedals,
  type MedalDeal,
  type SeasonMedalId,
} from "./medals";

/** A plain standard deal where `userId` defended. */
function deal(userId: string, score: number, overrides: Partial<MedalDeal> = {}): MedalDeal {
  return {
    userId,
    score,
    mode: "standard",
    took: false,
    called: false,
    shared: false,
    contract: "garde",
    won: true,
    margin: 10,
    enculetteWin: null,
    ...overrides,
  };
}

/** `userId` took: `margin` is card points over (or, negative, under) the target. */
const take = (userId: string, margin: number, overrides: Partial<MedalDeal> = {}) =>
  deal(userId, margin >= 0 ? 60 : -60, { took: true, won: margin >= 0, margin, ...overrides });

const enculette = (userId: string, score: number, enculetteWin: boolean | null) =>
  deal(userId, score, { mode: "enculette", contract: null, won: null, margin: null, enculetteWin });

/** `n` copies of a deal. */
const times = (n: number, make: () => MedalDeal) => Array.from({ length: n }, make);

function medal(deals: MedalDeal[], id: SeasonMedalId) {
  return seasonMedals(deals).find((m) => m.id === id);
}

describe("seasonMedals — champion and loser", () => {
  it("are the top and bottom of the season's totals", () => {
    const deals = [deal("a", 100), deal("b", -40), deal("c", -60)];
    expect(medal(deals, "champion")).toMatchObject({ holders: ["a"], value: 100 });
    expect(medal(deals, "loser")).toMatchObject({ holders: ["c"], value: -60 });
  });

  it("add up every deal of the season", () => {
    const deals = [deal("a", 100), deal("a", -150), deal("b", 20)];
    expect(medal(deals, "champion")?.holders).toEqual(["b"]);
  });

  it("aren't awarded to a lone player or a level table", () => {
    expect(medal([deal("a", 10)], "champion")).toBeUndefined();
    expect(medal([deal("a", 0), deal("b", 0)], "loser")).toBeUndefined();
  });
});

describe("seasonMedals — chat noir", () => {
  it("goes to the highest defeat rate as called partner", () => {
    const deals = [
      ...times(2, () => deal("a", -30, { called: true, won: false })),
      deal("a", 30, { called: true }), // a: 2/3 lost
      ...times(3, () => deal("b", -30, { called: true, won: false })), // b: 3/3
    ];
    expect(medal(deals, "black_cat")).toMatchObject({ holders: ["b"], value: 1 });
  });

  it("needs a minimum number of calls", () => {
    const deals = times(2, () => deal("a", -30, { called: true, won: false }));
    expect(medal(deals, "black_cat")).toBeUndefined();
  });

  it("isn't awarded when no call was lost", () => {
    expect(medal(times(3, () => deal("a", 30, { called: true })), "black_cat")).toBeUndefined();
  });
});

describe("seasonMedals — handicap", () => {
  it("goes to the highest defeat rate when sharing a seat", () => {
    const deals = [
      ...times(3, () => deal("a", -20, { shared: true })),
      deal("b", -20, { shared: true }),
      ...times(2, () => deal("b", 20, { shared: true })),
    ];
    expect(medal(deals, "handicap")).toMatchObject({ holders: ["a"], value: 1 });
  });
});

describe("seasonMedals — enculeur pro", () => {
  it("counts enculettes won", () => {
    const deals = [
      enculette("a", 40, true),
      enculette("a", 30, true),
      enculette("b", -10, false),
      enculette("b", 20, true),
    ];
    expect(medal(deals, "enculeur_pro")).toMatchObject({ holders: ["a"], value: 2 });
  });

  it("ignores undecidable tables", () => {
    expect(medal([enculette("a", 40, null), enculette("b", -40, false)], "enculeur_pro")).toBeUndefined();
  });
});

describe("seasonMedals — stonks and not stonks", () => {
  it("are the best and worst single deals as taker", () => {
    const deals = [
      take("a", 10, { score: 240 }),
      take("b", -5, { score: -360 }),
      deal("c", 500), // defending doesn't count
    ];
    expect(medal(deals, "stonks")).toMatchObject({ holders: ["a"], value: 240 });
    expect(medal(deals, "not_stonks")).toMatchObject({ holders: ["b"], value: -360 });
  });

  it("no stonks when no taker ever gained", () => {
    expect(medal([take("a", -5), take("b", -10)], "stonks")).toBeUndefined();
  });
});

describe("seasonMedals — gambler", () => {
  it("weighs each take by its contract, per standard deal played", () => {
    const deals = [
      take("a", 5, { contract: "garde_contre" }), // 6
      ...times(9, () => deal("a", 10)), //            over 10 deals → 0.6
      ...times(3, () => take("b", 5, { contract: "petite" })), // 3
      ...times(7, () => deal("b", 10)), //                        over 10 deals → 0.3
    ];
    expect(medal(deals, "gambler")).toMatchObject({ holders: ["a"], value: 0.6 });
  });

  it("needs a minimum number of deals", () => {
    expect(medal(times(9, () => take("a", 5)), "gambler")).toBeUndefined();
  });

  it("doesn't count enculettes as deals played", () => {
    const deals = [...times(9, () => deal("a", 10)), take("a", 5), enculette("a", 10, true)];
    expect(medal(deals, "gambler")).toMatchObject({ value: 0.2 });
  });
});

describe("seasonMedals — lucky and singe", () => {
  it("lucky counts contracts made by 2 points or less", () => {
    const deals = [take("a", 0), take("a", 2), take("a", 3), take("b", 1), take("b", 30)];
    expect(medal(deals, "lucky")).toMatchObject({ holders: ["a"], value: 2 });
  });

  it("singe counts contracts failed by 2 points or less", () => {
    const deals = [take("a", -1), take("b", -2), take("b", -1), take("b", -3)];
    expect(medal(deals, "singe")).toMatchObject({ holders: ["b"], value: 2 });
  });

  it("one close call is enough when other takers had none", () => {
    expect(medal([take("a", 1), take("b", 20)], "lucky")?.holders).toEqual(["a"]);
  });

  it("isn't awarded without a single close call", () => {
    expect(medal([take("a", 20), take("b", -20)], "lucky")).toBeUndefined();
  });
});

describe("seasonMedals — sharing and attendance", () => {
  /** `n` deals for `userId`, `shared` of them in a shared seat. */
  const played = (userId: string, n: number, shared = 0) =>
    Array.from({ length: n }, (_, i) => deal(userId, 0, { shared: i < shared }));

  it("candauliste shares the largest part of their deals", () => {
    const deals = [...played("a", 10, 6), ...played("b", 10, 2), ...played("c", 5, 0)];
    expect(medal(deals, "candauliste")).toMatchObject({ holders: ["a"], value: 0.6 });
  });

  it("ignores anyone under the minimum number of deals for the share", () => {
    const deals = [...played("a", 4, 4), ...played("b", 10, 1), ...played("c", 10, 3)];
    expect(medal(deals, "candauliste")?.holders).toEqual(["c"]);
  });

  it("no candauliste when nobody shared", () => {
    expect(medal([...played("a", 5), ...played("b", 5)], "candauliste")).toBeUndefined();
  });

  it("chomeur played the most deals, rip the fewest, enculettes included", () => {
    const deals = [...played("a", 3), enculette("a", 10, true), ...played("b", 2), ...played("c", 1)];
    expect(medal(deals, "chomeur")).toMatchObject({ holders: ["a"], value: 4 });
    expect(medal(deals, "rip")).toMatchObject({ holders: ["c"], value: 1 });
  });
});

describe("standingMedals", () => {
  const totals = (...t: [string, number][]) => t.map(([userId, total]) => ({ userId, total }));

  it("names the podium and the last", () => {
    const awards = standingMedals(totals(["a", 90], ["b", 40], ["c", -20], ["d", -110]));
    expect(awards).toEqual([
      { id: "leader", holders: ["a"], value: 90 },
      { id: "second", holders: ["b"], value: 40 },
      { id: "third", holders: ["c"], value: -20 },
      { id: "last", holders: ["d"], value: -110 },
    ]);
  });

  it("a tie for first leaves no second", () => {
    const awards = standingMedals(totals(["a", 50], ["b", 50], ["c", -100]));
    expect(awards.map((a) => [a.id, a.holders])).toEqual([
      ["leader", ["a", "b"]],
      ["third", ["c"]],
    ]);
  });

  it("no last medal for someone already on the podium", () => {
    const awards = standingMedals(totals(["a", 10], ["b", -10]));
    expect(awards.map((a) => a.id)).toEqual(["leader", "second"]);
  });

  it("nothing with a lone player or everyone level", () => {
    expect(standingMedals(totals(["a", 10]))).toEqual([]);
    expect(standingMedals(totals(["a", 0], ["b", 0]))).toEqual([]);
  });
});

describe("enculetteWinners", () => {
  const seat = (cardPoints: number, ...userIds: string[]) => ({ userIds, cardPoints });

  it("an all-member table: whoever took the fewest, ties included", () => {
    expect(enculetteWinners(3, [seat(40, "a"), seat(20, "b"), seat(31, "c")])).toEqual(["b"]);
    expect(enculetteWinners(3, [seat(20, "a"), seat(20, "b"), seat(51, "c")])).toEqual(["a", "b"]);
  });

  it("a shared seat wins for both its members", () => {
    expect(enculetteWinners(3, [seat(10, "a", "b"), seat(40, "c"), seat(41, "d")])).toEqual(["a", "b"]);
  });

  it("one guest: their count is the rest of the deck", () => {
    expect(enculetteWinners(3, [seat(30, "a"), seat(41, "b")])).toEqual([]); //  guest took 20
    expect(enculetteWinners(3, [seat(20, "a"), seat(41, "b")])).toEqual(["a"]); // guest took 30
  });

  it("several guests: decided when the counts allow it, null otherwise", () => {
    expect(enculetteWinners(4, [seat(0, "a"), seat(41, "b")])).toEqual(["a"]); //   nobody beats 0
    expect(enculetteWinners(4, [seat(30, "a"), seat(41, "b")])).toEqual([]); //    guests share 20
    expect(enculetteWinners(4, [seat(10, "a"), seat(41, "b")])).toBeNull(); //     guests share 40
  });
});
