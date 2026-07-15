import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../contexts/auth";
import { Alert, Button, Card, Select, Spinner } from "../components/ui";
import { dateLabel, seasonRange } from "../lib/format";
import type { Season } from "../lib/types";

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

      <Card
        title="Members"
        subtitle="Approved members are the players you can seat in a game. Promote a trusted one to admin."
      >
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

      <Seasons />
    </div>
  );
}

const PERIODS = [
  { value: "manual", label: "Manual only" },
  { value: "1", label: "Every month" },
  { value: "3", label: "Every 3 months" },
  { value: "6", label: "Every 6 months" },
  { value: "12", label: "Every year" },
];

/**
 * Seasons = the scoreboard's reset cycle. Closed seasons keep their games, so
 * resetting never destroys history — it just starts a fresh leaderboard.
 */
function Seasons() {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [period, setPeriod] = useState<string>("manual");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function load() {
    const [s, cfg] = await Promise.all([
      api.get<Season[]>("/seasons"),
      api.get<{ seasonPeriodMonths: number | null }>("/settings"),
    ]);
    setSeasons(s.data);
    setPeriod(cfg.data.seasonPeriodMonths ? String(cfg.data.seasonPeriodMonths) : "manual");
  }
  useEffect(() => {
    load();
  }, []);

  async function savePeriod(v: string) {
    setPeriod(v);
    setError(null);
    try {
      await api.put("/admin/settings", {
        seasonPeriodMonths: v === "manual" ? null : Number(v),
      });
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not save the reset cadence"));
    }
  }

  async function startNew() {
    setError(null);
    setBusy(true);
    try {
      await api.post("/admin/seasons", {});
      setConfirming(false);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not start a new season"));
    } finally {
      setBusy(false);
    }
  }

  const current = seasons?.find((s) => s.current);
  const past = seasons?.filter((s) => !s.current) ?? [];

  return (
    <Card
      title="Seasons"
      subtitle="The scoreboard resets each season. Past seasons keep their games and stay browsable."
    >
      {error && <Alert kind="danger">{error}</Alert>}

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}
      >
        <label className="field">
          <span className="label">Reset automatically</span>
          <Select value={period} options={PERIODS} onChange={(e) => savePeriod(e.target.value)} />
        </label>
        <div className="field">
          <span className="label">In progress</span>
          <div style={{ paddingTop: 8 }}>
            {current ? (
              <>
                <strong>{current.name}</strong>{" "}
                <span className="muted">
                  · {seasonRange(current.startedAt, current.endedAt)} · {current.games} games
                </span>
              </>
            ) : (
              <span className="muted">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="hr" style={{ margin: "18px 0" }} />

      {confirming ? (
        <div className="row" style={{ gap: 10 }}>
          <span>
            Close <strong>{current?.name}</strong> and start a fresh scoreboard? Its{" "}
            {current?.games ?? 0} games stay browsable.
          </span>
          <Button variant="primary" loading={busy} onClick={startNew}>
            Yes, start new season
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button onClick={() => setConfirming(true)}>Start a new season now</Button>
      )}

      <div style={{ height: 18 }} />

      {seasons === null ? (
        <Spinner />
      ) : past.length === 0 ? (
        <div className="empty">No past seasons yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Season</th>
                <th>Ran</th>
                <th className="num">Games</th>
              </tr>
            </thead>
            <tbody>
              {past.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td className="muted">{seasonRange(s.startedAt, s.endedAt)}</td>
                  <td className="num">{s.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
