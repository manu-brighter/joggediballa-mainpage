/**
 * Schlag den Kassier — OBS Overlay Bar
 *
 * Designed to be used as a Browser Source in OBS Studio.
 * Transparent background, slim top bar, live polling.
 *
 * NOT linked anywhere on the website. Not indexed by search engines.
 * URL: /overlay/sdk
 */
import { useEffect } from 'react';
import { trpc } from '@/lib/trpc';

// Brand colours
const RED = '#E93F56';
const BLUE = '#0B93A7';

// ─── helpers ────────────────────────────────────────────────────────────────

function totalPoints(n: number): number {
  return (n * (n + 1)) / 2;
}

function maxRemaining(current: number, total: number): number {
  if (current > total) return 0;
  return totalPoints(total) - totalPoints(current - 1);
}

// Returns true if winning the current game would clinch the series for myScore
function hasMatchpoint(
  myScore: number,
  theirScore: number,
  currentGame: number,
  totalGames: number,
): boolean {
  if (currentGame > totalGames) return false;
  const myNewScore = myScore + currentGame;
  const theirMaxRemaining = totalPoints(totalGames) - totalPoints(currentGame);
  return myNewScore > theirScore + theirMaxRemaining;
}

// ─── Abstract background SVG ─────────────────────────────────────────────────
// Full-width abstract pattern: diagonal speed lines + geometric rings
// No logo — purely abstract

