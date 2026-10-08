import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/auth";
import { Button, Card, Select, Spinner, Tile } from "../components/ui";
import { MedalStrip } from "../components/Medals";
import { scoreClass, signed } from "../lib/format";
import { standingsOf, tallyOf, type MedalsDTO } from "../lib/medals";
import type { Player, ScoreRow, Season } from "../lib/types";

const MAX_SUGGESTIONS = 8;

/** Case- and accent-insensitive, so "eloise" finds "Éloïse". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Type-ahead over every approved member — not just this season's ranked
 * players, so you can look someone up even when they haven't played yet.
 */
function PlayerSearch({
  players,
  meId,
  onPick,
}: {
  players: Player[];
  meId?: string;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = fold(query.trim());
    return players.filter((p) => fold(p.name).includes(q)).slice(0, MAX_SUGGESTIONS);
  }, [players, query]);

  function pick(id: string) {
    onPick(id);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      pick(matches[active].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="search">
      <input
        className="input"
        type="search"
        placeholder="Search a player…"
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls="player-search-list"
        aria-activedescendant={open && matches[active] ? `player-opt-${matches[active].id}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="search-list" id="player-search-list" role="listbox">
          {matches.length === 0 ? (
            <li className="search-empty">No player matches “{query.trim()}”.</li>
          ) : (
            matches.map((p, i) => (
              <li
                key={p.id}
                id={`player-opt-${p.id}`}
                role="option"
                aria-selected={i === active}
                className="search-item"
                // mousedown, not click: it fires before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p.id);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {p.name}
                {p.id === meId && <span className="muted"> (you)</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function Stats() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [medals, setMedals] = useState<MedalsDTO | null>(null);
  // Every closed season's medals, whatever period is selected: the tally of past seasons.
  const [pastMedals, setPastMedals] = useState<MedalsDTO | null>(null);
  // Both live in the URL so the scoreboard can link straight to someone's
  // stats: ?player=<id> (absent = you), ?season=<id>|all (absent = in progress).
  const [searchParams, setSearchParams] = useSearchParams();
  const playerParam = searchParams.get("player");
  const season = searchParams.get("season") ?? "";

  useEffect(() => {
    api.get<Season[]>("/seasons").then((r) => setSeasons(r.data));
    api.get<Player[]>("/players").then((r) => setPlayers(r.data));
    api.get<MedalsDTO>("/medals", { params: { season: "all" } }).then((r) => setPastMedals(r.data));
  }, []);

  useEffect(() => {
    setRows(null);
    api
      .get<ScoreRow[]>("/scoreboard", { params: season ? { season } : {} })
      .then((r) => setRows(r.data));
    setMedals(null);
    api
      .get<MedalsDTO>("/medals", { params: season ? { season } : {} })
      .then((r) => setMedals(r.data));
  }, [season]);

  // Your own stats are the point of this page — a member *is* a player, so it
  // opens on yourself, falling back to the leader if you haven't played.
  const playerId = useMemo(() => {
    if (playerParam) return playerParam;
    if (!rows || rows.some((r) => r.id === user?.id)) return user?.id;
    return rows[0]?.id ?? user?.id;
  }, [playerParam, rows, user?.id]);

  const selected = rows?.find((r) => r.id === playerId) ?? null;
  // Someone with no games this period has no scoreboard row; name them from the roster.
  const name = selected?.name ?? players.find((p) => p.id === playerId)?.name;
  const isMe = playerId === user?.id;

  function update(key: "player" | "season", value: string, replace: boolean) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace });
  }

  if (rows === null) return <Spinner />;
  if (rows.length === 0 && !playerParam)
    return (
      <Card title="Statistics">
        <div className="empty">No games recorded yet.</div>
      </Card>
    );

  return (
    <div className="stack">
      {/* Title and subtitle by hand rather than through Card's props, so the
          player's medals can sit between them, right under the name. */}
      <Card>
        <h2 className="card-title row" style={{ gap: 8 }}>
          {isMe ? "Your statistics" : (name ?? "Statistics")}
          {isMe && <span className="badge">you</span>}
        </h2>
        <MedalStrip current={standingsOf(medals, playerId)} past={tallyOf(pastMedals, playerId)} />
        <p className="card-sub">
          {season === "all"
            ? "Every season combined."
            : `${seasons.find((s) => (season ? s.id === season : s.current))?.name ?? "Current season"}. Search a player to compare.`}
        </p>
        <div className="row">
          <div style={{ flex: "1 1 240px" }}>
            <PlayerSearch
              players={players}
              meId={user?.id}
              // Picking yourself drops the param: plain /stats already means you.
              onPick={(id) => update("player", id === user?.id ? "" : id, false)}
            />
          </div>
          <div style={{ width: 220 }}>
            <Select
              value={season}
              onChange={(e) => update("season", e.target.value, true)}
              options={[
                { value: "", label: "Current season" },
                ...seasons
                  .filter((s) => !s.current)
                  .map((s) => ({ value: s.id, label: s.name })),
                { value: "all", label: "All time" },
              ]}
            />
          </div>
          {!isMe && (
            <Button variant="ghost" className="btn-sm" onClick={() => update("player", "", false)}>
              ← My stats
            </Button>
          )}
        </div>

        <div style={{ height: 16 }} />
        {selected ? (
          <div className="tiles">
            <Tile
              k="Total"
              v={<span className={scoreClass(selected.total)}>{signed(selected.total)}</span>}
            />
            <Tile k="Games" v={selected.games} />
            <Tile k="Average" v={selected.mean.toFixed(1)} />
            <Tile k="Std dev" v={selected.std.toFixed(1)} />
            <Tile k="Best" v={<span className="score pos">{signed(selected.best)}</span>} />
            <Tile k="Worst" v={<span className="score neg">{signed(selected.worst)}</span>} />
            <Tile
              k="As taker"
              v={
                <>
                  {selected.takerCount}
                  <span className="muted" style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                    {" "}
                    / {selected.games}
                  </span>
                </>
              }
            />
          </div>
        ) : (
          <div className="empty">No games recorded for this period.</div>
        )}
      </Card>

      <Card title="Table overview">
        <div className="tiles">
          <Tile k="Players ranked" v={rows.length} />
          {/* Max games any one player has ≈ how many nights we've logged. */}
          <Tile k="Games recorded" v={rows.reduce((m, r) => Math.max(m, r.games), 0)} />
        </div>
      </Card>
    </div>
  );
}
