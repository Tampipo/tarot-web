import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card, Select, Spinner } from "../components/ui";
import { monthLabel, scoreClass, signed } from "../lib/format";
import type { ScoreRow } from "../lib/types";

const rankClass = ["gold", "silver", "bronze"];

export function Scoreboard() {
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string>(""); // "" = all time
  const [rows, setRows] = useState<ScoreRow[] | null>(null);

  useEffect(() => {
    api.get<string[]>("/scoreboard/months").then((r) => setMonths(r.data));
  }, []);

  useEffect(() => {
    setRows(null);
    api
      .get<ScoreRow[]>("/scoreboard", { params: month ? { month } : {} })
      .then((r) => setRows(r.data));
  }, [month]);

  return (
    <div className="stack">
      <Card
        title="Scoreboard"
        subtitle={month ? monthLabel(month) : "All-time standings"}
      >
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <div style={{ width: 220 }}>
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              options={[
                { value: "", label: "All time" },
                ...months.map((m) => ({ value: m, label: monthLabel(m) })),
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
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
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
        )}
      </Card>
    </div>
  );
}
