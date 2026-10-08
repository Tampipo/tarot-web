import { useEffect, useMemo, useState } from "react";
import {
  applyHouseRule,
  CONTRACT_LABEL,
  CONTRACTS,
  DECK_POINTS,
  scoreEnculette,
  scoreGame,
  ScoringError,
  TARGET_BY_OUDLERS,
  type Contract,
  type EnculetteInput,
  type EnculetteResult,
  type GameInput,
  type GameResult,
  type HouseRuleAdjustment,
  type HouseRuleId,
  type Poignee,
  type Side,
} from "@tarot/shared";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../contexts/auth";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Select,
  SideToggle,
  Spinner,
} from "../components/ui";
import { Roulette } from "../components/Roulette";
import { MysteryTaker } from "../components/MysteryTaker";
import { scoreClass, signed } from "../lib/format";
import type { SpunHouseRule } from "../lib/houseRules";
import type { Player, ScoreRow } from "../lib/types";

const POIGNEE_OPTIONS = [
  { value: "none", label: "No poignée" },
  { value: "simple", label: "Simple (20)" },
  { value: "double", label: "Double (30)" },
  { value: "triple", label: "Triple (40)" },
];

/**
 * The live score, tagged by which rules produced it — the two modes carry
 * genuinely different results (an enculette has no attack and so no baseScore),
 * so the tag is what lets the view read the right fields.
 */
type Preview =
  | { kind: "standard"; result: GameResult }
  | { kind: "enculette"; result: EnculetteResult }
  | { kind: "error"; message: string };

// A guest fills a seat so the deal scores correctly, but nothing about them is
// saved. Each seat gets its own marker so two guests never collide.
const GUEST_PREFIX = "guest:";
const isGuest = (id: string) => id.startsWith(GUEST_PREFIX);
const guestId = (seat: number) => `${GUEST_PREFIX}${seat}`;
/** The guest marker for the *second* half of a shared seat. */
const shareGuestId = (seat: number) => `${GUEST_PREFIX}share${seat}`;

// Who's seated persists across navigation/reloads, so only the deal itself
// (taker, contract, bonuses...) needs re-entering between games at the same
// table — that already resets on save, further down.
const TABLE_STORAGE_KEY = "tarot:newgame-table";

type StoredTable = {
  numPlayers: number;
  slots: string[];
  shared: boolean[];
  sharedWith: string[];
};

