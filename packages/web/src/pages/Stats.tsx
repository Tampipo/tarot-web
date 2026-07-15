import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../contexts/auth";
import { Card, Select, Spinner, Tile } from "../components/ui";
import { scoreClass, signed } from "../lib/format";
import type { ScoreRow, Season } from "../lib/types";

export function Stats() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [season, setSeason] = useState<string>(""); // "" = season in progress

  useEffect(() => {
    api.get<Season[]>("/seasons").then((r) => setSeasons(r.data));
  }, []);

  useEffect(() => {
    setRows(null);
    api
      .get<ScoreRow[]>("/scoreboard", { params: season ? { season } : {} })
      .then((r) => {
        setRows(r.data);
        if (r.data.length === 0) return;
        // Your own stats are the point of this page — a member *is* a player,
        // so open on yourself, falling back to the leader if you haven't played.
        const mine = r.data.find((row) => row.id === user?.id);
        setPlayerId((prev) =>
          r.data.some((row) => row.id === prev) ? prev : (mine ?? r.data[0]).id,
        );
      });
  }, [user?.id, season]);

  const selected = useMemo(
    () => rows?.find((r) => r.id === playerId) ?? null,
    [rows, playerId],
  );
  const isMe = selected?.id === user?.id;

  if (rows === null) return <Spinner />;
  if (rows.length === 0)
    return (
      <Card title="Statistics">
        <div className="empty">No games recorded yet.</div>
      </Card>
    );

  return (
    <div className="stack">
      <Card
        title={
          <span className="row" style={{ gap: 8 }}>
            {isMe ? "Your statistics" : `${selected?.name ?? "Statistics"}`}
            {isMe && <span className="badge">you</span>}
          </span>
        }
        subtitle={
          season === "all"
            ? "Every season combined."
            : `${seasons.find((s) => (season ? s.id === season : s.current))?.name ?? "Current season"}. Switch player to compare.`
        }
      >
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <div style={{ width: 220 }}>
            <Select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              options={[
                { value: "", label: "Current season" },
                ...seasons
                  .filter((s) => !s.current)
                  .map((s) => ({ value: s.id, label: s.name })),
                { value: "all", label: "All time" },
              ]}
            />
          </div>
          <div style={{ width: 240 }}>
            <Select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              options={rows.map((r) => ({
                value: r.id,
                label: r.id === user?.id ? `${r.name} (you)` : r.name,
              }))}
            />
          </div>
        </div>

        {selected && (
          <>
            <div style={{ height: 16 }} />
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
          </>
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
