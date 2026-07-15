import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../contexts/auth";
import { Alert, Button, Card, Spinner } from "../components/ui";
import { dateLabel } from "../lib/format";

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
    </div>
  );
}
