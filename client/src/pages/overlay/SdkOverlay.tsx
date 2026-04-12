/**
 * Schlag den Kassier — OBS Overlay Bar
 *
 * Designed to be used as a Browser Source in OBS Studio.
 * Transparent background, slim top bar, live polling.
 *
 * NOT linked anywhere on the website. Not indexed by search engines.
 * URL: /overlay/sdk
 */
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function totalPoints(n: number): number {
  return (n * (n + 1)) / 2;
}

function maxRemaining(current: number, total: number): number {
  if (current > total) return 0;
  return totalPoints(total) - totalPoints(current - 1);
}

// ─── Abstract SVG decorations ────────────────────────────────────────────────

function AbstractLeft() {
  return (
    <svg
      className="absolute left-0 top-0 h-full w-32 pointer-events-none"
      viewBox="0 0 128 80"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Diagonal slash lines */}
      <line x1="-10" y1="90" x2="60" y2="-10" stroke="rgba(255,255,255,0.06)" strokeWidth="18" />
      <line x1="10" y1="90" x2="80" y2="-10" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
      <line x1="30" y1="90" x2="100" y2="-10" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
      {/* Corner arc */}
      <circle cx="0" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
      <circle cx="0" cy="80" r="40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" />
      {/* Small dots */}
      <circle cx="20" cy="15" r="3" fill="rgba(255,255,255,0.12)" />
      <circle cx="40" cy="35" r="2" fill="rgba(255,255,255,0.08)" />
      <circle cx="10" cy="50" r="4" fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function AbstractRight() {
  return (
    <svg
      className="absolute right-0 top-0 h-full w-32 pointer-events-none"
      viewBox="0 0 128 80"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Mirror of left */}
      <line x1="138" y1="90" x2="68" y2="-10" stroke="rgba(255,255,255,0.06)" strokeWidth="18" />
      <line x1="118" y1="90" x2="48" y2="-10" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
      <line x1="98" y1="90" x2="28" y2="-10" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
      <circle cx="128" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
      <circle cx="128" cy="80" r="40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" />
      <circle cx="108" cy="15" r="3" fill="rgba(255,255,255,0.12)" />
      <circle cx="88" cy="35" r="2" fill="rgba(255,255,255,0.08)" />
      <circle cx="118" cy="50" r="4" fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

// ─── Game progress dots ───────────────────────────────────────────────────────

function GameDots({ current, total, isFinished }: { current: number; total: number; isFinished: boolean }) {
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: total }, (_, i) => {
        const gameNum = i + 1;
        const isDone = gameNum < current || isFinished;
        const isCurrent = gameNum === current && !isFinished;
        return (
          <div
            key={i}
            style={{
              width: isCurrent ? 10 : 6,
              height: isCurrent ? 10 : 6,
              borderRadius: "50%",
              background: isDone
                ? "rgba(255,255,255,0.7)"
                : isCurrent
                ? "#fff"
                : "rgba(255,255,255,0.2)",
              boxShadow: isCurrent ? "0 0 6px 2px rgba(255,255,255,0.5)" : "none",
              transition: "all 0.3s",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Player side ──────────────────────────────────────────────────────────────

function PlayerSide({
  name,
  score,
  side,
  isWinner,
  isLeading,
  color, // "red" | "blue"
}: {
  name: string;
  score: number;
  side: "left" | "right";
  isWinner: boolean;
  isLeading: boolean;
  color: "red" | "blue";
}) {
  const accentColor = color === "red" ? "#ef4444" : "#3b82f6";
  const glowColor = color === "red" ? "rgba(239,68,68,0.6)" : "rgba(59,130,246,0.6)";
  const winnerGlow = isWinner ? `0 0 32px 8px ${glowColor}, 0 0 8px 2px rgba(255,215,0,0.5)` : "none";

  return (
    <div
      className={cn(
        "flex items-center gap-4 flex-1",
        side === "right" && "flex-row-reverse"
      )}
    >
      {/* Score bubble */}
      <div
        style={{
          minWidth: 64,
          height: 64,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          fontWeight: 900,
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          letterSpacing: "-1px",
          color: isWinner ? "#fbbf24" : "#fff",
          background: isWinner
            ? "linear-gradient(135deg, #92400e, #78350f)"
            : isLeading
            ? `linear-gradient(135deg, ${accentColor}cc, ${accentColor}88)`
            : "rgba(255,255,255,0.1)",
          border: isWinner
            ? "2px solid #fbbf24"
            : isLeading
            ? `2px solid ${accentColor}`
            : "2px solid rgba(255,255,255,0.15)",
          boxShadow: isWinner
            ? `0 0 24px 6px rgba(251,191,36,0.5), ${winnerGlow}`
            : isLeading
            ? `0 0 16px 4px ${glowColor}`
            : "none",
          transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          transform: isWinner ? "scale(1.15)" : isLeading ? "scale(1.05)" : "scale(1)",
          flexShrink: 0,
        }}
      >
        {score}
      </div>

      {/* Name */}
      <div className={cn("flex flex-col", side === "right" && "items-end")}>
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: isWinner ? "#fbbf24" : "#fff",
            textShadow: isWinner
              ? "0 0 12px rgba(251,191,36,0.8)"
              : `0 2px 8px rgba(0,0,0,0.5)`,
            letterSpacing: "0.5px",
            lineHeight: 1,
            maxWidth: 200,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            transition: "color 0.5s",
          }}
        >
          {name}
        </span>
        {isWinner && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#fbbf24",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginTop: 2,
              textShadow: "0 0 8px rgba(251,191,36,0.6)",
            }}
          >
            🏆 Sieger
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export default function SdkOverlay() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    // Make body transparent for OBS
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const { data: session } = trpc.sdk.getActive.useQuery(undefined, {
    refetchInterval: 1500,
    refetchIntervalInBackground: true,
  });

  if (!session) {
    return <div style={{ width: "100%", height: 80, background: "transparent" }} />;
  }

  const {
    showTitle,
    player1Name,
    player2Name,
    player1Score,
    player2Score,
    currentGame,
    totalGames,
    currentGameName,
    winnerId,
  } = session;

  const isFinished = winnerId !== null && winnerId !== undefined;
  const p1Leads = player1Score > player2Score;
  const p2Leads = player2Score > player1Score;

  const remaining = maxRemaining(currentGame, totalGames);
  const p1MathWinner = !isFinished && player1Score > player2Score + remaining;
  const p2MathWinner = !isFinished && player2Score > player1Score + remaining;

  const p1Winner = isFinished ? winnerId === 1 : p1MathWinner;
  const p2Winner = isFinished ? winnerId === 2 : p2MathWinner;
  const hasWinner = p1Winner || p2Winner;

  const gameLabel = currentGameName?.trim() ? currentGameName : `Spiel ${currentGame}`;

  return (
    <div
      style={{
        width: "100%",
        background: "transparent",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          height: 80,
          display: "flex",
          alignItems: "center",
          // Main gradient: red left → dark center → blue right
          background: hasWinner
            ? "linear-gradient(90deg, #7f1d1d 0%, #1c1c2e 40%, #1c1c2e 60%, #1e3a5f 100%)"
            : "linear-gradient(90deg, #7f1d1d 0%, #1a0a0a 35%, #0f0f1a 50%, #0a0a1a 65%, #1e3a5f 100%)",
          borderBottom: hasWinner
            ? "2px solid rgba(251,191,36,0.6)"
            : "1px solid rgba(255,255,255,0.08)",
          boxShadow: hasWinner
            ? "0 4px 32px rgba(251,191,36,0.2)"
            : "0 4px 24px rgba(0,0,0,0.6)",
        }}
      >
        {/* ── Blurred background logo ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <img
            src="/Jogge_Di_Balla_Final_Transparent.png"
            alt=""
            style={{
              height: 160,
              width: "auto",
              opacity: 0.07,
              filter: "blur(6px) brightness(2)",
              transform: "scale(1.2)",
              userSelect: "none",
            }}
          />
        </div>

        {/* ── Red side glow ── */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "38%",
            height: "100%",
            background: "linear-gradient(90deg, rgba(185,28,28,0.55) 0%, transparent 100%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* ── Blue side glow ── */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: "38%",
            height: "100%",
            background: "linear-gradient(270deg, rgba(29,78,216,0.55) 0%, transparent 100%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* ── Abstract decorations ── */}
        <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
          <AbstractLeft />
          <AbstractRight />
        </div>

        {/* ── Winner shimmer overlay ── */}
        {hasWinner && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.06) 50%, transparent 100%)",
              animation: "shimmer 2s infinite",
              zIndex: 3,
              pointerEvents: "none",
            }}
          />
        )}

        {/* ── Content ── */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            width: "100%",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 16,
          }}
        >
          {/* Player 1 (red side) */}
          <PlayerSide
            name={player1Name}
            score={player1Score}
            side="left"
            isWinner={p1Winner}
            isLeading={p1Leads && !p1Winner && !p2Winner}
            color="red"
          />

          {/* Centre */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              minWidth: 200,
            }}
          >
            {/* Show title */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: hasWinner ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.45)",
                lineHeight: 1,
              }}
            >
              {showTitle ?? "Schlag den Kassier"}
            </span>

            {/* Game label */}
            <span
              style={{
                fontSize: hasWinner ? 14 : 15,
                fontWeight: 800,
                color: hasWinner ? "#fbbf24" : "rgba(255,255,255,0.95)",
                letterSpacing: "0.5px",
                lineHeight: 1,
                textShadow: hasWinner
                  ? "0 0 12px rgba(251,191,36,0.7)"
                  : "0 2px 8px rgba(0,0,0,0.6)",
              }}
            >
              {hasWinner ? "🏆 Sieger steht fest!" : gameLabel}
            </span>

            {/* Game dots */}
            {!hasWinner && (
              <GameDots current={currentGame} total={totalGames} isFinished={isFinished} />
            )}

            {/* Game counter text */}
            <span
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "1px",
                lineHeight: 1,
              }}
            >
              {currentGame} / {totalGames}
            </span>
          </div>

          {/* Player 2 (blue side) */}
          <PlayerSide
            name={player2Name}
            score={player2Score}
            side="right"
            isWinner={p2Winner}
            isLeading={p2Leads && !p1Winner && !p2Winner}
            color="blue"
          />
        </div>
      </div>

      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: transparent !important; }
      `}</style>
    </div>
  );
}
