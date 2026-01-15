import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { 
  Shield, 
  Users, 
  ToggleLeft, 
  Trash2, 
  Key, 
  Loader2,
  Monitor,
  Calendar,
  Image,
  UserCog,
  Wine,
  RotateCcw,
  Users2,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const MotionDiv = motion.div;

// Permission definitions
const PERMISSIONS = [
  { key: "edit_events", label: "Events bearbeiten", icon: Calendar, roles: ["admin", "maintainer", "editor"] },
  { key: "manage_sponsors", label: "Sponsoren verwalten", icon: Image, roles: ["admin", "maintainer"] },
  { key: "manage_goennermitglieder", label: "Gönnermitglieder verwalten", icon: UserCog, roles: ["admin", "maintainer"] },
  { key: "edit_shotcounter", label: "Shotcounter bearbeiten", icon: Wine, roles: ["admin", "maintainer"] },
  { key: "reset_shotcounter", label: "Shotcounter zurücksetzen", icon: RotateCcw, roles: ["admin"] },
  { key: "edit_team", label: "Team bearbeiten", icon: Users2, roles: ["admin", "maintainer"] },
];

// Default feature toggles
const DEFAULT_FEATURES = [
  { name: "beamer_mode", description: "Beamer-Modus Button im Shotcounter anzeigen" },
  { name: "maintenance_mode", description: "Wartungsmodus aktivieren (Website für Besucher sperren)" },
];

export default function AdminDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const { data: users = [], isLoading: usersLoading } = trpc.users.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const { data: featureToggles = [], isLoading: featuresLoading } = trpc.features.list.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const { data: auditLogs = [], isLoading: auditLoading } = trpc.shotcounter.getAuditLog.useQuery(
    { limit: 50 },
    {
      enabled: isAuthenticated && ["admin", "maintainer"].includes(user?.role || ""),
    }
  );

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("Rolle erfolgreich aktualisiert!");
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const toggleFeatureMutation = trpc.features.toggle.useMutation({
    onSuccess: () => {
      utils.features.list.invalidate();
      toast.success("Feature-Toggle aktualisiert!");
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const createFeatureMutation = trpc.features.create.useMutation({
    onSuccess: () => {
      utils.features.list.invalidate();
    },
  });

  const resetYearMutation = trpc.shotcounter.resetYear.useMutation({
    onSuccess: () => {
      utils.shotcounter.getTeams.invalidate();
      toast.success("Shotcounter erfolgreich zurückgesetzt!");
      setResetDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Initialize default feature toggles if they don't exist
  useEffect(() => {
    if (featureToggles && !featuresLoading) {
      DEFAULT_FEATURES.forEach((feature) => {
        const exists = featureToggles.some((f) => f.featureName === feature.name);
        if (!exists) {
          createFeatureMutation.mutate({
            featureName: feature.name,
            description: feature.description,
            isEnabled: feature.name === "beamer_mode", // Enable beamer mode by default
          });
        }
      });
    }
  }, [featureToggles, featuresLoading]);

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      toast.error("Zugriff verweigert. Nur Admins haben Zugriff auf diesen Bereich.");
      setLocation("/");
    }
  }, [loading, isAuthenticated, user, setLocation]);

  if (loading) {
    return (
      <div className="container py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const handleResetShotcounter = () => {
    const currentYear = new Date().getFullYear();
    resetYearMutation.mutate({ year: currentYear });
  };

  const getFeatureToggle = (name: string) => {
    return featureToggles.find((f) => f.featureName === name);
  };

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <MotionDiv
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-4xl font-black">
            <span className="gradient-text">Admin Dashboard</span>
          </h1>
          <p className="text-muted-foreground">Verwaltung und Konfiguration</p>
        </div>
      </MotionDiv>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* User Management */}
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Benutzerverwaltung
              </CardTitle>
              <CardDescription>Verwalte Benutzerrollen und Zugriffsrechte</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Keine Benutzer vorhanden
                </p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        u.id === user.id && "bg-primary/5 border-primary/20"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold">
                            {(u.name || "U").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {u.name || "Unbekannt"}
                            {u.id === user.id && (
                              <span className="text-xs text-primary ml-2">(Du)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email || "-"}
                          </p>
                        </div>
                      </div>
                      <Select
                        value={u.role}
                        onValueChange={(value) =>
                          updateRoleMutation.mutate({
                            userId: u.id,
                            role: value as "admin" | "maintainer" | "editor" | "user",
                          })
                        }
                        disabled={u.id === user.id}
                      >
                        <SelectTrigger className="w-32 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="maintainer">Maintainer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="user">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </MotionDiv>

        {/* Permissions Overview */}
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Berechtigungen
              </CardTitle>
              <CardDescription>Übersicht der Rollenberechtigungen</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Berechtigung</TableHead>
                    <TableHead className="text-center w-20">Admin</TableHead>
                    <TableHead className="text-center w-20">Maintainer</TableHead>
                    <TableHead className="text-center w-20">Editor</TableHead>
                    <TableHead className="text-center w-20">Member</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSIONS.map((perm) => (
                    <TableRow key={perm.key}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <perm.icon className="h-4 w-4 text-muted-foreground" />
                          {perm.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {perm.roles.includes("admin") ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {perm.roles.includes("maintainer") ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {perm.roles.includes("editor") ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <XCircle className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </MotionDiv>
      </div>

      {/* Feature Toggles */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ToggleLeft className="h-5 w-5 text-primary" />
              Feature Toggles
            </CardTitle>
            <CardDescription>Aktiviere oder deaktiviere Features dynamisch</CardDescription>
          </CardHeader>
          <CardContent>
            {featuresLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Beamer Mode Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Monitor className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <Label htmlFor="beamer-toggle" className="font-medium cursor-pointer">
                        Beamer-Modus
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Button im Shotcounter anzeigen
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="beamer-toggle"
                    checked={getFeatureToggle("beamer_mode")?.isEnabled ?? true}
                    onCheckedChange={(checked) =>
                      toggleFeatureMutation.mutate({
                        featureName: "beamer_mode",
                        isEnabled: checked,
                      })
                    }
                  />
                </div>

                {/* Maintenance Mode Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <Label htmlFor="maintenance-toggle" className="font-medium cursor-pointer">
                        Wartungsmodus
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Website für Besucher sperren
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="maintenance-toggle"
                    checked={getFeatureToggle("maintenance_mode")?.isEnabled ?? false}
                    onCheckedChange={(checked) =>
                      toggleFeatureMutation.mutate({
                        featureName: "maintenance_mode",
                        isEnabled: checked,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </MotionDiv>

      {/* Shotcounter Management */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wine className="h-5 w-5 text-primary" />
              Shotcounter Verwaltung
            </CardTitle>
            <CardDescription>Verwalte den Shotcounter und setze ihn zurück</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border border-destructive/20 rounded-xl bg-destructive/5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-destructive">Shotcounter zurücksetzen</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Setzt alle Teams und Scores für das aktuelle Jahr ({new Date().getFullYear()}) zurück. 
                    Diese Aktion kann nicht rückgängig gemacht werden!
                  </p>
                  <Button
                    variant="destructive"
                    className="mt-3"
                    onClick={() => setResetDialogOpen(true)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Zurücksetzen
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </MotionDiv>

      {/* Audit Log */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>Letzte 50 Aktionen im Shotcounter</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Keine Einträge vorhanden
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zeitpunkt</TableHead>
                      <TableHead>Aktion</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Durchgeführt von</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString("de-DE")}
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">{log.action.replace("_", " ")}</span>
                        </TableCell>
                        <TableCell>
                          {log.amount !== null ? (
                            <span className={cn(
                              "font-medium",
                              log.amount > 0 ? "text-green-500" : "text-red-500"
                            )}>
                              {log.amount > 0 ? `+${log.amount}` : log.amount}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {log.previousScore !== null && log.newScore !== null
                            ? `${log.previousScore} → ${log.newScore}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.performedByName || "System"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </MotionDiv>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Shotcounter zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du den Shotcounter für {new Date().getFullYear()} wirklich zurücksetzen? 
              <strong className="block mt-2 text-destructive">
                Alle Teams und Scores werden unwiderruflich gelöscht!
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetShotcounter}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetYearMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Zurücksetzen...</>
              ) : "Ja, zurücksetzen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
