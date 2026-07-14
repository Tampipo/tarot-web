import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Card, Select, Spinner, Tile } from "../components/ui";
import { scoreClass, signed } from "../lib/format";
import type { ScoreRow } from "../lib/types";

export function Stats() {
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [playerId, setPlayerId] = useState<string>("");

  useEffect(() => {
    api.get<ScoreRow[]>("/scoreboard").then((r) => {
      setRows(r.data);
      if (r.data.length > 0) setPlayerId(r.data[0].id);
    });
  }, []);

  const selected = useMemo(
    () => rows?.find((r) => r.id === playerId) ?? null,
    [rows, playerId],
  );

  if (rows === null) return <Spinner />;
  if (rows.length === 0)
    return (
      <Card title="Statistics">
        <div className="empty">No games recorded yet.</div>
      </Card>
    );

  return (
    <div className="stack">
      <Card title="Statistics" subtitle="All-time, per player.">
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <div style={{ width: 240 }}>
            <Select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              options={rows.map((r) => ({ value: r.id, label: r.name }))}
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