function AbstractBg({ hasWinner }: { hasWinner: boolean }) {
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      viewBox="0 0 1920 120"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Left side speed lines (red tint) ── */}
      <g opacity="0.18">
        <line
          x1="-20"
          y1="130"
          x2="180"
          y2="-10"
          stroke={RED}
          strokeWidth="28"
        />
        <line x1="30" y1="130" x2="230" y2="-10" stroke={RED} strokeWidth="14" />
        <line x1="80" y1="130" x2="280" y2="-10" stroke={RED} strokeWidth="8" />
        <line x1="120" y1="130" x2="320" y2="-10" stroke={RED} strokeWidth="4" />
      </g>

      {/* ── Right side speed lines (blue tint) ── */}
      <g opacity="0.18">
        <line
          x1="1940"
          y1="130"
          x2="1740"
          y2="-10"
          stroke={BLUE}
          strokeWidth="28"
        />
        <line
          x1="1890"
          y1="130"
          x2="1690"
          y2="-10"
          stroke={BLUE}
          strokeWidth="14"
        />
        <line
          x1="1840"
          y1="130"
          x2="1640"
          y2="-10"
          stroke={BLUE}
          strokeWidth="8"
        />
        <line
          x1="1800"
          y1="130"
          x2="1600"
          y2="-10"
          stroke={BLUE}
          strokeWidth="4"
        />
      </g>

      {/* ── Left decorative arcs ── */}
      <circle
        cx="0"
        cy="120"
        r="130"
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1.5"
      />
      <circle
        cx="0"
        cy="120"
        r="85"
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1"
      />
      <circle
        cx="0"
        cy="120"
        r="44"
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1"
      />

      {/* ── Right decorative arcs ── */}
      <circle
        cx="1920"
        cy="120"
        r="130"
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1.5"
      />
      <circle
        cx="1920"
        cy="120"
        r="85"
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1"
      />
      <circle
        cx="1920"
        cy="120"
        r="44"
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1"
      />

      {/* ── Centre geometric ring ── */}
      <circle
        cx="960"
        cy="60"
        r="80"
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1"
      />
      <circle
        cx="960"
        cy="60"
        r="55"
        fill="none"
        stroke="rgba(255,255,255,0.03)"
        strokeWidth="1"
      />

      {/* ── Scattered dots ── */}
      <circle cx="350" cy="27" r="3" fill="rgba(255,255,255,0.1)" />
      <circle cx="420" cy="83" r="2" fill="rgba(255,255,255,0.07)" />
      <circle cx="280" cy="60" r="4" fill="rgba(255,255,255,0.06)" />
      <circle cx="1570" cy="27" r="3" fill="rgba(255,255,255,0.1)" />
      <circle cx="1500" cy="83" r="2" fill="rgba(255,255,255,0.07)" />
      <circle cx="1640" cy="60" r="4" fill="rgba(255,255,255,0.06)" />

      {/* ── Thin horizontal accent lines ── */}
      <line
        x1="0"
        y1="1"
        x2="1920"
        y2="1"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
      />
      <line
        x1="0"
        y1="119"
        x2="1920"
        y2="119"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1"
      />

      {/* ── Winner: gold shimmer bar ── */}
      {hasWinner && (
        <>
          <line
            x1="0"
            y1="1"
            x2="1920"
            y2="1"
            stroke="rgba(251,191,36,0.4)"
            strokeWidth="2"
          />
          <line
            x1="0"
            y1="119"
            x2="1920"
            y2="119"
            stroke="rgba(251,191,36,0.4)"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}

// ─── Game progress dots ───────────────────────────────────────────────────────

function GameDots({
  current,
  total,
  isFinished,
}: {
  current: number;
  total: number;
  isFinished: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => {
        const gameNum = i + 1;
        const isDone = gameNum < current || isFinished;
        const isCurrent = gameNum === current && !isFinished;
        return (
          <div
            key={i}
            style={{
              width: isCurrent ? 16 : 9,
              height: isCurrent ? 16 : 9,
              borderRadius: '50%',
              background: isDone
                ? 'rgba(255,255,255,0.75)'
                : isCurrent
                  ? '#fff'
                  : 'rgba(255,255,255,0.18)',
              boxShadow: isCurrent
                ? '0 0 10px 4px rgba(255,255,255,0.55)'
                : 'none',
              transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
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
  side: 'left' | 'right';
  isWinner: boolean;
  isLeading: boolean;
  color: 'red' | 'blue';
}) {
  const accent = color === 'red' ? RED : BLUE;
  const glowRgb = color === 'red' ? '233,63,86' : '11,147,167';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flex: 1,
        flexDirection: side === 'right' ? 'row-reverse' : 'row',
      }}
    >
      {/* Score bubble */}
      <div
        style={{
          minWidth: 90,
          height: 90,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: '-1px',
          color: isWinner ? '#fbbf24' : '#fff',
          background: isWinner
            ? 'linear-gradient(135deg, #92400e, #78350f)'
            : isLeading
              ? `linear-gradient(135deg, ${accent}cc, ${accent}88)`
              : 'rgba(255,255,255,0.09)',
          border: isWinner
            ? '2px solid #fbbf24'
            : isLeading
              ? `2px solid ${accent}`
              : '2px solid rgba(255,255,255,0.14)',
          boxShadow: isWinner
            ? `0 0 28px 8px rgba(251,191,36,0.55)`
            : isLeading
              ? `0 0 18px 5px rgba(${glowRgb},0.55)`
              : 'none',
          transform: isWinner
            ? 'scale(1.18)'
            : isLeading
              ? 'scale(1.06)'
              : 'scale(1)',
          transition: 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)',
          flexShrink: 0,
        }}
      >
        {score}
      </div>

      {/* Name + winner badge */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: side === 'right' ? 'flex-end' : 'flex-start',
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: isWinner ? '#fbbf24' : '#fff',
            textShadow: isWinner
              ? '0 0 14px rgba(251,191,36,0.8)'
              : '0 2px 10px rgba(0,0,0,0.55)',
            letterSpacing: '0.4px',
            lineHeight: 1,
            maxWidth: 240,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            transition: 'color 0.5s',
          }}
        >
          {name}
        </span>
        {isWinner && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#fbbf24',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              marginTop: 5,
              textShadow: '0 0 10px rgba(251,191,36,0.65)',
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
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const { data: session } = trpc.sdk.getActive.useQuery(undefined, {
    refetchInterval: 1500,
    refetchIntervalInBackground: true,
  });

  if (!session) {
    return (
      <div style={{ width: '100%', height: 120, background: 'transparent' }} />
    );
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

  const p1Matchpoint =
    !hasWinner &&
    !isFinished &&
    hasMatchpoint(player1Score, player2Score, currentGame, totalGames);
  const p2Matchpoint =
    !hasWinner &&
    !isFinished &&
    hasMatchpoint(player2Score, player1Score, currentGame, totalGames);
  const anyMatchpoint = p1Matchpoint || p2Matchpoint;

  const gameLabel = currentGameName?.trim()
    ? currentGameName
    : `Spiel ${currentGame}`;

  return (
    <div
      style={{
        width: '100%',
        background: 'transparent',
        fontFamily: "'Inter Variable','Segoe UI',system-ui,sans-serif",
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: 120,
          display: 'flex',
          alignItems: 'center',
          background: `linear-gradient(90deg, #4a0d18 0%, #1a0a0a 30%, #0f0f1a 50%, #0a0a1a 70%, #052530 100%)`,
          borderBottom: hasWinner
            ? '2px solid rgba(251,191,36,0.55)'
            : '1px solid rgba(255,255,255,0.07)',
          boxShadow: hasWinner
            ? '0 4px 36px rgba(251,191,36,0.18)'
            : '0 4px 28px rgba(0,0,0,0.65)',
        }}
      >
        {/* ── Red side glow ── */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '40%',
            height: '100%',
            background: `linear-gradient(90deg, ${RED}50 0%, transparent 100%)`,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* ── Blue side glow ── */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '40%',
            height: '100%',
            background: `linear-gradient(270deg, ${BLUE}50 0%, transparent 100%)`,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* ── Abstract background ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          <AbstractBg hasWinner={hasWinner} />
        </div>

        {/* ── Winner shimmer ── */}
        {hasWinner && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.07) 50%, transparent 100%)',
              zIndex: 3,
              pointerEvents: 'none',
              animation: 'sdk-shimmer 2.2s ease-in-out infinite',
            }}
          />
        )}

        {/* ── Show title watermark ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 4,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: 68,
              fontWeight: 900,
              letterSpacing: '10px',
              textTransform: 'uppercase',
              color: hasWinner
                ? 'rgba(251,191,36,0.06)'
                : 'rgba(255,255,255,0.055)',
              filter: 'blur(2.5px)',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              fontFamily: "'Inter Variable','Segoe UI',system-ui,sans-serif",
            }}
          >
            {showTitle ?? 'Schlag den Kassier'}
          </span>
        </div>

        {/* ── Content ── */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: '0 32px',
            gap: 20,
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
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
              minWidth: 280,
              maxWidth: 720,
            }}
          >
            {/* Game name / winner */}
            <span
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: hasWinner
                  ? '#fbbf24'
                  : anyMatchpoint
                    ? '#f97316'
                    : '#fff',
                letterSpacing: '0.3px',
                lineHeight: 1,
                textShadow: hasWinner
                  ? '0 0 22px rgba(251,191,36,0.8)'
                  : anyMatchpoint
                    ? '0 0 18px rgba(249,115,22,0.75)'
                    : '0 2px 10px rgba(0,0,0,0.7)',
                whiteSpace: 'nowrap',
              }}
            >
              {hasWinner ? '🏆 Sieger steht fest!' : gameLabel}
            </span>

            {/* Points value */}
            {!hasWinner && !isFinished && (
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: anyMatchpoint
                    ? 'rgba(249,115,22,0.9)'
                    : 'rgba(255,255,255,0.55)',
                  letterSpacing: '1px',
                  lineHeight: 1,
                }}
              >
                +{currentGame} Spielpunkte
              </span>
            )}

            {/* Matchpoint OR game dots */}
            {anyMatchpoint && !hasWinner && (
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  color: p1Matchpoint && p2Matchpoint
                    ? '#f97316'
                    : p1Matchpoint
                      ? RED
                      : BLUE,
                  lineHeight: 1,
                  textShadow: '0 0 10px rgba(249,115,22,0.65)',
                  animation: 'sdk-matchpoint-pulse 1.4s ease-in-out infinite',
                }}
              >
                {p1Matchpoint && p2Matchpoint
                  ? '⚡ Entscheidungsspiel'
                  : p1Matchpoint
                    ? `⚡ Matchpunkt ${player1Name}`
                    : `⚡ Matchpunkt ${player2Name}`}
              </span>
            )}

            {!hasWinner && !anyMatchpoint && (
              <GameDots
                current={currentGame}
                total={totalGames}
                isFinished={isFinished}
              />
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
        @keyframes sdk-matchpoint-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: transparent !important; overflow: hidden; }
      `}</style>
    </div>
  );
}
