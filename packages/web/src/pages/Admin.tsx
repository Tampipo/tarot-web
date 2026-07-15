import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../contexts/auth";
import { Alert, Button, Card, Input, Spinner } from "../components/ui";
import { dateLabel } from "../lib/format";
import type { Player } from "../lib/types";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

export function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data } = await api.get<AdminUser[]>("/admin/users");
    setUsers(data);
  }
  useEffect(() => {
    load();
  }, []);

  async function act(id: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(errorMessage(err, "Action failed"));
    } finally {
      setBusyId(null);
    }
  }

  const approve = (u: AdminUser) => act(u.id, () => api.post(`/admin/users/${u.id}/approve`));
  const setRole = (u: AdminUser, role: string) =>
    act(u.id, () => api.post(`/admin/users/${u.id}/role`, { role }));
  const remove = (u: AdminUser) =>
    act(u.id, () => api.delete(`/admin/users/${u.id}`));

  const pending = users?.filter((u) => u.status !== "active") ?? [];
  const active = users?.filter((u) => u.status === "active") ?? [];

  return (
    <div className="stack">
      <Card title="Pending approvals" subtitle="New sign-ups can't log in until approved.">
        {error && <Alert kind="danger">{error}</Alert>}
        {users === null ? (
          <Spinner />
        ) : pending.length === 0 ? (
          <div className="empty">No one is waiting for approval.</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Requested</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td className="muted">{u.email}</td>
                    <td className="muted">{dateLabel(u.createdAt)}</td>
                    <td className="num">
                      <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <Button
                          variant="primary"
                          className="btn-sm"
                          loading={busyId === u.id}
                          onClick={() => approve(u)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          className="btn-sm"
                          disabled={busyId === u.id}
                          onClick={() => remove(u)}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Members" subtitle="Promote a trusted member to admin, or remove accounts.">
        {users === null ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {active.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>
                      {u.name}
                      {u.id === user?.id && <span className="muted"> (you)</span>}
                    </td>
                    <td className="muted">{u.email}</td>
                    <td>
                      <span className="badge">{u.role}</span>
                    </td>
                    <td className="num">
                      <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        {u.role === "admin" ? (
                          <Button
                            className="btn-sm"
                            disabled={busyId === u.id}
                            onClick={() => setRole(u, "member")}
                          >
                            Demote
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            className="btn-sm"
                            loading={busyId === u.id}
                            onClick={() => setRole(u, "admin")}
                          >
                            Make admin
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          className="btn-sm"
                          disabled={busyId === u.id}
                          onClick={() => remove(u)}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PlayersRoster />
    </div>
  );
}

/**
 * The tarot roster — the people who sit at the table, distinct from the
 * accounts above. Managed here so scoring a game never doubles as data entry.
 */
function PlayersRoster() {
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
      setError(errorMessage(err, "Could not add that player"));
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
      // A player with recorded games is kept — deleting them would tear holes
      // in every past leaderboard.
      setError(errorMessage(err, `${p.name} has recorded games and can't be removed.`));
    }
  }

  return (
    <Card title="Players" subtitle="The roster picked from in New game. Guests never appear here.">
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

      <div style={{ height: 16 }} />

      {players === null ? (
        <Spinner />
      ) : players.length === 0 ? (
        <div className="empty">No players yet — add the regulars above.</div>
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
  );
}
