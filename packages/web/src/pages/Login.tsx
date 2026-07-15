import { useState, type FormEvent } from "react";
import { useAuth } from "../contexts/auth";
import { Alert, Button, Field, Input } from "../components/ui";
import { errorCode, errorMessage } from "../lib/api";

const FRIENDLY: Record<string, string> = {
  INVALID_CREDENTIALS: "Wrong email or password.",
  PENDING_APPROVAL: "Your account is awaiting admin approval.",
  EMAIL_TAKEN: "That email is already registered.",
};

export function Login() {
  const { config, login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await signup(name, email, password);
        setMode("login");
        setPassword("");
        setNotice("Account created. An admin needs to approve it before you can sign in.");
      } else {
        await login(email, password);
      }
    } catch (err) {
      const code = errorCode(err);
      setError((code && FRIENDLY[code]) || errorMessage(err, "Could not sign in"));
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
          {notice && <Alert kind="success">{notice}</Alert>}

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
              {mode === "signup" ? "Request an account" : "Sign in"}
            </Button>
          </form>
        </div>

        {config?.allowSignup && (
          <p className="center muted" style={{ fontSize: "0.9rem" }}>
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <a
              href="#"
              style={{ color: "var(--primary)", fontWeight: 600 }}
              onClick={(e) => {
                e.preventDefault();
                setError(null);
                setNotice(null);
                setMode(mode === "login" ? "signup" : "login");
              }}
            >
              {mode === "login" ? "Request an account" : "Sign in"}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
