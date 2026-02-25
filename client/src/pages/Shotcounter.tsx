import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { parseErrorMessage } from "@/lib/errorMessages";
import { Plus, Minus, Trash2, Maximize2, X, Trophy, Crown, Timer, Sparkles, Settings2 } from "lucide-react";
import { useBeamerMode } from "@/App";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const MotionDiv = motion.div;

interface InlineEditProps {
  value: number;
  onSave: (newValue: number) => void;
  disabled?: boolean;
  isBeamerMode?: boolean;
}

function InlineScoreEdit({ value, onSave, disabled, isBeamerMode }: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value.toString());
  }, [value]);

  const handleSave = () => {
    const newValue = parseInt(editValue);
    if (!isNaN(newValue) && newValue !== value) {
      onSave(newValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value.toString());
      setIsEditing(false);
    }
  };

  if (disabled || isBeamerMode) {
    return (
      <span className={cn(
        "font-black tabular-nums text-primary",
        isBeamerMode ? "text-5xl md:text-8xl" : "text-xl md:text-3xl lg:text-4xl"
      )}>
        {value}
      </span>
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-16 md:w-24 text-xl md:text-3xl lg:text-4xl font-black text-center h-10 md:h-14 tabular-nums"
      />
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="text-xl md:text-3xl lg:text-4xl font-black tabular-nums text-primary hover:text-primary/80 transition-colors cursor-pointer hover:bg-primary/10 px-2 md:px-3 py-1 rounded-lg"
      title="Klicken zum Bearbeiten"
    >
      {value}
    </button>
  );
}

