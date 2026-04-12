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

// Brand colours
const RED = "#E93F56";
const BLUE = "#0B93A7";

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
      style={{ position: "absolute", left: 0, top: 0, height: "100%", width: 140, pointerEvents: "none" }}
      viewBox="0 0 140 80"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line x1="-10" y1="95" x2="70" y2="-15" stroke="rgba(255,255,255,0.07)" strokeWidth="22" />
      <line x1="15" y1="95" x2="95" y2="-15" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
      <line x1="40" y1="95" x2="120" y2="-15" stroke="rgba(255,255,255,0.03)" strokeWidth="7" />
      <circle cx="0" cy="80" r="65" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
      <circle cx="0" cy="80" r="42" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <circle cx="22" cy="14" r="3.5" fill="rgba(255,255,255,0.14)" />
      <circle cx="44" cy="38" r="2" fill="rgba(255,255,255,0.09)" />
      <circle cx="12" cy="54" r="4.5" fill="rgba(255,255,255,0.07)" />
    </svg>
  );
}

function AbstractRight() {
  return (
    <svg
      style={{ position: "absolute", right: 0, top: 0, height: "100%", width: 140, pointerEvents: "none" }}
      viewBox="0 0 140 80"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line x1="150" y1="95" x2="70" y2="-15" stroke="rgba(255,255,255,0.07)" strokeWidth="22" />
      <line x1="125" y1="95" x2="45" y2="-15" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
      <line x1="100" y1="95" x2="20" y2="-15" stroke="rgba(255,255,255,0.03)" strokeWidth="7" />
      <circle cx="140" cy="80" r="65" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
      <circle cx="140" cy="80" r="42" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <circle cx="118" cy="14" r="3.5" fill="rgba(255,255,255,0.14)" />
      <circle cx="96" cy="38" r="2" fill="rgba(255,255,255,0.09)" />
      <circle cx="128" cy="54" r="4.5" fill="rgba(255,255,255,0.07)" />
    </svg>
  );
}

// ─── Game progress dots ───────────────────────────────────────────────────────

