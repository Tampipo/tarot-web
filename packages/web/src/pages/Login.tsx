import { useState, type FormEvent } from "react";
import { useAuth } from "../contexts/auth";
import { Alert, Button, Field, Input } from "../components/ui";
import { errorMessage } from "../lib/api";

const apiBase = import.meta.env.VITE_API_URL || "/api";

export function Login() {
  const { config, login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signup(name, email, password);
      else await login(email, password);
    } catch (err) {
      setError(errorMessage(err, "Could not sign in"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card stack">
        <div className="center stack" style={{ gap: 8 }}>
          <div className="brand" style={{ justifyContent: "center", fontSize: "1.4rem" }}>
            <span className="brand-mark" style={{ width: 40, height: 40 }}>
              ♣
            </span>
            <span>Tarot</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Keep score across your tarot nights.
          </p>
        </div>

        <div className="card stack">
          {error && <Alert kind="danger">{error}</Alert>}

          {config?.local && (
            <form className="stack" onSubmit={onSubmit}>
              {mode === "signup" && (
                <Field label="Name">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    required
                  />
                </Field>
              )}
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                />
              </Field>
              <Button variant="primary" block type="submit" loading={busy}>
                {mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
          )}

          {config?.local && config?.oidc && <div className="divider">or</div>}

          {config?.oidc && (
            <a className="btn btn-block" href={`${apiBase}/auth/oidc/start`}>
              Continue with SSO
            </a>
          )}

          {!config?.local && !config?.oidc && (
            <p className="muted center">No login method is configured.</p>
          )}
        </div>

        {config?.local && config?.allowSignup && (
          <p className="center muted" style={{ fontSize: "0.9rem" }}>
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <a
              href="#"
              style={{ color: "var(--primary)", fontWeight: 600 }}
              onClick={(e) => {
                e.preventDefault();
                setError(null);
                setMode(mode === "login" ? "signup" : "login");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
