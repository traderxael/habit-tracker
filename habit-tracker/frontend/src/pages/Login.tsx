import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import heroUrl from "../assets/auth-hero.webp";

export default function LoginPage() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-split">
      <aside className="auth-hero" aria-hidden="true">
        <img src={heroUrl} alt="" />
        <div className="auth-hero-copy">
          <span className="auth-hero-logo">✓</span>
          <h2>Construye hábitos que permanecen.</h2>
          <p>
            Marca tu progreso cada día, cuida tus rachas y visualiza tu
            constancia en el calendario.
          </p>
        </div>
      </aside>

      <section className="auth">
        <h2>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
        <form onSubmit={onSubmit} className="form card">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@email.com"
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "…" : mode === "login" ? "Entrar" : "Registrarme"}
          </button>
        </form>
        <p className="muted auth-switch">
          {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Regístrate" : "Inicia sesión"}
          </button>
        </p>
      </section>
    </div>
  );
}
