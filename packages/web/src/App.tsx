import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/auth";
import { Shell } from "./components/Shell";
import { Spinner } from "./components/ui";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { NewGame } from "./pages/NewGame";
import { Scoreboard } from "./pages/Scoreboard";
import { Stats } from "./pages/Stats";
import { Players } from "./pages/Players";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Shell /> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <Spinner /> : user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route element={<Protected />}>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewGame />} />
        <Route path="/scoreboard" element={<Scoreboard />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/players" element={<Players />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