function loadStoredTable(): StoredTable | null {
  try {
    const raw = localStorage.getItem(TABLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTable;
    const n = parsed.numPlayers;
    if (
      (n !== 3 && n !== 4 && n !== 5) ||
      !Array.isArray(parsed.slots) ||
      parsed.slots.length !== n ||
      !Array.isArray(parsed.shared) ||
      parsed.shared.length !== n ||
      !Array.isArray(parsed.sharedWith) ||
      parsed.sharedWith.length !== n
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// The house rule a spin landed on for the next deal — saved with that deal —
// cached the same way the table seating is, so it survives navigating away
// and coming back.
const HOUSE_RULE_STORAGE_KEY = "tarot:newgame-house-rule";

function loadHouseRule(): SpunHouseRule | null {
  try {
    const raw = localStorage.getItem(HOUSE_RULE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SpunHouseRule) : null;
  } catch {
    return null;
  }
}

/**
 * What the API expects for the active house rule — `gamble` (did the taker
 * opt in?) rather than the actual coin flip, which only the server resolves.
 */
type HouseRuleRequest = {
  id: HouseRuleId;
  gamble?: boolean;
  cheatingCatches?: Record<string, number>;
};

export function NewGame() {
  const { isAdmin } = useAuth();
  const [players, setPlayers] = useState<Player[] | null>(null); // null = loading
  const [numPlayers, setNumPlayers] = useState(() => loadStoredTable()?.numPlayers ?? 4);
  const [slots, setSlots] = useState<string[]>(
    () => loadStoredTable()?.slots ?? ["", "", "", ""],
  );
  // Per seat: whether two people are sharing it, and who the second one is.
  // Kept as two arrays so ticking the box can reveal an empty picker without
  // the seat counting as shared until someone is actually chosen.
  const [shared, setShared] = useState<boolean[]>(
    () => loadStoredTable()?.shared ?? [false, false, false, false],
  );
  const [sharedWith, setSharedWith] = useState<string[]>(
    () => loadStoredTable()?.sharedWith ?? ["", "", "", ""],
  );
  // Enculette: nobody took, so there's no contract to fill in — just the card
  // points each seat ended up with, one entry per seat.
  const [enculette, setEnculette] = useState(false);
  const [cardPoints, setCardPoints] = useState<string[]>(() =>
    Array(loadStoredTable()?.numPlayers ?? 4).fill(""),
  );
  const [takerId, setTakerId] = useState("");
  const [alone, setAlone] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [contract, setContract] = useState<Contract | "">("");
  const [oudlers, setOudlers] = useState("");
  const [pointsMade, setPointsMade] = useState("");
  const [petitAuBout, setPetitAuBout] = useState<Side>("none");
  const [poignee, setPoignee] = useState<Poignee>("none");
  const [misere, setMisere] = useState<Side>("none");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rouletteOpen, setRouletteOpen] = useState(false);
  // "Mystery Taker": the phone-passing phase that secretly picks the taker.
  const [mysteryOpen, setMysteryOpen] = useState(false);
  const [activeRule, setActiveRule] = useState<SpunHouseRule | null>(() => loadHouseRule());
  // Season standings — fetched once, not re-checked live, since they're only
  // read at the moment of a spin or a save. Powers "Forced Petite" (the
  // overall leader) and "Redistribution" (tonight's seated players ranked).
  const [standings, setStandings] = useState<ScoreRow[]>([]);
  const leaderName = standings[0]?.name ?? null;
  // "Cheating Allowed": tracked player id -> times caught this deal.
  const [cheatingCatches, setCheatingCatches] = useState<Record<string, number>>({});
  // "Taker's Gamble": asked right before saving, not while previewing — the
  // whole point is deciding after seeing the deal's normal result.
  const [gambleOpen, setGambleOpen] = useState(false);

  function applyRouletteResult(rule: SpunHouseRule) {
    setActiveRule(rule);
    try {
      localStorage.setItem(HOUSE_RULE_STORAGE_KEY, JSON.stringify(rule));
    } catch {
      // Storage may be unavailable — the banner just won't survive a reload.
    }
  }

  function clearActiveRule() {
    setActiveRule(null);
    try {
      localStorage.removeItem(HOUSE_RULE_STORAGE_KEY);
    } catch {
      // Nothing to clean up if it was never stored.
    }
  }

  // The result card's own "Let's go!" button only exists for mystery-taker
  // today, but this stays generic — any future rule with an actionLabel would
  // land here too.
  function handleRouletteAction(rule: SpunHouseRule) {
    if (rule.id === "mystery-taker") {
      setRouletteOpen(false);
      setMysteryOpen(true);
    }
  }

  // The phone round builds the table itself (who's playing varies too much to
  // assume the seats below are already right), so it hands back the whole
  // seating, not just the taker. Nobody bit = the table's still set, just no
  // taker or contract pre-filled — fill the deal in as normal.
  function handleMysteryDone(outcome: {
    numPlayers: number;
    slots: string[];
    takerId: string | null;
  }) {
    setMysteryOpen(false);
    setEnculette(false);
    setTableSize(outcome.numPlayers);
    setSlots(outcome.slots);
    if (outcome.takerId) {
      setTakerId(outcome.takerId);
      setContract("garde_sans");
    }
  }

  useEffect(() => {
    api.get<Player[]>("/players").then((r) => {
      setPlayers(r.data);
      // Drop any cached seat that no longer names a real player (deleted
      // account) — guest markers are seat-local and always still valid.
      const validIds = new Set(r.data.map((p) => p.id));
      const stillValid = (id: string) => !id || isGuest(id) || validIds.has(id);
      setSlots((prev) => prev.map((id) => (stillValid(id) ? id : "")));
      setSharedWith((prev) => prev.map((id) => (stillValid(id) ? id : "")));
    });
    // Sorted by total desc — rows[0] is the current leader.
    api
      .get<ScoreRow[]>("/scoreboard")
      .then((r) => setStandings(r.data))
      .catch(() => setStandings([]));
  }, []);

  // Cache who's seated so the next deal — even after navigating away or
  // reloading — starts with the table already set.
  useEffect(() => {
    try {
      localStorage.setItem(
        TABLE_STORAGE_KEY,
        JSON.stringify({ numPlayers, slots, shared, sharedWith }),
      );
    } catch {
      // Storage may be unavailable (private browsing, quota) — the cache is
      // a convenience, not a requirement.
    }
  }, [numPlayers, slots, shared, sharedWith]);

  function setTableSize(n: number) {
    setNumPlayers(n);
    const resize = <T,>(prev: T[], fill: T) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(fill);
      return next;
    };
    setSlots((prev) => resize(prev, ""));
    setShared((prev) => resize(prev, false));
    setSharedWith((prev) => resize(prev, ""));
    setCardPoints((prev) => resize(prev, ""));
    if (n !== 5) {
      setAlone(false);
      setPartnerId("");
    }
    setSaved(null);
  }

  const chosen = slots.filter(Boolean);
  const usePartner = numPlayers === 5 && !alone;

  // Seat -> the person sharing it. Only fully-answered seats count, so a
  // half-filled split never reaches the scorer.
  const splitWith = useMemo(() => {
    const map: Record<string, string> = {};
    slots.forEach((id, i) => {
      if (id && shared[i] && sharedWith[i]) map[id] = sharedWith[i];
    });
    return map;
  }, [slots, shared, sharedWith]);
  // Ticked the box but not picked anyone yet — the deal isn't ready to score.
  const splitPending = slots.some((id, i) => id && shared[i] && !sharedWith[i]);

  // Everyone with a hand in the deal: seats plus whoever shares one.
  const everyone = [...chosen, ...Object.values(splitWith)];

  // Number the guests only when there's more than one, so picking a taker from
  // two "Guest" entries isn't a coin flip.
  const guestsSeated = everyone.filter(isGuest);
  const nameOf = (id: string) => {
    if (!isGuest(id)) return players?.find((p) => p.id === id)?.name ?? id;
    return guestsSeated.length > 1 ? `Guest ${guestsSeated.indexOf(id) + 1}` : "Guest";
  };
  // A shared seat is one player, so it reads as one entry — under both names.
  const seatLabel = (id: string) =>
    splitWith[id] ? `${nameOf(id)} & ${nameOf(splitWith[id])}` : nameOf(id);

  // Nobody may appear twice, whether seated or sharing — so both pickers offer
  // the same pool minus everyone already spoken for.
  const takenElsewhere = (id: string, seat: number, half: "seat" | "share") =>
    slots.some((s, i) => s === id && !(half === "seat" && i === seat)) ||
    sharedWith.some((s, i) => s === id && !(half === "share" && i === seat));

  // Options for one seat: every player not already picked elsewhere, plus Guest.
  // The roster itself is managed by admins, not from here.
  function slotOptions(index: number) {
    return [
      ...(players ?? [])
        .filter((p) => !takenElsewhere(p.id, index, "seat"))
        .map((p) => ({ value: p.id, label: p.name })),
      { value: guestId(index), label: "Guest (not recorded)" },
    ];
  }
  // The other half of a shared seat. Its guest marker differs from the seat's
  // own so a seat can be two guests without the two collapsing into one id.
  function shareOptions(index: number) {
    return [
      ...(players ?? [])
        .filter((p) => !takenElsewhere(p.id, index, "share"))
        .map((p) => ({ value: p.id, label: p.name })),
      { value: shareGuestId(index), label: "Guest (not recorded)" },
    ];
  }
  // Anyone seated can take or be called, guests included — their share just
  // goes unrecorded. A shared seat takes as a pair.
  const seatedOptions = chosen.map((id) => ({
    value: id,
    label: seatLabel(id),
  }));
  // A deal with no members would record nothing at all.
  const hasMember = everyone.some((id) => !isGuest(id));

  // Only currently-seated, non-guest ids count — a catch logged for someone
  // who's since left the table is dropped rather than silently sent along.
  const trackedCheatingCatches = useMemo(() => {
    const trackedIds = new Set(everyone.filter((id) => !isGuest(id)));
    const out: Record<string, number> = {};
    for (const [id, count] of Object.entries(cheatingCatches)) {
      if (trackedIds.has(id) && count > 0) out[id] = count;
    }
    return out;
  }, [cheatingCatches, everyone]);

  // Tonight's tracked seats with their season total, for "Redistribution" —
  // only these people can receive that transfer, since only they get a
  // GamePlayer row for this deal. Missing from the season counts as 0.
  const seatedStandings = useMemo(() => {
    const trackedIds = [...new Set(everyone.filter((id) => !isGuest(id)))];
    return trackedIds.map((id) => ({
      id,
      name: nameOf(id),
      total: standings.find((s) => s.id === id)?.total ?? 0,
    }));
  }, [everyone, standings]);

  // Best season total to worst, among tonight's tracked seats.
  const seasonRanking = useMemo(
    () => [...seatedStandings].sort((a, b) => b.total - a.total).map((p) => p.id),
    [seatedStandings],
  );

  // The deterministic house-rule effects the live preview can already show —
  // "taker-gamble" excluded, since its coin only flips once you commit to it.
  const previewAdjustment: HouseRuleAdjustment | undefined = useMemo(() => {
    const ruleId = activeRule?.id;
    switch (ruleId) {
      case "double-points":
      case "big-dog-no-partner":
        return { id: ruleId };
      case "cheating-allowed":
        return { id: ruleId, cheatingCatches: trackedCheatingCatches };
      case "great-equalizer":
        return { id: ruleId, seasonRanking };
      default:
        return undefined;
    }
  }, [activeRule?.id, trackedCheatingCatches, seasonRanking]);

  function buildHouseRulePayload(gamble?: boolean): HouseRuleRequest | undefined {
    const ruleId = activeRule?.id;
    switch (ruleId) {
      case undefined:
        return undefined;
      case "cheating-allowed":
        return { id: ruleId, cheatingCatches: trackedCheatingCatches };
      case "taker-gamble":
        return { id: ruleId, gamble };
      default:
        // Every other rule goes by id alone, table-talk ones included — the
        // deal records which rule it was played under. The equalizer's ranking
        // isn't sent: the API recomputes it from the DB itself, the same way
        // it resolves the gamble's coin.
        return { id: ruleId };
    }
  }

  // Build a GameInput and score it live. Any inconsistency (unfilled slot, bad
  // partner…) surfaces as `null` so the preview and Save button stay disabled.
  const input: GameInput | null = useMemo(() => {
    if (enculette) return null;
    if (chosen.length !== numPlayers) return null;
    if (new Set(chosen).size !== numPlayers) return null;
    if (splitPending) return null;
    if (!takerId || !chosen.includes(takerId)) return null;
    if (usePartner && (!partnerId || partnerId === takerId)) return null;
    if (!contract) return null;
    if (oudlers === "" || pointsMade === "") return null;
    return {
      playerIds: chosen,
      splitWith,
      takerId,
      partnerId: usePartner ? partnerId : null,
      contract,
      oudlers: Number(oudlers),
      pointsMade: Number(pointsMade),
      petitAuBout,
      poignee,
      misere,
    };
  }, [
    enculette,
    chosen,
    numPlayers,
    splitWith,
    splitPending,
    takerId,
    usePartner,
    partnerId,
    contract,
    oudlers,
    pointsMade,
    petitAuBout,
    poignee,
    misere,
  ]);

  // The same, for an enculette: one card-points entry per seat, since a shared
  // seat still played a single hand between the two of them.
  const encInput: EnculetteInput | null = useMemo(() => {
    if (!enculette) return null;
    if (chosen.length !== numPlayers) return null;
    if (new Set(chosen).size !== numPlayers) return null;
    if (splitPending) return null;
    const points: Record<string, number> = {};
    for (let i = 0; i < numPlayers; i++) {
      const id = slots[i];
      if (!id || cardPoints[i] === "") return null;
      points[id] = Number(cardPoints[i]);
    }
    return { playerIds: chosen, splitWith, cardPoints: points };
  }, [enculette, chosen, numPlayers, splitPending, slots, cardPoints, splitWith]);

  // Running total, so a miscount shows up before saving rather than as a
  // rejection: a deal always deals out exactly 91 card points.
  const pointsEntered = cardPoints
    .slice(0, numPlayers)
    .reduce((total, v) => total + (v === "" ? 0 : Number(v)), 0);

  const preview: Preview | null = useMemo(() => {
    try {
      if (encInput) return { kind: "enculette", result: scoreEnculette(encInput) };
      if (input) {
        const raw = scoreGame(input);
        return { kind: "standard", result: applyHouseRule(raw, input, previewAdjustment) };
      }
      return null;
    } catch (e) {
      return e instanceof ScoringError ? { kind: "error", message: e.message } : null;
    }
  }, [input, encInput, previewAdjustment]);

  // Preview still scores an all-guest table (the maths is fine); it just can't
  // be saved, since there'd be no score to record for anyone.
  const scored = preview && preview.kind !== "error" ? preview : null;
  const canSave = Boolean(scored && hasMember);

  // "Taker's Gamble" is decided right before saving, not while previewing —
  // clicking Save opens that dialog instead of saving outright; every other
  // rule (or none) saves immediately.
  function handleSaveClick() {
    if (!enculette && activeRule?.id === "taker-gamble") {
      setGambleOpen(true);
      return;
    }
    performSave();
  }

  async function performSave(gamble?: boolean) {
    const payload = encInput
      ? {
          mode: "enculette",
          ...encInput,
          // No house rule changes an enculette's score — only its id is sent,
          // so the deal still records what the wheel landed on.
          houseRule: activeRule ? { id: activeRule.id } : undefined,
        }
      : input
        ? { ...input, houseRule: buildHouseRulePayload(gamble) }
        : null;
    if (!payload) return;
    setError(null);
    setSaving(true);
    setGambleOpen(false);
    try {
      const { data } = await api.post<{
        result: GameResult | EnculetteResult;
        gambleOutcome?: "doubled" | "zeroed";
      }>("/games", payload);
      // The server's actual result, not the client preview — the gamble's
      // coin flip only exists once it comes back. "baseScore" only exists on
      // a standard deal's result, never an enculette's.
      const standardResult = "baseScore" in data.result ? data.result : null;
      const gambleNote =
        data.gambleOutcome === "doubled"
          ? " 🎲 Gambled it — doubled!"
          : data.gambleOutcome === "zeroed"
            ? " 🎲 Gambled it — wiped to zero."
            : "";
      setSaved(
        standardResult
          ? `Game saved — attack ${standardResult.won ? "won" : "lost"} ${Math.abs(standardResult.baseScore)} points.${gambleNote}`
          : "Game saved.",
      );
      // Keep the table seated for the next deal; reset the deal details and
      // whatever the roulette landed on — it was for *this* game, not every
      // game from here on.
      setTakerId("");
      setPartnerId("");
      setContract("");
      setOudlers("");
      setPointsMade("");
      setPetitAuBout("none");
      setPoignee("none");
      setMisere("none");
      setAlone(false);
      setCardPoints((prev) => prev.map(() => ""));
      setCheatingCatches({});
      clearActiveRule();
      // Standings just moved (this game's own scores, and possibly the
      // equalizer's transfer) — refetch so the next spin/preview isn't
      // working off numbers from before this save.
      api
        .get<ScoreRow[]>("/scoreboard")
        .then((r) => setStandings(r.data))
        .catch(() => {
          // Keep the previous standings rather than blanking a working cache.
        });
    } catch (err) {
      setError(errorMessage(err, "Could not save the game"));
    } finally {
      setSaving(false);
    }
  }

  if (players === null) return <Spinner />;

  // The taker must be a registered player, so an empty roster can't be scored.
  if (players.length === 0) {
    return (
      <Card title="New game">
        <div className="empty">
          No players yet — the taker has to be a registered player.{" "}
          {isAdmin ? (
            <Link to="/admin" style={{ color: "var(--primary)" }}>
              Add players on the Admin page
            </Link>
          ) : (
            "Ask an admin to add some."
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="stack">
      {activeRule && (
        <Alert kind="success">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>
              {activeRule.emoji} <strong>House rule:</strong> {activeRule.label}
              {activeRule.description && <> — {activeRule.description}</>}
            </span>
            <div className="row" style={{ gap: 8 }}>
              {activeRule.id === "mystery-taker" && (
                <Button
                  variant="default"
                  className="btn-sm"
                  onClick={() => setMysteryOpen(true)}
                >
                  🎭 Start
                </Button>
              )}
              <Button variant="ghost" className="btn-sm" onClick={clearActiveRule}>
                Clear
              </Button>
            </div>
          </div>
        </Alert>
      )}

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button variant="default" onClick={() => setRouletteOpen(true)}>
          🎲 Launch the roulette for next game
        </Button>
      </div>

      <Modal open={rouletteOpen} onClose={() => setRouletteOpen(false)} title="House rule roulette">
        <Roulette
          context={{ seatedNames: chosen.map(nameOf), leaderName, seatedStandings }}
          onResult={applyRouletteResult}
          onAction={handleRouletteAction}
        />
      </Modal>

      <Modal open={mysteryOpen} onClose={() => setMysteryOpen(false)} title="🎭 Mystery Taker">
        <MysteryTaker players={players} onDone={handleMysteryDone} />
      </Modal>

      <Card title="New game" subtitle="Record a deal and split the score.">
        <div className="stack">
          {/* Which rules — the whole form below changes with it. */}
          <Field label="Deal">
            <div className="segmented">
              <button
                type="button"
                className="seg"
                aria-pressed={!enculette}
                onClick={() => {
                  setEnculette(false);
                  setSaved(null);
                }}
              >
                Standard
              </button>
              <button
                type="button"
                className="seg"
                aria-pressed={enculette}
                onClick={() => {
                  setEnculette(true);
                  setSaved(null);
                }}
              >
                Enculette
              </button>
            </div>
          </Field>

          {/* Table size */}
          <Field label="Players at the table">
            <div className="segmented">
              {[3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="seg"
                  aria-pressed={numPlayers === n}
                  onClick={() => setTableSize(n)}
                >
                  {n} players
                </button>
              ))}
            </div>
          </Field>

          {/* Seats */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            {slots.map((val, i) => (
              <Field key={i} label={`Seat ${i + 1}`}>
                <div className="stack" style={{ gap: 8 }}>
                  <Select
                    placeholder="Select player"
                    value={val}
                    options={slotOptions(i)}
                    onChange={(e) => {
                      const next = [...slots];
                      next[i] = e.target.value;
                      setSlots(next);
                      // Whoever left this seat can no longer hold a role.
                      if (takerId === val) setTakerId("");
                      if (partnerId === val) setPartnerId("");
                    }}
                  />
                  <label className="row" style={{ gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={shared[i] ?? false}
                      onChange={(e) => {
                        const next = [...shared];
                        next[i] = e.target.checked;
                        setShared(next);
                        // Un-ticking drops the second person entirely.
                        if (!e.target.checked) {
                          const w = [...sharedWith];
                          w[i] = "";
                          setSharedWith(w);
                        }
                      }}
                    />
                    <span className="muted">Split seat</span>
                  </label>
                  {shared[i] && (
                    <Select
                      placeholder="Sharing with"
                      value={sharedWith[i] ?? ""}
                      options={shareOptions(i)}
                      onChange={(e) => {
                        const next = [...sharedWith];
                        next[i] = e.target.value;
                        setSharedWith(next);
                      }}
                    />
                  )}
                  {/* One count per seat: a shared seat played a single hand. */}
                  {enculette && (
                    <Input
                      type="number"
                      min={0}
                      max={DECK_POINTS}
                      value={cardPoints[i] ?? ""}
                      placeholder="Card points taken"
                      onChange={(e) => {
                        const next = [...cardPoints];
                        next[i] = e.target.value;
                        setCardPoints(next);
                      }}
                    />
                  )}
                </div>
              </Field>
            ))}
          </div>

          {enculette && (
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              {pointsEntered} / {DECK_POINTS} card points entered
              {pointsEntered !== DECK_POINTS && " — the table must add up to 91"}
            </div>
          )}

          {/* Nobody took, so there is no contract, role or bonus to record. */}
          {!enculette && (
            <>
              <hr className="hr" />

              {/* Roles */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <Field label="Taker">
                  <Select
                    placeholder="Who took?"
                    value={takerId}
                    options={seatedOptions}
                    onChange={(e) => setTakerId(e.target.value)}
                  />
                </Field>

                {numPlayers === 5 && (
                  <Field label="Partner">
                    <div className="stack" style={{ gap: 8 }}>
                      {usePartner && (
                        <Select
                          placeholder="Called partner"
                          value={partnerId}
                          options={seatedOptions.filter((o) => o.value !== takerId)}
                          onChange={(e) => setPartnerId(e.target.value)}
                        />
                      )}
                      <label className="row" style={{ gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={alone}
                          onChange={(e) => setAlone(e.target.checked)}
                        />
                        <span className="muted">Taker plays alone</span>
                      </label>
                    </div>
                  </Field>
                )}

                <Field label="Contract">
                  <Select
                    placeholder="Which bid?"
                    value={contract}
                    options={CONTRACTS.map((c) => ({
                      value: c,
                      label: CONTRACT_LABEL[c],
                    }))}
                    onChange={(e) => setContract(e.target.value as Contract)}
                  />
                </Field>

                <Field label="Oudlers (bouts)">
                  <Select
                    placeholder="0–3"
                    value={oudlers}
                    options={[0, 1, 2, 3].map((n) => ({
                      value: String(n),
                      label: String(n),
                    }))}
                    onChange={(e) => setOudlers(e.target.value)}
                  />
                </Field>

                <Field label="Attack card points (0–91)">
                  <Input
                    type="number"
                    min={0}
                    max={91}
                    value={pointsMade}
                    onChange={(e) => setPointsMade(e.target.value)}
                    placeholder={
                      oudlers !== ""
                        ? `needs ≥ ${TARGET_BY_OUDLERS[Number(oudlers)]}`
                        : "0–91"
                    }
                  />
                </Field>
              </div>

              <hr className="hr" />

              {/* Bonuses */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <Field label="Petit au bout">
                  <SideToggle value={petitAuBout} onChange={setPetitAuBout} />
                </Field>
                <Field label="Misère">
                  <SideToggle value={misere} onChange={setMisere} />
                </Field>
                {/* Size only — the bonus goes to whichever camp wins the deal. */}
                <Field label="Poignée">
                  <Select
                    value={poignee}
                    options={POIGNEE_OPTIONS}
                    onChange={(e) => setPoignee(e.target.value as Poignee)}
                  />
                </Field>
              </div>

              {/* House rule: cheating is allowed, but each catch costs −50. */}
              {activeRule?.id === "cheating-allowed" && (
                <>
                  <hr className="hr" />
                  <Field label="Caught cheating (−50 each)">
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
                    >
                      {[...new Set(everyone)]
                        .filter((id) => !isGuest(id))
                        .map((id) => (
                          <div
                            key={id}
                            className="row"
                            style={{ justifyContent: "space-between", gap: 8 }}
                          >
                            <span>{nameOf(id)}</span>
                            <Input
                              type="number"
                              min={0}
                              max={20}
                              style={{ width: 72 }}
                              value={cheatingCatches[id] ?? ""}
                              placeholder="0"
                              onChange={(e) => {
                                const v = e.target.value === "" ? 0 : Number(e.target.value);
                                setCheatingCatches((prev) => ({ ...prev, [id]: v }));
                              }}
                            />
                          </div>
                        ))}
                    </div>
                  </Field>
                </>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Live result */}
      {preview?.kind === "error" && <Alert kind="danger">{preview.message}</Alert>}

      {scored && (
        <Card
          title={
            scored.kind === "standard" ? (
              <span className={scored.result.won ? "score pos" : "score neg"}>
                Attack {scored.result.won ? "wins" : "loses"}{" "}
                {Math.abs(scored.result.baseScore)}
              </span>
            ) : (
              <span>Enculette</span>
            )
          }
          subtitle={
            scored.kind === "standard"
              ? "Live score — how the deal splits across the table."
              : "Live score — everyone banks the points they didn't take."
          }
        >
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Role</th>
                  <th className="num">Score</th>
                </tr>
              </thead>
              <tbody>
                {chosen
                  // A shared seat contributes both its occupants, one after the
                  // other, each with their half.
                  .flatMap((seatId) =>
                    splitWith[seatId]
                      ? [
                          { id: seatId, seatId },
                          { id: splitWith[seatId], seatId },
                        ]
                      : [{ id: seatId, seatId }],
                  )
                  .map(({ id, seatId }) => {
                    const role =
                      seatId === takerId
                        ? "Taker"
                        : usePartner && seatId === partnerId
                          ? "Partner"
                          : "Defence";
                    const s = scored.result.scores[id];
                    const guest = isGuest(id);
                    return (
                      <tr key={id}>
                        <td style={{ fontWeight: 600 }}>
                          {nameOf(id)}
                          {guest && (
                            <span className="muted" style={{ fontWeight: 400 }}>
                              {" "}
                              · not recorded
                            </span>
                          )}
                        </td>
                        <td className="muted">
                          {role}
                          {splitWith[seatId] && " · ½ seat"}
                        </td>
                        <td className="num">
                          <span className={scoreClass(s)}>{signed(s)}</span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {scored && !hasMember && (
        <Alert kind="danger">
          Everyone at this table is a guest, so there would be nothing to record. Seat at
          least one member.
        </Alert>
      )}
      {error && <Alert kind="danger">{error}</Alert>}
      {saved && <Alert kind="success">{saved}</Alert>}

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={handleSaveClick} disabled={!canSave} loading={saving}>
          Save game
        </Button>
      </div>

      <Modal open={gambleOpen} onClose={() => setGambleOpen(false)} title="🎲 Taker's Gamble">
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            {takerId && nameOf(takerId)} can bet it all on a coin flip: heads doubles this
            deal's result, tails wipes it to zero.
          </p>
          <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
            <Button variant="ghost" onClick={() => performSave(false)}>
              Play it safe
            </Button>
            <Button variant="primary" onClick={() => performSave(true)}>
              Gamble it!
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
