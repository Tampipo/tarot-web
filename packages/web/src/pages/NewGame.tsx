import { useEffect, useMemo, useState } from "react";
import {
  CONTRACT_LABEL,
  CONTRACTS,
  scoreGame,
  ScoringError,
  TARGET_BY_OUDLERS,
  type Contract,
  type GameInput,
  type Poignee,
  type Side,
} from "@tarot/shared";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { Alert, Button, Card, Field, Input, Select, SideToggle, Spinner } from "../components/ui";
import { scoreClass, signed } from "../lib/format";
import type { Player } from "../lib/types";

const POIGNEE_OPTIONS = [
  { value: "none", label: "No poignée" },
  { value: "simple", label: "Simple (20)" },
  { value: "double", label: "Double (30)" },
  { value: "triple", label: "Triple (40)" },
];

// A guest fills a seat so the deal scores correctly, but nothing about them is
// saved. Each seat gets its own marker so two guests never collide.
const GUEST_PREFIX = "guest:";
const isGuest = (id: string) => id.startsWith(GUEST_PREFIX);
const guestId = (seat: number) => `${GUEST_PREFIX}${seat}`;

export function NewGame() {
  const [players, setPlayers] = useState<Player[] | null>(null); // null = loading
  const [numPlayers, setNumPlayers] = useState(4);
  const [slots, setSlots] = useState<string[]>(["", "", "", ""]);
  const [takerId, setTakerId] = useState("");
  const [alone, setAlone] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [contract, setContract] = useState<Contract | "">("");
  const [oudlers, setOudlers] = useState("");
  const [pointsMade, setPointsMade] = useState("");
  const [petitAuBout, setPetitAuBout] = useState<Side>("none");
  const [poignee, setPoignee] = useState<Poignee>("none");
  const [poigneeSide, setPoigneeSide] = useState<Side>("none");
  const [misere, setMisere] = useState<Side>("none");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Player[]>("/players").then((r) => setPlayers(r.data));
  }, []);

  function setTableSize(n: number) {
    setNumPlayers(n);
    setSlots((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
    if (n !== 5) {
      setAlone(false);
      setPartnerId("");
    }
    setSaved(null);
  }

  const nameOf = (id: string) =>
    isGuest(id) ? "Guest" : (players?.find((p) => p.id === id)?.name ?? id);
  const chosen = slots.filter(Boolean);
  const usePartner = numPlayers === 5 && !alone;

  // Options for one seat: every player not already picked elsewhere, plus Guest.
  function slotOptions(index: number) {
    return [
      ...(players ?? [])
        .filter((p) => !slots.some((s, i) => i !== index && s === p.id))
        .map((p) => ({ value: p.id, label: p.name })),
      { value: guestId(index), label: "Guest (not recorded)" },
    ];
  }
  // Taker and partner must be registered — a guest can only defend.
  const seatedOptions = chosen
    .filter((id) => !isGuest(id))
    .map((id) => ({ value: id, label: nameOf(id) }));

  // Build a GameInput and score it live. Any inconsistency (unfilled slot, bad
  // partner…) surfaces as `null` so the preview and Save button stay disabled.
  const input: GameInput | null = useMemo(() => {
    if (chosen.length !== numPlayers) return null;
    if (new Set(chosen).size !== numPlayers) return null;
    if (!takerId || !chosen.includes(takerId)) return null;
    if (usePartner && (!partnerId || partnerId === takerId)) return null;
    if (!contract) return null;
    if (oudlers === "" || pointsMade === "") return null;
    if (poignee !== "none" && poigneeSide === "none") return null;
    return {
      playerIds: chosen,
      takerId,
      partnerId: usePartner ? partnerId : null,
      contract,
      oudlers: Number(oudlers),
      pointsMade: Number(pointsMade),
      petitAuBout,
      poignee,
      poigneeSide: poignee === "none" ? "none" : poigneeSide,
      misere,
    };
  }, [
    chosen, numPlayers, takerId, usePartner, partnerId, contract, oudlers,
    pointsMade, petitAuBout, poignee, poigneeSide, misere,
  ]);

  const preview = useMemo(() => {
    if (!input) return null;
    try {
      return scoreGame(input);
    } catch (e) {
      return e instanceof ScoringError ? { error: e.message } : null;
    }
  }, [input]);

  const previewOk = preview && !("error" in preview);

  async function save() {
    if (!input) return;
    setError(null);
    setSaving(true);
    try {
      await api.post("/games", input);
      setSaved(
        preview && "baseScore" in preview
          ? `Game saved — attack ${preview.won ? "won" : "lost"} ${Math.abs(preview.baseScore)} points.`
          : "Game saved.",
      );
      // Keep the table seated for the next deal; reset only the deal details.
      setTakerId("");
      setPartnerId("");
      setContract("");
      setOudlers("");
      setPointsMade("");
      setPetitAuBout("none");
      setPoignee("none");
      setPoigneeSide("none");
      setMisere("none");
      setAlone(false);
    } catch (err) {
      setError(errorMessage(err, "Could not save the game"));
    } finally {
      setSaving(false);
    }
  }

  if (players === null) return <Spinner />;

  // Guests can fill any defending seat, but the taker must be registered — so
  // one real player is the minimum to score anything.
  if (players.length === 0) {
    return (
      <Card title="New game">
        <div className="empty">
          No players yet. <Link to="/players" style={{ color: "var(--primary)" }}>Add a player</Link>{" "}
          first — the taker has to be a registered player. Everyone else can sit in as a guest.
        </div>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card title="New game" subtitle="Record a deal and split the score.">
        <div className="stack">
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
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {slots.map((val, i) => (
              <Field key={i} label={`Seat ${i + 1}`}>
                <Select
                  placeholder="Select player"
                  value={val}
                  options={slotOptions(i)}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = e.target.value;
                    setSlots(next);
                    if (takerId === val) setTakerId("");
                    if (partnerId === val) setPartnerId("");
                  }}
                />
              </Field>
            ))}
          </div>

          <hr className="hr" />

          {/* Roles */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
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
                  <label className="row" style={{ gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={alone}
                      onChange={(e) => setAlone(e.target.checked)}
                    />
                    <span className="muted">Taker plays alone</span>
                  </label>
                  {usePartner && (
                    <Select
                      placeholder="Called partner"
                      value={partnerId}
                      options={seatedOptions.filter((o) => o.value !== takerId)}
                      onChange={(e) => setPartnerId(e.target.value)}
                    />
                  )}
                </div>
              </Field>
            )}

            <Field label="Contract">
              <Select
                placeholder="Which bid?"
                value={contract}
                options={CONTRACTS.map((c) => ({ value: c, label: CONTRACT_LABEL[c] }))}
                onChange={(e) => setContract(e.target.value as Contract)}
              />
            </Field>

            <Field label="Oudlers (bouts)">
              <Select
                placeholder="0–3"
                value={oudlers}
                options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))}
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
                  oudlers !== "" ? `needs ≥ ${TARGET_BY_OUDLERS[Number(oudlers)]}` : "0–91"
                }
              />
            </Field>
          </div>

          <hr className="hr" />

          {/* Bonuses */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Field label="Petit au bout">
              <SideToggle value={petitAuBout} onChange={setPetitAuBout} />
            </Field>
            <Field label="Misère">
              <SideToggle value={misere} onChange={setMisere} />
            </Field>
            <Field label="Poignée">
              <Select
                value={poignee}
                options={POIGNEE_OPTIONS}
                onChange={(e) => {
                  const v = e.target.value as Poignee;
                  setPoignee(v);
                  if (v === "none") setPoigneeSide("none");
                  else if (poigneeSide === "none") setPoigneeSide("attack");
                }}
              />
            </Field>
            {poignee !== "none" && (
              <Field label="Poignée camp">
                <SideToggle value={poigneeSide} onChange={setPoigneeSide} />
              </Field>
            )}
          </div>
        </div>
      </Card>

      {/* Live result */}
      {preview && "error" in preview && <Alert kind="danger">{preview.error}</Alert>}

      {previewOk && preview && "scores" in preview && (
        <Card
          title={
            <span className={preview.won ? "score pos" : "score neg"}>
              Attack {preview.won ? "wins" : "loses"} {Math.abs(preview.baseScore)}
            </span>
          }
          subtitle="Live score — how the deal splits across the table."
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
                {chosen.map((id) => {
                  const role =
                    id === takerId
                      ? "Taker"
                      : usePartner && id === partnerId
                        ? "Partner"
                        : "Defence";
                  const s = preview.scores[id];
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
                      <td className="muted">{role}</td>
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

      {error && <Alert kind="danger">{error}</Alert>}
      {saved && <Alert kind="success">{saved}</Alert>}

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={save} disabled={!previewOk} loading={saving}>
          Save game
        </Button>
      </div>
    </div>
  );
}
