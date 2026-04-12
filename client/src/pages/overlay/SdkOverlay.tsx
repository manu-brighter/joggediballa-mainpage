/**
 * Schlag den Kassier — OBS Overlay Bar
 *
 * Designed to be used as a Browser Source in OBS Studio.
 * The page has a transparent background and renders a slim top bar
 * showing player names, scores, current game and winner state.
 *
 * NOT linked anywhere on the website. Not indexed by search engines.
 * URL: /overlay/sdk
 */
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function totalPoints(n: number): number {
  return (n * (n + 1)) / 2;
}

function maxRemaining(current: number, total: number): number {
  if (current > total) return 0;
  return totalPoints(total) - totalPoints(current - 1);
}

// ─── Score pill ──────────────────────────────────────────────────────────────

function ScorePill({
  score,
  isWinner,
  isLeading,
}: {
  score: number;
  isWinner: boolean;
  isLeading: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-black tabular-nums transition-all duration-500",
        "min-w-[3.2rem] px-3 py-0.5 text-2xl leading-none",
        isWinner
          ? "bg-yellow-400 text-black shadow-[0_0_24px_4px_rgba(250,204,21,0.7)] scale-110"
          : isLeading
          ? "bg-primary text-primary-foreground shadow-md"
          : "bg-white/10 text-white"
      )}
    >
      {score}
    </div>
  );
}

// ─── Player block ─────────────────────────────────────────────────────────────

function PlayerBlock({
  name,
  score,
  isWinner,
  isLeading,
  align,
}: {
  name: string;
  score: number;
  isWinner: boolean;
  isLeading: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        align === "right" && "flex-row-reverse"
      )}
    >
      <ScorePill score={score} isWinner={isWinner} isLeading={isLeading} />
      <span
        className={cn(
          "font-bold text-lg leading-none tracking-wide truncate max-w-[160px] transition-colors duration-500",
          isWinner ? "text-yellow-300" : "text-white"
        )}
      >
        {name}
      </span>
      {isWinner && (
        <Trophy className="h-5 w-5 text-yellow-400 shrink-0 animate-bounce" />
      )}
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export default function SdkOverlay() {
  // Inject noindex meta tag
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const { data: session } = trpc.sdk.getActive.useQuery(undefined, {
    refetchInterval: 1500,
    refetchIntervalInBackground: true,
  });

  if (!session) {
    // Render nothing — transparent in OBS when no session active
    return <div className="w-full h-screen bg-transparent" />;
  }

  const {
    player1Name,
    player2Name,
    player1Score,
    player2Score,
    currentGame,
    totalGames,
    currentGameName,
    winnerId,
  } = session;

  const isFinished = winnerId !== null;
  const p1Leads = player1Score > player2Score;
  const p2Leads = player2Score > player1Score;

  // Calculate if a winner is already mathematically decided
  const remaining = maxRemaining(currentGame, totalGames);
  const p1MathWinner = !isFinished && player1Score > player2Score + remaining;
  const p2MathWinner = !isFinished && player2Score > player1Score + remaining;

  const p1Winner = isFinished ? winnerId === 1 : p1MathWinner;
  const p2Winner = isFinished ? winnerId === 2 : p2MathWinner;

  const gameLabel = currentGameName && currentGameName.trim()
    ? currentGameName
    : `Spiel ${currentGame}`;

  const gameProgress = `${currentGame} / ${totalGames}`;

  return (
    <div
      className="w-full bg-transparent"
      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
    >
      {/* ── Main bar ── */}
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-4 px-5 py-2.5",
          "rounded-b-2xl",
          "backdrop-blur-md",
          isFinished || p1Winner || p2Winner
            ? "bg-gradient-to-r from-yellow-900/80 via-black/85 to-yellow-900/80 border-b-2 border-yellow-400/60"
            : "bg-gradient-to-r from-black/80 via-black/90 to-black/80 border-b border-white/10"
        )}
        style={{ minHeight: "62px" }}
      >
        {/* Player 1 */}
        <PlayerBlock
          name={player1Name}
          score={player1Score}
          isWinner={p1Winner}
          isLeading={p1Leads && !p1Winner && !p2Winner}
          align="left"
        />

        {/* Centre: game info */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          {/* Logo + game label */}
          <div className="flex items-center gap-2">
            <img
              src="/Jogge_Di_Balla_Final_Transparent.png"
              alt="Jogge di Balla"
              className="h-7 w-auto opacity-90"
            />
            <div className="flex flex-col items-center leading-none">
              <span className="text-[10px] font-semibold tracking-widest text-white/50 uppercase">
                Schlag den Kassier
              </span>
              <span className="text-sm font-bold text-white/90 mt-0.5">
                {isFinished || p1Winner || p2Winner
                  ? "🏆 Sieger steht fest!"
                  : gameLabel}
              </span>
            </div>
          </div>
          {/* Game counter dots */}
          <div className="flex items-center gap-1 mt-1">
            {Array.from({ length: totalGames }, (_, i) => {
              const gameNum = i + 1;
              const isDone = gameNum < currentGame;
              const isCurrent = gameNum === currentGame && !isFinished;
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    isDone
                      ? "w-2 h-2 bg-primary/80"
                      : isCurrent
                      ? "w-3 h-3 bg-primary shadow-[0_0_8px_2px_rgba(var(--primary),0.8)]"
                      : "w-2 h-2 bg-white/20"
                  )}
                />
              );
            })}
          </div>
          <span className="text-[10px] text-white/40 mt-0.5">{gameProgress}</span>
        </div>

        {/* Player 2 */}
        <PlayerBlock
          name={player2Name}
          score={player2Score}
          isWinner={p2Winner}
          isLeading={p2Leads && !p1Winner && !p2Winner}
          align="right"
        />
      </div>
    </div>
  );
}
