import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage } from "../lib/api";
import { Alert, Button, Card, Input, Spinner } from "../components/ui";
import { dateLabel } from "../lib/format";
import type { Player } from "../lib/types";

export function Players() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await api.get<Player[]>("/players");
    setPlayers(data);
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/players", { name: name.trim() });
      setName("");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not add player"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Player) {
    setError(null);
    try {
      await api.delete(`/players/${p.id}`);
      await load();
    } catch (err) {
      setError(errorMessage(err, "This player has recorded games and can't be removed."));
    }
  }

  return (
    <div className="stack">
      <Card title="Players" subtitle="Everyone who sits at the table.">
        <form className="row" onSubmit={add} style={{ flexWrap: "nowrap" }}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a player…"
            maxLength={40}
          />
          <Button variant="primary" type="submit" loading={busy}>
            Add
          </Button>
        </form>
        {error && (
          <div style={{ marginTop: 14 }}>
            <Alert kind="danger">{error}</Alert>
          </div>
        )}
      </Card>

      <Card title={`${players?.length ?? ""} registered`.trim()}>
        {players === null ? (
          <Spinner />
        ) : players.length === 0 ? (
          <div className="empty">No players yet — add one above.</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="muted">{dateLabel(p.createdAt)}</td>
                    <td className="num">
                      <Button variant="danger" className="btn-sm" onClick={() => remove(p)}>
                        Remove
                      </Button>
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
