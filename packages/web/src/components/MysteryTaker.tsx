import { useState } from "react";
import { Alert, Button, Field } from "./ui";
import type { Player } from "../lib/types";

// Not a real id — a placeholder for "this turn is someone who isn't picked
// yet" until `next()` mints it a real, numbered guest marker.
const GUEST_PICK = "__guest__";

const KINGS = [
  { value: "hearts", label: "♥️ Hearts" },
  { value: "diamonds", label: "♦️ Diamonds" },
  { value: "clubs", label: "♣️ Clubs" },
  { value: "spades", label: "♠️ Spades" },
];

interface Response {
  takes: boolean;
  /** Only set when `takes` and the table ends up at 5 (a partner can be called). */
  king?: string;
}

function kingLabel(value: string | undefined): string | null {
  return KINGS.find((k) => k.value === value)?.label ?? null;
}

/** Once the round's done: either nobody bit, or exactly one did — two or more restarts the whole round instead. */
type Outcome = { kind: "pending" } | { kind: "done"; takerId: string | null; king?: string };

/**
 * Who's actually at the table tonight varies game to game, so this doesn't
 * rely on the seats already being filled in on the main form — it builds the
 * table itself, from the full roster plus however many guests show up, and
 * hands back the whole seating (not just the taker) once it's done.
 *
 * The phone gets physically passed around: each holder picks themselves (or
 * "Guest" for a non-member) from whoever's left, says whether they take, and
 * — if the table lands on 5 — which king they'd call if so. Nobody else sees
 * another's answer, and even once the round resolves, nothing here ever names
 * *who* the taker turned out to be (the called king is fair game, since it
 * doesn't out anyone) — that's for the table to discover once the cards are
 * actually dealt. If two or more bid, there's no way to keep it secret while
 * also telling everyone a number, so the whole round just restarts, visibly
 * but anonymously.
 */
export function MysteryTaker({
  players,
  onDone,
}: {
  players: Player[];
  onDone: (outcome: { numPlayers: number; slots: string[]; takerId: string | null }) => void;
}) {
  const [tableSize, setTableSize] = useState<number | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [outcome, setOutcome] = useState<Outcome>({ kind: "pending" });
  // How many times a tie forced the round back to the start — shown as a
  // plain heads-up, never who or how many said yes.
  const [restarts, setRestarts] = useState(0);

  // This step's not-yet-submitted answer.
  const [whoId, setWhoId] = useState("");
  const [takes, setTakes] = useState<boolean | null>(null);
  const [king, setKing] = useState("");

  const needsKing = takes === true && tableSize === 5;
  const canAdvance = whoId !== "" && takes !== null && (!needsKing || king !== "");

  function pick(id: string) {
    setWhoId(id);
    setTakes(null);
    setKing("");
  }

  function next() {
    // The main form's own seat pickers build their guest marker from the seat
    // *index* ("guest:<seat>"), not from an arrival-order count — matching
    // that here is what lets this participant show up correctly once the
    // round hands the seating back to that form.
    const finalId = whoId === GUEST_PICK ? `guest:${participants.length}` : whoId;

    const updated: Record<string, Response> = {
      ...responses,
      [finalId]: { takes: takes as boolean, king: needsKing ? king : undefined },
    };
    const nextParticipants = [...participants, finalId];
    setWhoId("");
    setTakes(null);
    setKing("");

    if (nextParticipants.length < (tableSize as number)) {
      setResponses(updated);
      setParticipants(nextParticipants);
      return;
    }

    const takerIds = nextParticipants.filter((id) => updated[id].takes);
    if (takerIds.length > 1) {
      setRestarts((c) => c + 1);
      setResponses({});
      setParticipants([]);
      return;
    }
    setParticipants(nextParticipants);
    const takerId = takerIds[0] ?? null;
    setOutcome({ kind: "done", takerId, king: takerId ? updated[takerId]?.king : undefined });
  }

  if (tableSize === null) {
    return (
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>
          How many are playing tonight?
        </p>
        <div className="segmented">
          {[3, 4, 5].map((n) => (
            <button key={n} type="button" className="seg" onClick={() => setTableSize(n)}>
              {n} players
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (outcome.kind === "pending") {
    const step = participants.length + 1;
    const available = players.filter((p) => !participants.includes(p.id));
    return (
      <div className="stack">
        {restarts > 0 && (
          <Alert kind="danger">⚠️ Too many players took — restarting the player choice.</Alert>
        )}
        <p className="muted" style={{ margin: 0 }}>
          Pass the phone — player {step} of {tableSize}.
        </p>
        <Field label="Who are you?">
          <div className="row" style={{ gap: 8 }}>
            {available.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant={whoId === p.id ? "primary" : "default"}
                className="btn-sm"
                onClick={() => pick(p.id)}
              >
                {p.name}
              </Button>
            ))}
            <Button
              type="button"
              variant={whoId === GUEST_PICK ? "primary" : "default"}
              className="btn-sm"
              onClick={() => pick(GUEST_PICK)}
            >
              🙈 Guest
            </Button>
          </div>
        </Field>
        {whoId && (
          <Field label="Do you take?">
            <div className="segmented">
              <button
                type="button"
                className="seg"
                aria-pressed={takes === false}
                onClick={() => setTakes(false)}
              >
                No
              </button>
              <button
                type="button"
                className="seg"
                aria-pressed={takes === true}
                onClick={() => setTakes(true)}
              >
                Yes
              </button>
            </div>
          </Field>
        )}
        {needsKing && (
          <Field label="Call a king">
            <div className="row" style={{ gap: 8 }}>
              {KINGS.map((k) => (
                <Button
                  key={k.value}
                  type="button"
                  variant={king === k.value ? "primary" : "default"}
                  className="btn-sm"
                  onClick={() => setKing(k.value)}
                >
                  {k.label}
                </Button>
              ))}
            </div>
          </Field>
        )}
        <Button variant="primary" block disabled={!canAdvance} onClick={next}>
          {participants.length === tableSize - 1 ? "Reveal" : "Pass the phone →"}
        </Button>
      </div>
    );
  }

  // outcome.kind === "done" — the king is fair game to announce (it doesn't
  // out anyone), but who's actually taking never gets named here — that's
  // for the table to find out once the cards are dealt.
  const king2 = kingLabel(outcome.king);
  return (
    <div className="stack">
      <p>
        {outcome.takerId === null
          ? "😶 Nobody took — the table's set, just fill in the deal as normal."
          : king2
            ? `✅ The taker's been chosen, calling ${king2}.`
            : "✅ The taker's been chosen."}
      </p>
      <Button
        variant="primary"
        block
        onClick={() =>
          onDone({ numPlayers: tableSize, slots: participants, takerId: outcome.takerId })
        }
      >
        Continue
      </Button>
    </div>
  );
}