export default function Shotcounter() {
  const { user } = useAuth();
  const [currentYear] = useState(new Date().getFullYear());
  const [newTeamName, setNewTeamName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<{ id: number; name: string } | null>(null);
  const [winnerDialogOpen, setWinnerDialogOpen] = useState(false);
  const { isBeamerMode, setBeamerMode } = useBeamerMode();
  
  // Beamer mode row height (percentage of base height)
  const [beamerRowHeight, setBeamerRowHeight] = useState(100);
  const [showBeamerSettings, setShowBeamerSettings] = useState(false);

  // Check if beamer mode feature is enabled
  const { data: beamerModeFeature } = trpc.features.get.useQuery(
    { featureName: "beamer_mode" },
    { staleTime: 30000 }
  );
  const isBeamerModeEnabled = beamerModeFeature?.isEnabled ?? true; // Default to true if not set

  const utils = trpc.useUtils();
  const { data: teams = [], isLoading } = trpc.shotcounter.getTeams.useQuery(
    { year: currentYear },
    {
      // Real-time updates: Poll every 2 seconds for instant synchronization
      refetchInterval: 2000,
      refetchIntervalInBackground: true,
    }
  );
  
  const createTeamMutation = trpc.shotcounter.createTeam.useMutation({
    onSuccess: () => {
      utils.shotcounter.getTeams.invalidate();
      toast.success("Team erfolgreich erstellt!");
      setNewTeamName("");
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });

  const updateScoreMutation = trpc.shotcounter.updateScore.useMutation({
    onMutate: async ({ teamId, amount }) => {
      await utils.shotcounter.getTeams.cancel();
      const previousTeams = utils.shotcounter.getTeams.getData({ year: currentYear });
      
      utils.shotcounter.getTeams.setData({ year: currentYear }, (old) => {
        if (!old) return old;
        return old.map((team) =>
          team.id === teamId ? { ...team, score: team.score + amount } : team
        ).sort((a, b) => b.score - a.score);
      });
      
      return { previousTeams };
    },
    onError: (error, _, context) => {
      if (context?.previousTeams) {
        utils.shotcounter.getTeams.setData({ year: currentYear }, context.previousTeams);
      }
      toast.error(parseErrorMessage(error));
    },
    onSettled: () => {
      utils.shotcounter.getTeams.invalidate();
    },
  });

  const deleteTeamMutation = trpc.shotcounter.deleteTeam.useMutation({
    onSuccess: () => {
      utils.shotcounter.getTeams.invalidate();
      toast.success("Team gelöscht!");
      setDeleteDialogOpen(false);
      setTeamToDelete(null);
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });

  const canEditShotcounter = user && ["admin", "maintainer", "editor"].includes(user.role);

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) {
      toast.error("Bitte einen Teamnamen eingeben");
      return;
    }
    createTeamMutation.mutate({ name: newTeamName, year: currentYear });
  };

  const handleUpdateScore = (teamId: number, amount: number) => {
    updateScoreMutation.mutate({ teamId, amount });
  };

  const handleSetScore = (teamId: number, newScore: number) => {
    const team = teams.find((t) => t.id === teamId);
    if (team) {
      const diff = newScore - team.score;
      updateScoreMutation.mutate({ teamId, amount: diff });
    }
  };

  const handleDeleteTeam = (team: { id: number; name: string }) => {
    setTeamToDelete(team);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTeam = () => {
    if (teamToDelete) {
      deleteTeamMutation.mutate({ teamId: teamToDelete.id });
    }
  };

  // Countdown to New Year's Eve
  const [timeToNewYear, setTimeToNewYear] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isNewYear: false });
  
  useEffect(() => {
    const calculateTimeToNewYear = () => {
      const now = new Date();
      const nextYear = now.getFullYear() + 1;
      const newYear = new Date(nextYear, 0, 1);
      const diff = newYear.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeToNewYear({ days: 0, hours: 0, minutes: 0, seconds: 0, isNewYear: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeToNewYear({ days, hours, minutes, seconds, isNewYear: false });
    };

    calculateTimeToNewYear();
    const interval = setInterval(calculateTimeToNewYear, 1000);
    return () => clearInterval(interval);
  }, []);

  // Winner detection
  const winner = useMemo(() => {
    if (teams.length === 0) return null;
    return teams.reduce((prev, current) => (prev.score > current.score ? prev : current));
  }, [teams]);

  // Show winner popup on New Year
  useEffect(() => {
    if (timeToNewYear.isNewYear && winner && !winnerDialogOpen) {
      setWinnerDialogOpen(true);
    }
  }, [timeToNewYear.isNewYear, winner, winnerDialogOpen]);

  // Calculate dynamic row height for beamer mode
  // At 20% = very compact (fit ~30 teams), at 100% = normal size
  const getRowPadding = () => {
    // Base padding: py-6 = 24px, at 20% = 4.8px, at 100% = 24px
    const basePadding = 24;
    return Math.max(4, Math.round(basePadding * (beamerRowHeight / 100)));
  };
  
  const getRowFontSize = () => {
    // Scale font size: at 20% = small, at 100% = large
    if (beamerRowHeight <= 30) return 'text-sm';
    if (beamerRowHeight <= 50) return 'text-base';
    if (beamerRowHeight <= 70) return 'text-lg md:text-xl';
    return 'text-xl md:text-2xl';
  };
  
  const getRankSize = () => {
    if (beamerRowHeight <= 30) return 'w-6 h-6 text-xs';
    if (beamerRowHeight <= 50) return 'w-8 h-8 text-sm';
    if (beamerRowHeight <= 70) return 'w-10 h-10 text-base';
    return 'w-12 h-12 md:w-16 md:h-16 text-lg md:text-2xl';
  };
  
  const getScoreFontSize = () => {
    if (beamerRowHeight <= 30) return 'text-lg';
    if (beamerRowHeight <= 50) return 'text-xl';
    if (beamerRowHeight <= 70) return 'text-2xl';
    return 'text-3xl md:text-4xl';
  };

  // Beamer Mode
  if (isBeamerMode) {
    return (
      <div className="fixed inset-0 bg-background z-[9999] overflow-auto">
        {/* Logo watermark in background */}
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none opacity-5">
          <img
            src="/Jogge_Di_Balla_Final_Transparent.png"
            alt=""
            className="w-[60%] max-w-[800px] blur-sm"
          />
        </div>

        {/* Subtle exit button */}
        <button
          onClick={() => setBeamerMode(false)}
          className="fixed top-4 right-4 p-2 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all opacity-30 hover:opacity-100 z-[10000]"
          title="Beamer-Modus beenden (ESC)"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Settings button for scaling */}
        <button
          onClick={() => setShowBeamerSettings(!showBeamerSettings)}
          className="fixed top-4 left-4 p-2 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all opacity-30 hover:opacity-100 z-[10000]"
          title="Einstellungen"
        >
          <Settings2 className="h-6 w-6" />
        </button>

        {/* Scaling slider panel */}
        <AnimatePresence>
          {showBeamerSettings && (
            <MotionDiv
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="fixed top-16 left-4 p-4 rounded-xl bg-card/90 backdrop-blur-lg border shadow-lg z-[10000] w-64"
            >
              <Label className="text-sm font-medium mb-3 block">
                Zeilengrösse: {beamerRowHeight}%
              </Label>
              <div className="py-2">
                <Slider
                  value={[beamerRowHeight]}
                  onValueChange={(value) => setBeamerRowHeight(value[0])}
                  min={20}
                  max={100}
                  step={5}
                  className="w-full cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Kompakt</span>
                <span>Normal</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Bei 20% passen ca. 30 Teams auf den Bildschirm
              </p>
            </MotionDiv>
          )}
        </AnimatePresence>

        <div className="container py-8 pb-24 relative z-10">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-black">
              Shotcounter <span className="gradient-text">{currentYear}</span>
            </h1>
          </div>

          {/* Countdown */}
          <div className="flex justify-center gap-4 md:gap-8 mb-12">
            {[
              { value: timeToNewYear.days, label: "Tage" },
              { value: timeToNewYear.hours, label: "Stunden" },
              { value: timeToNewYear.minutes, label: "Minuten" },
              { value: timeToNewYear.seconds, label: "Sekunden" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-4xl md:text-7xl font-black tabular-nums text-primary">
                  {item.value.toString().padStart(2, "0")}
                </div>
                <div className="text-sm md:text-lg text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Teams */}
          <div className="space-y-1 w-full max-w-5xl mx-auto pb-8">
                {teams.map((team, index) => (
                  <div
                    key={team.id}
                    className={cn(
                      "rounded-lg border transition-all duration-300",
                      index === 0 
                        ? "bg-gradient-to-r from-primary/20 to-secondary/20 border-primary" 
                        : "bg-card/50 border-border"
                    )}
                    style={{ 
                      paddingTop: `${getRowPadding()}px`,
                      paddingBottom: `${getRowPadding()}px`,
                      paddingLeft: '16px',
                      paddingRight: '16px',
                      marginBottom: `${Math.max(2, beamerRowHeight / 20)}px`
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Rank & Name */}
                      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "flex-shrink-0 rounded-full flex items-center justify-center font-black",
                          getRankSize(),
                          index === 0 
                            ? "bg-yellow-500/30 text-yellow-500" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          {index === 0 ? (
                            <Crown className={beamerRowHeight <= 50 ? "h-3 w-3" : "h-5 w-5"} />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span className={cn("font-bold truncate", getRowFontSize())}>
                          {team.name}
                        </span>
                      </div>
                      
                      {/* Score */}
                      <span className={cn("font-black tabular-nums text-primary flex-shrink-0", getScoreFontSize())}>
                        {team.score}
                      </span>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 md:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <MotionDiv
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center md:text-left"
        >
          <h1 className="text-4xl md:text-5xl font-black">
            Shotcounter <span className="gradient-text">{currentYear}</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Welches Team trinkt die meisten Shots bis Ende {currentYear}?
          </p>
        </MotionDiv>
        
        {/* Beamer button - only shown when feature is enabled */}
        {isBeamerModeEnabled && (
          <Button 
            variant="outline" 
            size="lg" 
            onClick={() => setBeamerMode(true)}
            className="hidden md:flex btn-animate gap-2"
          >
            <Maximize2 className="h-5 w-5" />
            Beamer-Modus
          </Button>
        )}
      </div>

      {/* Countdown Card */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Timer className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Countdown zum Silvester</h3>
                  <p className="text-sm text-muted-foreground">Wer gewinnt dieses Jahr? Vielleicht gibt es ein Preis?</p>
                </div>
              </div>
              
              {timeToNewYear.isNewYear ? (
                <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                  <Sparkles className="h-6 w-6" />
                  Frohes Neues Jahr!
                  <Sparkles className="h-6 w-6" />
                </div>
              ) : (
                <div className="flex gap-3 md:gap-4">
                  {[
                    { value: timeToNewYear.days, label: "Tage" },
                    { value: timeToNewYear.hours, label: "Std" },
                    { value: timeToNewYear.minutes, label: "Min" },
                    { value: timeToNewYear.seconds, label: "Sek" },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <div className="text-2xl md:text-4xl font-black tabular-nums text-primary">
                        {item.value.toString().padStart(2, "0")}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </MotionDiv>

      {/* Teams Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            Teams
          </h2>
          
          {canEditShotcounter && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-animate gap-2">
                  <Plus className="h-4 w-4" />
                  Team erstellen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neues Team erstellen</DialogTitle>
                  <DialogDescription>
                    Gib einen Namen für das neue Team ein.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamName">Teamname</Label>
                    <Input
                      id="teamName"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="z.B. Die Durstigen"
                      onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleCreateTeam} disabled={createTeamMutation.isPending}>
                    {createTeamMutation.isPending ? "Erstelle..." : "Erstellen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Noch keine Teams vorhanden.</p>
              {canEditShotcounter && (
                <Button 
                  className="mt-4 btn-animate" 
                  onClick={() => setCreateDialogOpen(true)}
                >
                  Erstes Team erstellen
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
                {teams.map((team, index) => (
                  <div
                    key={team.id}
                    className={cn(
                      "p-4 md:p-6 rounded-xl border-2 transition-all duration-300",
                      index === 0 
                        ? "bg-gradient-to-r from-primary/10 to-secondary/10 border-primary shadow-lg shadow-primary/10" 
                        : "bg-card border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 md:gap-4">
                      {/* Rank & Name */}
                      <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
                        <div className={cn(
                          "flex-shrink-0 w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center font-black text-sm md:text-lg",
                          index === 0 
                            ? "bg-yellow-500/20 text-yellow-500" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          {index === 0 ? <Crown className="h-4 w-4 md:h-6 md:w-6" /> : index + 1}
                        </div>
                        <span className="font-bold text-base md:text-xl truncate">{team.name}</span>
                      </div>
                      
                      {/* Score & Actions */}
                      <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
                        <div className="flex-shrink-0">
                          <InlineScoreEdit
                            value={team.score}
                            onSave={(newScore) => handleSetScore(team.id, newScore)}
                            disabled={!canEditShotcounter}
                          />
                        </div>
                        
                        {canEditShotcounter && (
                          <div className="flex items-center gap-0.5 md:gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 md:h-10 md:w-10"
                              onClick={() => handleUpdateScore(team.id, -1)}
                            >
                              <Minus className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 md:h-10 md:w-10"
                              onClick={() => handleUpdateScore(team.id, 1)}
                            >
                              <Plus className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 md:h-10 px-2 md:px-3 text-xs md:text-sm"
                              onClick={() => handleUpdateScore(team.id, 5)}
                            >
                              +5
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 md:h-10 md:w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteTeam(team)}
                            >
                              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Team löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du das Team "{teamToDelete?.name}" löschen möchtest? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTeam}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTeamMutation.isPending ? "Lösche..." : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Winner Dialog */}
      <Dialog open={winnerDialogOpen} onOpenChange={setWinnerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">🎉 Gewinner {currentYear}! 🎉</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <Crown className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-3xl font-black gradient-text mb-2">{winner?.name}</h2>
            <p className="text-5xl font-black text-primary">{winner?.score} Shots</p>
            <p className="text-muted-foreground mt-4">
              Herzlichen Glückwunsch zum Sieg im Shotcounter {currentYear}!
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setWinnerDialogOpen(false)} className="w-full">
              Schliessen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
