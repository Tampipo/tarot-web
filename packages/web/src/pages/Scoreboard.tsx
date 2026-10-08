import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/auth";
import { Card, Select, Spinner } from "../components/ui";
import { scoreClass, seasonRange, signed } from "../lib/format";
import type { ScoreRow, Season } from "../lib/types";

const rankClass = ["gold", "silver", "bronze"];
const MEDALS = ["🥇", "🥈", "🥉"];

/** A player's stats, opened on the season being viewed ("" = in progress). */
function statsUrl(id: string, season: string): string {
  const params = new URLSearchParams({ player: id });
  if (season) params.set("season", season);
  return `/stats?${params}`;
}

/**
 * Top three, arranged 2nd–1st–3rd with the winner on the tallest riser. Renders
 * whatever it's given, so a two-player table still looks deliberate.
 */
function Podium({ rows, meId, season }: { rows: ScoreRow[]; meId?: string; season: string }) {
  const top = rows.slice(0, 3).map((row, i) => ({ row, place: i + 1 }));
  // Display order puts 1st in the middle: [2nd, 1st, 3rd].
  const order = [top[1], top[0], top[2]].filter(Boolean);

  return (
    <div className="podium">
      {order.map(({ row, place }) => (
        <div className="podium-col" key={row.id}>
          <span className="podium-medal">{MEDALS[place - 1]}</span>
          <Link
            to={statsUrl(row.id, season)}
            className={`podium-name player-link ${row.id === meId ? "podium-you" : ""}`.trim()}
          >
            {row.name}
          </Link>
          <span className={`podium-total ${scoreClass(row.total)}`}>{signed(row.total)}</span>
          <div className={`podium-plinth p${place}`}>{place}</div>
        </div>
      ))}
    </div>
  );
}

export function Scoreboard() {
  const { user } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  // "" = the season in progress (the default view); "all" = across all seasons.
  const [season, setSeason] = useState<string>("");
  const [rows, setRows] = useState<ScoreRow[] | null>(null);

  useEffect(() => {
    api.get<Season[]>("/seasons").then((r) => setSeasons(r.data));
  }, []);

  useEffect(() => {
    setRows(null);
    api
      .get<ScoreRow[]>("/scoreboard", { params: season ? { season } : {} })
      .then((r) => setRows(r.data));
  }, [season]);

  const current = seasons.find((s) => s.current);
  const shown = season === "" ? current : seasons.find((s) => s.id === season);
  const subtitle =
    season === "all"
      ? "Every season combined"
      : shown
        ? `${shown.name} · ${seasonRange(shown.startedAt, shown.endedAt)}${shown.current ? " · in progress" : ""}`
        : "Standings";

  return (
    <div className="stack">
      <Card title="Scoreboard" subtitle={subtitle}>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <div style={{ width: 260 }}>
            <Select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              options={[
                { value: "", label: `Current season${current ? ` (${current.name})` : ""}` },
                ...seasons
                  .filter((s) => !s.current)
                  .map((s) => ({ value: s.id, label: `${s.name} (${s.games} games)` })),
                { value: "all", label: "All time" },
              ]}
            />
          </div>
        </div>

        <div style={{ height: 16 }} />

        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="empty">No games recorded for this period.</div>
        ) : (
          <>
            <Podium rows={rows} meId={user?.id} season={season} />
            <div style={{ height: 22 }} />
            <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th className="num">Total</th>
                  <th className="num">Games</th>
                  <th className="num">Avg</th>
                  <th className="num">Best</th>
                  <th className="num">Worst</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <span className={`rank ${rankClass[i] ?? ""}`.trim()}>{i + 1}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <Link to={statsUrl(r.id, season)} className="player-link">
                        {r.name}
                      </Link>
                      {r.id === user?.id && <span className="muted"> (you)</span>}
                    </td>
                    <td className="num">
                      <span className={scoreClass(r.total)}>{signed(r.total)}</span>
                    </td>
                    <td className="num muted">{r.games}</td>
                    <td className="num">{r.mean.toFixed(1)}</td>
                    <td className="num">
                      <span className="score pos">{signed(r.best)}</span>
                    </td>
                    <td className="num">
                      <span className="score neg">{signed(r.worst)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
