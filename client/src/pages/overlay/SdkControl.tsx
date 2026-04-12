/**
 * Schlag den Kassier — Admin Control Panel
 *
 * Only accessible to admins. Not linked anywhere on the website.
 * URL: /overlay/sdk/control
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Trophy,
  RotateCcw,
  Undo2,
  Play,
  Settings,
  User,
  Swords,
  ExternalLink,
  Crown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function totalPoints(n: number) {
  return (n * (n + 1)) / 2;
}

function maxRemaining(current: number, total: number) {
  if (current > total) return 0;
  return totalPoints(total) - totalPoints(current - 1);
}

function parseGameNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

// ─── Inline editable field ───────────────────────────────────────────────────

function InlineEdit({
  value,
  onSave,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (!editing) {
    return (
      <div className="flex items-center gap-2 group">
        <span className="text-sm font-medium">{value}</span>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-sm w-48"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft); setEditing(false); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
      />
      <button onClick={() => { onSave(draft); setEditing(false); }} className="text-green-500 hover:text-green-400">
        <Check className="h-4 w-4" />
      </button>
      <button onClick={() => { setDraft(value); setEditing(false); }} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Game names editor ───────────────────────────────────────────────────────

function GameNamesEditor({
  names,
  onChange,
  totalGames,
}: {
  names: string[];
  onChange: (names: string[]) => void;
  totalGames: number;
}) {
  // Ensure array has exactly totalGames entries
  const padded = Array.from({ length: totalGames }, (_, i) => names[i] ?? "");

  const update = (index: number, value: string) => {
    const next = [...padded];
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {padded.map((name, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 shrink-0">
            Spiel {i + 1}
            <span className="text-primary ml-1 font-semibold">+{i + 1}</span>
          </span>
          <Input
            value={name}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Spielname (optional)`}
            className="h-8 text-sm"
          />
        </div>
      ))}
    </div>
  );
}

// ─── Score display ───────────────────────────────────────────────────────────

function ScoreDisplay({
  name,
  score,
  isWinner,
  isLeading,
  color,
}: {
  name: string;
  score: number;
  isWinner: boolean;
  isLeading: boolean;
  color: "red" | "blue";
}) {
  const accent = color === "red" ? "text-[#E93F56]" : "text-[#0B93A7]";
  const bg = color === "red" ? "bg-[#E93F56]/10 ring-[#E93F56]/40" : "bg-[#0B93A7]/10 ring-[#0B93A7]/40";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={cn("text-xs font-semibold truncate max-w-[140px]", isWinner ? "text-yellow-500" : "text-muted-foreground")}>
        {name}
      </span>
      <div
        className={cn(
          "text-5xl font-black tabular-nums transition-all duration-300 rounded-2xl px-6 py-2.5 ring-2",
          isWinner
            ? "text-yellow-500 bg-yellow-500/10 ring-yellow-500/40"
            : isLeading
            ? `${accent} ${bg}`
            : "text-foreground bg-muted ring-transparent"
        )}
      >
        {score}
      </div>
      {isWinner && (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 gap-1 text-xs">
          <Trophy className="h-3 w-3" /> Sieger
        </Badge>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SdkControl() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  // New session form state
  const [showTitle, setShowTitle] = useState("Schlag den Kassier");
  const [p1Name, setP1Name] = useState("Kassier");
  const [p2Name, setP2Name] = useState("Kandidat");
  const [totalGames, setTotalGames] = useState(10);
  const [gameNamesInput, setGameNamesInput] = useState<string[]>([]);
  const [gameName, setGameName] = useState("");

  // Sync gameNamesInput length with totalGames
  useEffect(() => {
    setGameNamesInput((prev) => {
      const next = Array.from({ length: totalGames }, (_, i) => prev[i] ?? "");
      return next;
    });
  }, [totalGames]);

  const { data: session } = trpc.sdk.getActive.useQuery(undefined, {
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  const { data: gameLog = [] } = trpc.sdk.getGameLog.useQuery(
    { sessionId: session?.id ?? 0 },
    { enabled: !!session?.id, refetchInterval: 2000 }
  );

  // Sync gameName from session
  useEffect(() => {
    if (session?.currentGameName !== undefined) {
      setGameName(session.currentGameName ?? "");
    }
  }, [session?.currentGameName]);

  const createSession = trpc.sdk.createSession.useMutation({
    onSuccess: () => {
      utils.sdk.getActive.invalidate();
      utils.sdk.getGameLog.invalidate();
      toast.success("Neue Session gestartet!");
      setGameName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSession = trpc.sdk.updateSession.useMutation({
    onSuccess: () => { utils.sdk.getActive.invalidate(); toast.success("Gespeichert"); },
    onError: (e) => toast.error(e.message),
  });

  const awardPoint = trpc.sdk.awardPoint.useMutation({
    onSuccess: (updated) => {
      utils.sdk.getActive.invalidate();
      utils.sdk.getGameLog.invalidate();
      if (updated?.winnerId !== null && updated?.winnerId !== undefined) {
        toast.success("🏆 Sieger steht fest!", { duration: 5000 });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const undoLastGame = trpc.sdk.undoLastGame.useMutation({
    onSuccess: () => {
      utils.sdk.getActive.invalidate();
      utils.sdk.getGameLog.invalidate();
      toast.success("Letztes Spiel rückgängig gemacht");
    },
    onError: (e) => toast.error(e.message),
  });

  const resetSession = trpc.sdk.resetSession.useMutation({
    onSuccess: () => {
      utils.sdk.getActive.invalidate();
      utils.sdk.getGameLog.invalidate();
      setGameName("");
      toast.success("Session zurückgesetzt");
    },
    onError: (e) => toast.error(e.message),
  });

  // Auth guard
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Kein Zugriff</CardTitle>
            <CardDescription>Diese Seite ist nur für Admins zugänglich.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isFinished = session?.winnerId !== null && session?.winnerId !== undefined;
  const p1Score = session?.player1Score ?? 0;
  const p2Score = session?.player2Score ?? 0;
  const curGame = session?.currentGame ?? 1;
  const totGames = session?.totalGames ?? 10;
  const remaining = session ? maxRemaining(curGame, totGames) : 0;
  const p1MathWinner = !isFinished && p1Score > p2Score + remaining;
  const p2MathWinner = !isFinished && p2Score > p1Score + remaining;
  const p1Winner = isFinished ? session?.winnerId === 1 : p1MathWinner;
  const p2Winner = isFinished ? session?.winnerId === 2 : p2MathWinner;
  const hasWinner = p1Winner || p2Winner;
  const gamePoints = curGame;

  // Pre-defined game names for current session
  const sessionGameNames = parseGameNames(session?.gameNames);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/Jogge_Di_Balla_Final_Transparent.png" alt="Jogge di Balla" className="h-8 w-auto" />
          <div>
            <h1 className="text-lg font-bold leading-none">Schlag den Kassier</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Overlay Control Panel</p>
          </div>
        </div>
        <a
          href="/overlay/sdk"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Overlay öffnen
        </a>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-5">

        {/* ── Live Score ── */}
        {session && (
          <Card className={cn("border-2 transition-all duration-500", hasWinner ? "border-yellow-500/50 bg-yellow-500/5" : "border-primary/30")}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Swords className="h-4 w-4" />
                    Live Spielstand
                  </CardTitle>
                  <span className="text-muted-foreground">—</span>
                  <InlineEdit
                    value={session.showTitle ?? "Schlag den Kassier"}
                    onSave={(v) => updateSession.mutate({ sessionId: session.id, showTitle: v || "Schlag den Kassier" })}
                    placeholder="Schlag den Kassier"
                  />
                </div>
                <Badge variant={hasWinner ? "default" : "secondary"} className="gap-1">
                  {hasWinner
                    ? <><Trophy className="h-3 w-3" /> Beendet</>
                    : <><Play className="h-3 w-3" /> Spiel {curGame} / {totGames}</>
                  }
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Scoreboard */}
              <div className="flex items-center justify-between gap-4 py-2">
                <ScoreDisplay name={session.player1Name} score={p1Score} isWinner={p1Winner} isLeading={p1Score > p2Score && !hasWinner} color="red" />
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <span className="text-3xl font-black">VS</span>
                  {!hasWinner && (
                    <span className="text-xs text-center leading-tight">
                      Spiel {curGame}<br />
                      <span className="font-bold text-primary text-sm">+{gamePoints} Punkte</span>
                    </span>
                  )}
                </div>
                <ScoreDisplay name={session.player2Name} score={p2Score} isWinner={p2Winner} isLeading={p2Score > p1Score && !hasWinner} color="blue" />
              </div>

              {/* Inline name editing */}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#E93F56]" />
                  <InlineEdit
                    value={session.player1Name}
                    onSave={(v) => updateSession.mutate({ sessionId: session.id, player1Name: v || session.player1Name })}
                    placeholder="Kassier"
                  />
                </div>
                <div className="flex items-center gap-2 flex-row-reverse">
                  <div className="w-3 h-3 rounded-full bg-[#0B93A7]" />
                  <InlineEdit
                    value={session.player2Name}
                    onSave={(v) => updateSession.mutate({ sessionId: session.id, player2Name: v || session.player2Name })}
                    placeholder="Kandidat"
                  />
                </div>
              </div>

              {/* Current game name */}
              {!hasWinner && (
                <div className="flex gap-2">
                  <Input
                    placeholder={`Name für Spiel ${curGame} (optional)`}
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updateSession.mutate({ sessionId: session.id, currentGameName: gameName });
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateSession.mutate({ sessionId: session.id, currentGameName: gameName })}
                    disabled={updateSession.isPending}
                  >
                    Setzen
                  </Button>
                </div>
              )}

              {/* Quick-fill from pre-defined names */}
              {!hasWinner && sessionGameNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {sessionGameNames.map((n, i) => n && (
                    <button
                      key={i}
                      onClick={() => {
                        setGameName(n);
                        updateSession.mutate({ sessionId: session.id, currentGameName: n });
                      }}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border transition-colors",
                        i + 1 === curGame
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {i + 1}. {n}
                    </button>
                  ))}
                </div>
              )}

              {/* Award buttons */}
              {!hasWinner && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    className="h-16 text-base font-bold gap-2 border-0"
                    style={{ background: "#E93F56" }}
                    onClick={() => session && awardPoint.mutate({ sessionId: session.id, winnerId: 1 })}
                    disabled={awardPoint.isPending}
                  >
                    <Crown className="h-5 w-5" />
                    {session.player1Name}
                    <Badge variant="secondary" className="ml-1 bg-black/20 text-white border-0">+{gamePoints}</Badge>
                  </Button>
                  <Button
                    size="lg"
                    className="h-16 text-base font-bold gap-2 border-0"
                    style={{ background: "#0B93A7" }}
                    onClick={() => session && awardPoint.mutate({ sessionId: session.id, winnerId: 2 })}
                    disabled={awardPoint.isPending}
                  >
                    <Crown className="h-5 w-5" />
                    {session.player2Name}
                    <Badge variant="secondary" className="ml-1 bg-black/20 text-white border-0">+{gamePoints}</Badge>
                  </Button>
                </div>
              )}

              {hasWinner && (
                <div className="text-center py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-lg font-bold text-yellow-500 flex items-center justify-center gap-2">
                    <Trophy className="h-6 w-6" />
                    {p1Winner ? session.player1Name : session.player2Name} hat gewonnen!
                  </p>
                </div>
              )}

              <Separator />
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => session && undoLastGame.mutate({ sessionId: session.id })}
                  disabled={undoLastGame.isPending || gameLog.length === 0}
                >
                  <Undo2 className="h-4 w-4" />
                  Letztes Spiel rückgängig
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (!session) return;
                    if (confirm("Session wirklich zurücksetzen? Alle Punkte werden gelöscht.")) {
                      resetSession.mutate({ sessionId: session.id });
                    }
                  }}
                  disabled={resetSession.isPending}
                >
                  <RotateCcw className="h-4 w-4" />
                  Zurücksetzen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Game Log ── */}
        {session && gameLog.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spielverlauf</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {gameLog.map((entry) => {
                  const winner = entry.winnerId === 1 ? session.player1Name : session.player2Name;
                  const isP1 = entry.winnerId === 1;
                  return (
                    <div key={entry.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs w-16 justify-center">Spiel {entry.gameNumber}</Badge>
                        {entry.gameName && <span className="text-muted-foreground">{entry.gameName}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium", isP1 ? "text-[#E93F56]" : "text-[#0B93A7]")}>{winner}</span>
                        <Badge className={cn("border-0", isP1 ? "bg-[#E93F56]/20 text-[#E93F56]" : "bg-[#0B93A7]/20 text-[#0B93A7]")}>
                          +{entry.pointsAwarded}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── New Session ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              {session ? "Neue Session starten" : "Session einrichten"}
            </CardTitle>
            {session && <CardDescription>Startet eine neue Session und setzt alle Punkte zurück.</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {session && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 -mt-1"
                onClick={() => {
                  setShowTitle(session.showTitle ?? "Schlag den Kassier");
                  setP1Name(session.player1Name);
                  setP2Name(session.player2Name);
                  setTotalGames(session.totalGames);
                  setGameNamesInput(parseGameNames(session.gameNames));
                }}
              >
                <ChevronRight className="h-3 w-3" />
                Aktuelle Einstellungen übernehmen
              </Button>
            )}

            {/* Show title */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Showtitel</Label>
              <Input value={showTitle} onChange={(e) => setShowTitle(e.target.value)} placeholder="Schlag den Kassier" />
              <p className="text-xs text-muted-foreground">z.B. "Schlag den Kassier", "Schlag den Präsi", "Schlag den Trainer"</p>
            </div>

            <Separator />

            {/* Player names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#E93F56]" />
                  <User className="h-3.5 w-3.5" /> Spieler 1
                </Label>
                <Input value={p1Name} onChange={(e) => setP1Name(e.target.value)} placeholder="Kassier" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#0B93A7]" />
                  <User className="h-3.5 w-3.5" /> Spieler 2
                </Label>
                <Input value={p2Name} onChange={(e) => setP2Name(e.target.value)} placeholder="Kandidat" />
              </div>
            </div>

            {/* Total games */}
            <div className="space-y-1.5 max-w-[200px]">
              <Label>Anzahl Spiele</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={totalGames}
                onChange={(e) => setTotalGames(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">Max. Punkte: {totalPoints(totalGames)}</p>
            </div>

            <Separator />

            {/* Game names */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5" /> Spielnamen (optional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Definiere die Namen der einzelnen Spiele im Voraus. Das Overlay zeigt automatisch den richtigen Namen an.
              </p>
              <GameNamesEditor
                names={gameNamesInput}
                onChange={setGameNamesInput}
                totalGames={totalGames}
              />
            </div>

            <Button
              className="gap-2"
              onClick={() => {
                createSession.mutate({
                  showTitle: showTitle.trim() || "Schlag den Kassier",
                  player1Name: p1Name.trim() || "Kassier",
                  player2Name: p2Name.trim() || "Kandidat",
                  totalGames,
                  gameNames: gameNamesInput.map((n) => n.trim()),
                });
              }}
              disabled={createSession.isPending}
            >
              <Play className="h-4 w-4" />
              {session ? "Neue Session starten" : "Session starten"}
            </Button>
          </CardContent>
        </Card>

        {/* ── OBS hint ── */}
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">
              <strong>OBS Browser Source URL:</strong>{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                {typeof window !== "undefined" ? window.location.origin : "https://joggediballa.ch"}/overlay/sdk
              </code>
              {" "}— Empfohlene Breite: <strong>1920px</strong>, Höhe: <strong>80px</strong>. Hintergrundfarbe auf transparent stellen.
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
