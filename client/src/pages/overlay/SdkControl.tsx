/**
 * Schlag den Kassier — Admin Control Panel
 *
 * Only accessible to admins. Not linked anywhere on the website.
 * URL: /overlay/sdk/control
 */
import { useState } from "react";
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

// ─── Score display ───────────────────────────────────────────────────────────

function ScoreDisplay({
  name,
  score,
  isWinner,
  isLeading,
}: {
  name: string;
  score: number;
  isWinner: boolean;
  isLeading: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium text-muted-foreground truncate max-w-[120px]">{name}</span>
      <div
        className={cn(
          "text-5xl font-black tabular-nums transition-all duration-300 rounded-xl px-5 py-2",
          isWinner
            ? "text-yellow-500 bg-yellow-500/10 ring-2 ring-yellow-500/50"
            : isLeading
            ? "text-primary bg-primary/10"
            : "text-foreground bg-muted"
        )}
      >
        {score}
      </div>
      {isWinner && (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 gap-1">
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

  // Form state for new session
  const [p1Name, setP1Name] = useState("Kassier");
  const [p2Name, setP2Name] = useState("Kandidat");
  const [totalGames, setTotalGames] = useState(10);
  const [gameName, setGameName] = useState("");

  const { data: session, isLoading } = trpc.sdk.getActive.useQuery(undefined, {
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  const { data: gameLog = [] } = trpc.sdk.getGameLog.useQuery(
    { sessionId: session?.id ?? 0 },
    { enabled: !!session?.id, refetchInterval: 2000 }
  );

  const createSession = trpc.sdk.createSession.useMutation({
    onSuccess: () => {
      utils.sdk.getActive.invalidate();
      toast.success("Neue Session gestartet!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSession = trpc.sdk.updateSession.useMutation({
    onSuccess: () => {
      utils.sdk.getActive.invalidate();
      toast.success("Gespeichert");
    },
    onError: (e) => toast.error(e.message),
  });

  const awardPoint = trpc.sdk.awardPoint.useMutation({
    onSuccess: (updated) => {
      utils.sdk.getActive.invalidate();
      utils.sdk.getGameLog.invalidate();
      if (updated?.winnerId !== null) {
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
  const gamePoints = curGame; // current game awards curGame points

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/Jogge_Di_Balla_Final_Transparent.png"
            alt="Jogge di Balla"
            className="h-8 w-auto"
          />
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

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* ── Live Score Display ── */}
        {session && (
          <Card className={cn(
            "border-2 transition-all duration-500",
            p1Winner || p2Winner ? "border-yellow-500/50 bg-yellow-500/5" : "border-primary/30"
          )}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Swords className="h-4 w-4" />
                  Live Spielstand
                </CardTitle>
                <Badge variant={isFinished || p1Winner || p2Winner ? "default" : "secondary"} className="gap-1">
                  {isFinished || p1Winner || p2Winner
                    ? <><Trophy className="h-3 w-3" /> Beendet</>
                    : <><Play className="h-3 w-3" /> Spiel {curGame} / {totGames}</>
                  }
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Scoreboard */}
              <div className="flex items-center justify-between gap-4 py-4">
                <ScoreDisplay
                  name={session.player1Name}
                  score={p1Score}
                  isWinner={p1Winner}
                  isLeading={p1Score > p2Score && !p1Winner && !p2Winner}
                />
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <span className="text-2xl font-black">VS</span>
                  {!isFinished && !p1Winner && !p2Winner && (
                    <span className="text-xs text-center">
                      Spiel {curGame} gibt<br />
                      <span className="font-bold text-primary text-sm">{gamePoints} Punkte</span>
                    </span>
                  )}
                </div>
                <ScoreDisplay
                  name={session.player2Name}
                  score={p2Score}
                  isWinner={p2Winner}
                  isLeading={p2Score > p1Score && !p1Winner && !p2Winner}
                />
              </div>

              {/* Game name input */}
              {!isFinished && !p1Winner && !p2Winner && (
                <div className="mt-2 mb-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder={`Name für Spiel ${curGame} (optional)`}
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!session) return;
                        updateSession.mutate({
                          sessionId: session.id,
                          currentGameName: gameName,
                        });
                      }}
                      disabled={updateSession.isPending}
                    >
                      Setzen
                    </Button>
                  </div>
                </div>
              )}

              {/* Award buttons */}
              {!isFinished && !p1Winner && !p2Winner && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    className="h-16 text-base font-bold gap-2 bg-primary hover:bg-primary/90"
                    onClick={() => session && awardPoint.mutate({ sessionId: session.id, winnerId: 1 })}
                    disabled={awardPoint.isPending}
                  >
                    <Crown className="h-5 w-5" />
                    {session.player1Name} gewinnt
                    <Badge variant="secondary" className="ml-1">+{gamePoints}</Badge>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-16 text-base font-bold gap-2 border-primary/50 hover:bg-primary/10"
                    onClick={() => session && awardPoint.mutate({ sessionId: session.id, winnerId: 2 })}
                    disabled={awardPoint.isPending}
                  >
                    <Crown className="h-5 w-5" />
                    {session.player2Name} gewinnt
                    <Badge variant="secondary" className="ml-1">+{gamePoints}</Badge>
                  </Button>
                </div>
              )}

              {(isFinished || p1Winner || p2Winner) && (
                <div className="text-center py-4">
                  <p className="text-lg font-bold text-yellow-500 flex items-center justify-center gap-2">
                    <Trophy className="h-6 w-6" />
                    {p1Winner ? session.player1Name : session.player2Name} hat gewonnen!
                  </p>
                </div>
              )}

              {/* Control buttons */}
              <Separator className="my-4" />
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
                      setGameName("");
                    }
                  }}
                  disabled={resetSession.isPending}
                >
                  <RotateCcw className="h-4 w-4" />
                  Session zurücksetzen
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
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs w-16 justify-center">
                          Spiel {entry.gameNumber}
                        </Badge>
                        {entry.gameName && (
                          <span className="text-muted-foreground">{entry.gameName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{winner}</span>
                        <Badge className="bg-primary/20 text-primary border-0">
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

        {/* ── New / Edit Session ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              {session ? "Neue Session starten" : "Session einrichten"}
            </CardTitle>
            {session && (
              <CardDescription>
                Startet eine neue Session und setzt alle Punkte zurück.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pre-fill from existing session */}
            {session && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 -mt-2"
                onClick={() => {
                  setP1Name(session.player1Name);
                  setP2Name(session.player2Name);
                  setTotalGames(session.totalGames);
                }}
              >
                <ChevronRight className="h-3 w-3" />
                Aktuelle Einstellungen übernehmen
              </Button>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Spieler 1 (Kassier)
                </Label>
                <Input
                  value={p1Name}
                  onChange={(e) => setP1Name(e.target.value)}
                  placeholder="Kassier"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Spieler 2 (Kandidat)
                </Label>
                <Input
                  value={p2Name}
                  onChange={(e) => setP2Name(e.target.value)}
                  placeholder="Kandidat"
                />
              </div>
            </div>
            <div className="space-y-1.5 max-w-[200px]">
              <Label>Anzahl Spiele</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={totalGames}
                onChange={(e) => setTotalGames(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">
                Max. Punkte: {totalPoints(totalGames)}
              </p>
            </div>
            <Button
              className="gap-2"
              onClick={() => {
                createSession.mutate({
                  player1Name: p1Name.trim() || "Kassier",
                  player2Name: p2Name.trim() || "Kandidat",
                  totalGames,
                });
                setGameName("");
              }}
              disabled={createSession.isPending}
            >
              <Play className="h-4 w-4" />
              {session ? "Neue Session starten" : "Session starten"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Edit player names on active session ── */}
        {session && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spielernamen anpassen</CardTitle>
              <CardDescription>Ändert die Namen ohne die Punkte zurückzusetzen.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap">
                <div className="flex gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Spieler 1</Label>
                    <Input
                      className="w-40"
                      defaultValue={session.player1Name}
                      id="edit-p1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Spieler 2</Label>
                    <Input
                      className="w-40"
                      defaultValue={session.player2Name}
                      id="edit-p2"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const p1 = (document.getElementById("edit-p1") as HTMLInputElement)?.value;
                      const p2 = (document.getElementById("edit-p2") as HTMLInputElement)?.value;
                      updateSession.mutate({
                        sessionId: session.id,
                        player1Name: p1 || session.player1Name,
                        player2Name: p2 || session.player2Name,
                      });
                    }}
                    disabled={updateSession.isPending}
                  >
                    Speichern
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── OBS URL hint ── */}
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">
              <strong>OBS Browser Source URL:</strong>{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                {typeof window !== "undefined" ? window.location.origin : "https://joggediballa.ch"}/overlay/sdk
              </code>
              {" "}— Empfohlene Breite: <strong>1920px</strong>, Höhe: <strong>80px</strong>.
              Hintergrundfarbe auf transparent stellen.
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
