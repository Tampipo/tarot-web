import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CONTRACT_LABEL, type Contract } from "@tarot/shared";
import { api } from "../lib/api";
import { useAuth } from "../contexts/auth";
import { Button, Card, Spinner } from "../components/ui";
import { dateLabel, scoreClass, signed } from "../lib/format";
import type { GameDTO } from "../lib/types";

export function Home() {
  const { user } = useAuth();
  const [games, setGames] = useState<GameDTO[] | null>(null);

  useEffect(() => {
    api.get<GameDTO[]>("/games", { params: { limit: 8 } }).then((r) => setGames(r.data));
  }, []);

  return (
    <div className="stack">
      <Card
        title={`Welcome back, ${user?.name.split(" ")[0] ?? "player"} 👋`}
        subtitle="Score a new deal, or catch up on where everyone stands."
      >
        <div className="row">
          <Link to="/new">
            <Button variant="primary">New game</Button>
          </Link>
          <Link to="/scoreboard">
            <Button>Scoreboard</Button>
          </Link>
        </div>
      </Card>

      <Card title="Recent games" subtitle="The last deals you recorded.">
        {games === null ? (
          <Spinner />
        ) : games.length === 0 ? (
          <div className="empty">
            No games yet. <Link to="/new" style={{ color: "var(--primary)" }}>Record your first one.</Link>
          </div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {games.map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function GameRow({ game }: { game: GameDTO }) {
  const takerScore = game.players.find((p) => p.id === game.taker.id)?.score ?? 0;
  return (
    <div
      className="row"
      style={{
        justifyContent: "space-between",
        padding: "12px 14px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface-2)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>
          {game.taker.name}
          {game.partner ? ` & ${game.partner.name}` : ""}
          <span className="muted" style={{ fontWeight: 400 }}>
            {" "}
            · {CONTRACT_LABEL[game.contract as Contract] ?? game.contract}
          </span>
        </div>
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          {dateLabel(game.playedAt)} · {game.numPlayers} players · {game.oudlers} oudler
          {game.oudlers === 1 ? "" : "s"} · {game.pointsMade} pts
        </div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <span className={`badge ${game.won ? "" : ""}`}>{game.won ? "Won" : "Lost"}</span>
        <span className={scoreClass(takerScore)} style={{ minWidth: 48, textAlign: "right" }}>
          {signed(takerScore)}
        </span>
      </div>
    </div>
  );
}