function GameDots({ current, total, isFinished }: { current: number; total: number; isFinished: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {Array.from({ length: total }, (_, i) => {
        const gameNum = i + 1;
        const isDone = gameNum < current || isFinished;
        const isCurrent = gameNum === current && !isFinished;
        return (
          <div
            key={i}
            style={{
              width: isCurrent ? 11 : 6,
              height: isCurrent ? 11 : 6,
              borderRadius: "50%",
              background: isDone
                ? "rgba(255,255,255,0.75)"
                : isCurrent
                ? "#fff"
                : "rgba(255,255,255,0.18)",
              boxShadow: isCurrent ? "0 0 7px 3px rgba(255,255,255,0.55)" : "none",
              transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
              flexShrink: 0,
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
  color,
}: {
  name: string;
  score: number;
  side: "left" | "right";
  isWinner: boolean;
  isLeading: boolean;
  color: "red" | "blue";
}) {
  const accent = color === "red" ? RED : BLUE;
  const glowRgb = color === "red" ? "233,63,86" : "11,147,167";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        flex: 1,
        flexDirection: side === "right" ? "row-reverse" : "row",
      }}
    >
      {/* Score bubble */}
      <div
        style={{
          minWidth: 62,
          height: 62,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 27,
          fontWeight: 900,
          letterSpacing: "-1px",
          color: isWinner ? "#fbbf24" : "#fff",
          background: isWinner
            ? "linear-gradient(135deg, #92400e, #78350f)"
            : isLeading
            ? `linear-gradient(135deg, ${accent}cc, ${accent}88)`
            : "rgba(255,255,255,0.09)",
          border: isWinner
            ? "2px solid #fbbf24"
            : isLeading
            ? `2px solid ${accent}`
            : "2px solid rgba(255,255,255,0.14)",
          boxShadow: isWinner
            ? `0 0 28px 8px rgba(251,191,36,0.55)`
            : isLeading
            ? `0 0 18px 5px rgba(${glowRgb},0.55)`
            : "none",
          transform: isWinner ? "scale(1.18)" : isLeading ? "scale(1.06)" : "scale(1)",
          transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          flexShrink: 0,
        }}
      >
        {score}
      </div>

      {/* Name + winner badge */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: side === "right" ? "flex-end" : "flex-start" }}>
        <span
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: isWinner ? "#fbbf24" : "#fff",
            textShadow: isWinner
              ? "0 0 14px rgba(251,191,36,0.8)"
              : "0 2px 10px rgba(0,0,0,0.55)",
            letterSpacing: "0.4px",
            lineHeight: 1,
            maxWidth: 190,
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
              fontSize: 10,
              fontWeight: 700,
              color: "#fbbf24",
              letterSpacing: "2.5px",
              textTransform: "uppercase",
              marginTop: 3,
              textShadow: "0 0 10px rgba(251,191,36,0.65)",
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
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => { document.head.removeChild(meta); };
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
    <div style={{ width: "100%", background: "transparent", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          height: 80,
          display: "flex",
          alignItems: "center",
          background: hasWinner
            ? `linear-gradient(90deg, #5a0f1a 0%, #1a0a0a 35%, #0f0f1a 50%, #0a0a1a 65%, #062830 100%)`
            : `linear-gradient(90deg, #5a0f1a 0%, #1a0a0a 35%, #0f0f1a 50%, #0a0a1a 65%, #062830 100%)`,
          borderBottom: hasWinner
            ? "2px solid rgba(251,191,36,0.55)"
            : "1px solid rgba(255,255,255,0.07)",
          boxShadow: hasWinner
            ? "0 4px 36px rgba(251,191,36,0.18)"
            : "0 4px 28px rgba(0,0,0,0.65)",
        }}
      >
        {/* ── Blurred background logo — full-width centered ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 0,
            overflow: "hidden",
          }}
        >
          <img
            src="/Jogge_Di_Balla_Final_Transparent.png"
            alt=""
            aria-hidden="true"
            style={{
              height: 200,
              width: "auto",
              opacity: 0.09,
              filter: "blur(8px) brightness(2.5) saturate(0.3)",
              transform: "scale(1.1)",
              userSelect: "none",
              flexShrink: 0,
            }}
          />
        </div>

        {/* ── Red side glow ── */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "42%",
            height: "100%",
            background: `linear-gradient(90deg, ${RED}55 0%, transparent 100%)`,
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
            width: "42%",
            height: "100%",
            background: `linear-gradient(270deg, ${BLUE}55 0%, transparent 100%)`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* ── Abstract decorations ── */}
        <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
          <AbstractLeft />
          <AbstractRight />
        </div>

        {/* ── Winner shimmer ── */}
        {hasWinner && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.07) 50%, transparent 100%)",
              zIndex: 3,
              pointerEvents: "none",
              animation: "sdk-shimmer 2.2s ease-in-out infinite",
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
            padding: "0 22px",
            gap: 14,
          }}
        >
          {/* Player 1 */}
          <PlayerSide
            name={player1Name}
            score={player1Score}
            side="left"
            isWinner={p1Winner}
            isLeading={p1Leads && !hasWinner}
            color="red"
          />

          {/* Centre */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              flexShrink: 0,
              minWidth: 190,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "3.5px",
                textTransform: "uppercase",
                color: hasWinner ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.4)",
                lineHeight: 1,
              }}
            >
              {showTitle ?? "Schlag den Kassier"}
            </span>

            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: hasWinner ? "#fbbf24" : "rgba(255,255,255,0.95)",
                letterSpacing: "0.4px",
                lineHeight: 1,
                textShadow: hasWinner
                  ? "0 0 14px rgba(251,191,36,0.75)"
                  : "0 2px 8px rgba(0,0,0,0.6)",
              }}
            >
              {hasWinner ? "🏆 Sieger steht fest!" : gameLabel}
            </span>

            {!hasWinner && (
              <GameDots current={currentGame} total={totalGames} isFinished={isFinished} />
            )}
          </div>

          {/* Player 2 */}
          <PlayerSide
            name={player2Name}
            score={player2Score}
            side="right"
            isWinner={p2Winner}
            isLeading={p2Leads && !hasWinner}
            color="blue"
          />
        </div>
      </div>

      <style>{`
        @keyframes sdk-shimmer {
          0%   { opacity: 0; transform: translateX(-60%); }
          50%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(60%); }
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: transparent !important; overflow: hidden; }
      `}</style>
    </div>
  );
}
