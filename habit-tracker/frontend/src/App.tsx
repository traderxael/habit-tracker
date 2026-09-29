import { type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import TodayPage from "./pages/Today";
import HabitsPage from "./pages/Habits";
import FinancePage from "./pages/Finance";
import DebtsPage from "./pages/Debts";
import GoalsPage from "./pages/Goals";
import CalendarPage from "./pages/Calendar";
import LoginPage from "./pages/Login";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Cargando…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <span className="logo" aria-hidden="true">
            ✓
          </span>
          Gestor de hábitos
        </h1>
        <nav className="app-nav">
          <NavLink to="/" end>
            Hoy
          </NavLink>
          <NavLink to="/habits">Hábitos</NavLink>
          <NavLink to="/finance">Finanzas</NavLink>
          <NavLink to="/debts">Deudas</NavLink>
          <NavLink to="/goals">Metas</NavLink>
          <NavLink to="/calendar">Calendario</NavLink>
          {user ? (
            <span className="nav-user">
              <span className="nav-email">{user.email}</span>
              <button type="button" className="btn-link" onClick={logout}>
                Salir
              </button>
            </span>
          ) : (
            <NavLink to="/login">Iniciar sesión</NavLink>
          )}
        </nav>
      </header>
      <main className="app-main">
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <Protected>
                  <TodayPage />
                </Protected>
              }
            />
            <Route
              path="/habits"
              element={
                <Protected>
                  <HabitsPage />
                </Protected>
              }
            />
            <Route
              path="/finance"
              element={
                <Protected>
                  <FinancePage />
                </Protected>
              }
            />
            <Route
              path="/debts"
              element={
                <Protected>
                  <DebtsPage />
                </Protected>
              }
            />
            <Route
              path="/goals"
              element={
                <Protected>
                  <GoalsPage />
                </Protected>
              }
            />
            <Route
              path="/calendar"
              element={
                <Protected>
                  <CalendarPage />
                </Protected>
              }
            />
            <Route path="*" element={<p>Página no encontrada.</p>} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}
