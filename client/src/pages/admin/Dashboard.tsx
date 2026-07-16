import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { parseErrorMessage } from '@/lib/errorMessages';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
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
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Menu,
  Eye,
  EyeOff,
  Zap,
  Projector,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const MotionDiv = motion.div;

// Permission definitions
const PERMISSIONS = [
  {
    key: 'edit_events',
    label: 'Events bearbeiten',
    icon: Calendar,
    roles: ['admin', 'maintainer', 'editor'],
  },
  {
    key: 'manage_sponsors',
    label: 'Sponsoren verwalten',
    icon: Image,
    roles: ['admin', 'maintainer'],
  },
  {
    key: 'manage_goennermitglieder',
    label: 'Gönnermitglieder verwalten',
    icon: UserCog,
    roles: ['admin', 'maintainer'],
  },
  {
    key: 'edit_shotcounter',
    label: 'Shotcounter bearbeiten',
    icon: Wine,
    roles: ['admin', 'maintainer', 'editor'],
  },
  {
    key: 'reset_shotcounter',
    label: 'Shotcounter zurücksetzen',
    icon: RotateCcw,
    roles: ['admin'],
  },
  {
    key: 'edit_team',
    label: 'Team bearbeiten',
    icon: Users2,
    roles: ['admin', 'maintainer'],
  },
  {
    key: 'manage_attendance',
    label: 'Anwesenheitsliste verwalten',
    icon: ClipboardList,
    roles: ['admin', 'maintainer'],
  },
  {
    key: 'manage_slideshow',
    label: 'Live-Diashow verwalten',
    icon: Projector,
    roles: ['admin', 'maintainer'],
  },
];

// Default feature toggles
const DEFAULT_FEATURES = [
  {
    name: 'beamer_mode',
    description: 'Beamer-Modus Button im Shotcounter anzeigen',
  },
  {
    name: 'maintenance_mode',
    description: 'Wartungsmodus aktivieren (Website für Besucher sperren)',
  },
];

// Navbar items that can be toggled (Home, Team, Kontakt cannot be disabled)
const NAVBAR_ITEMS = [
  { name: 'nav_events', label: 'Events', canDisable: true },
  { name: 'nav_sponsors', label: 'Sponsoren', canDisable: true },
  { name: 'nav_shotcounter', label: 'Shotcounter', canDisable: true },
  { name: 'nav_dienstleistungen', label: 'Dienstleistungen', canDisable: true },
];

type ResetType = 'scores_only' | 'everything' | null;

export default function AdminDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetType, setResetType] = useState<ResetType>(null);
  const [tempLinkUrl, setTempLinkUrl] = useState('');
  const [tempLinkText, setTempLinkText] = useState('');

  const { data: users = [], isLoading: usersLoading } =
    trpc.users.list.useQuery(undefined, {
      enabled: isAuthenticated && user?.role === 'admin',
    });

  const { data: featureToggles = [], isLoading: featuresLoading } =
    trpc.features.list.useQuery(undefined, {
      enabled: isAuthenticated && user?.role === 'admin',
    });

  const { data: dbPermissions = [], isLoading: permissionsLoading } =
    trpc.permissions.list.useQuery(undefined, {
      enabled: isAuthenticated && user?.role === 'admin',
    });

  const { data: auditLogs = [], isLoading: auditLoading } =
    trpc.shotcounter.getAuditLog.useQuery(
      { limit: 50 },
      {
        enabled:
          isAuthenticated && ['admin', 'maintainer'].includes(user?.role || ''),
      },
    );

  const { data: teams = [] } = trpc.shotcounter.getTeams.useQuery(
    { year: new Date().getFullYear() },
    { enabled: isAuthenticated && user?.role === 'admin' },
  );

  const togglePermissionMutation = trpc.permissions.toggle.useMutation({
    onSuccess: () => {
      utils.permissions.list.invalidate();
      toast.success('Berechtigung aktualisiert');
    },
    onError: error => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success('Rolle erfolgreich aktualisiert!');
    },
    onError: error => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const toggleFeatureMutation = trpc.features.toggle.useMutation({
    onMutate: async ({ featureName, isEnabled }) => {
      // Cancel outgoing refetches
      await utils.features.list.cancel();

      // Snapshot previous value
      const previousToggles = utils.features.list.getData();

      // Optimistically update
      utils.features.list.setData(undefined, old => {
        if (!old) return old;
        return old.map(f =>
          f.featureName === featureName ? { ...f, isEnabled } : f,
        );
      });

      return { previousToggles };
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousToggles) {
        utils.features.list.setData(undefined, context.previousToggles);
      }
      toast.error(`Fehler: ${error.message}`);
    },
    onSuccess: () => {
      toast.success('Feature-Toggle aktualisiert!');
    },
    onSettled: () => {
      // Invalidate to refetch
      utils.features.list.invalidate();
      utils.features.get.invalidate();
    },
  });

  const createFeatureMutation = trpc.features.create.useMutation({
    onSuccess: () => {
      utils.features.list.invalidate();
    },
  });

  const setLinkMutation = trpc.features.setLink.useMutation({
    onSuccess: () => {
      utils.features.list.invalidate();
      utils.features.get.invalidate();
      toast.success('Temp-Button aktualisiert!');
    },
    onError: error => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const resetYearMutation = trpc.shotcounter.resetYear.useMutation({
    onSuccess: () => {
      utils.shotcounter.getTeams.invalidate();
      toast.success('Shotcounter erfolgreich zurückgesetzt!');
      setResetDialogOpen(false);
      setResetType(null);
    },
    onError: error => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const resetScoresMutation = trpc.shotcounter.resetScores.useMutation({
    onSuccess: () => {
      utils.shotcounter.getTeams.invalidate();
      toast.success('Alle Scores wurden auf 0 zurückgesetzt!');
      setResetDialogOpen(false);
      setResetType(null);
    },
    onError: error => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Initialize default feature toggles if they don't exist
  useEffect(() => {
    if (featureToggles && !featuresLoading) {
      DEFAULT_FEATURES.forEach(feature => {
        const exists = featureToggles.some(f => f.featureName === feature.name);
        if (!exists) {
          createFeatureMutation.mutate({
            featureName: feature.name,
            description: feature.description,
            isEnabled: feature.name === 'beamer_mode', // Enable beamer mode by default
          });
        }
      });
    }
  }, [featureToggles, featuresLoading]);

  // Seed the temp-button link inputs from the stored toggle. Key on the stored
  // primitive values (not the array reference) so a background refetch or
  // cache invalidation doesn't clobber what the admin is currently typing.
  const storedTempButton = featureToggles.find(
    f => f.featureName === 'temp_button',
  );
  const storedTempLinkUrl = storedTempButton?.linkUrl ?? '';
  const storedTempLinkText = storedTempButton?.linkText ?? '';
  useEffect(() => {
    setTempLinkUrl(storedTempLinkUrl);
    setTempLinkText(storedTempLinkText);
  }, [storedTempLinkUrl, storedTempLinkText]);

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== 'admin')) {
      toast.error(
        'Zugriff verweigert. Nur Admins haben Zugriff auf diesen Bereich.',
      );
      setLocation('/');
    }
  }, [loading, isAuthenticated, user, setLocation]);

  if (loading) {
    return (
      <div className="container py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  const handleResetChoice = (type: ResetType) => {
    setResetType(type);
    setResetDialogOpen(true);
  };

  const handleConfirmReset = () => {
    const currentYear = new Date().getFullYear();
    if (resetType === 'scores_only') {
      resetScoresMutation.mutate({ year: currentYear });
    } else if (resetType === 'everything') {
      resetYearMutation.mutate({ year: currentYear });
    }
  };

  const getFeatureToggle = (name: string) => {
    return featureToggles.find(f => f.featureName === name);
  };

  return (
    <div className="container py-8 space-y-8 overflow-x-hidden max-w-full">
      {/* Header */}
      <MotionDiv
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shrink-0">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight truncate">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Verwaltung und Konfiguration
          </p>
        </div>
      </MotionDiv>

      <div className="grid lg:grid-cols-2 gap-6 w-full">
        {/* User Management */}
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="min-w-0"
        >
          <Card className="h-full overflow-hidden w-full">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-primary shrink-0" />
                    <span className="truncate">Benutzerverwaltung</span>
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Verwalte Benutzerrollen und Zugriffsrechte
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button asChild variant="outline" size="sm">
                    <a href="/admin/activity">Activity Log</a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href="/admin/users">Alle anzeigen</a>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden px-3 sm:px-6">
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Keine Benutzer vorhanden
                </p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
                  {users.map(u => (
                    <div
                      key={u.id}
                      className={cn(
                        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-colors',
                        u.id === user.id && 'bg-primary/5 border-primary/20',
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {u.profilePictureUrl ? (
                          <img
                            src={u.profilePictureUrl}
                            alt={u.name || 'User'}
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-coral/20 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold">
                              {(u.name || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {u.displayName || u.name || 'Unbekannt'}
                            {u.id === user.id && (
                              <span className="text-xs text-primary ml-2">
                                (Du)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email || '-'}
                          </p>
                        </div>
                      </div>
                      <Select
                        value={u.role}
                        onValueChange={value =>
                          updateRoleMutation.mutate({
                            userId: u.id,
                            role: value as
                              'admin' | 'maintainer' | 'editor' | 'user',
                          })
                        }
                        disabled={u.id === user.id}
                      >
                        <SelectTrigger className="w-full sm:w-32 shrink-0">
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
          className="min-w-0"
        >
          <Card className="h-full overflow-hidden w-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">Berechtigungen</span>
              </CardTitle>
              <CardDescription className="text-sm">
                Übersicht der Rollenberechtigungen
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-3 sm:px-6">
              {/* min-w forces the table wider than the mobile viewport so the
                  overflow-x-auto wrapper actually scrolls instead of squeezing
                  the role columns until "Editor" truncates and "Member" is
                  cut off entirely. */}
              <div className="min-w-[440px] sm:min-w-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Berechtigung</TableHead>
                      <TableHead className="text-center w-14 text-xs">
                        Admin
                      </TableHead>
                      <TableHead className="text-center w-14 text-xs">
                        Maint.
                      </TableHead>
                      <TableHead className="text-center w-14 text-xs">
                        Editor
                      </TableHead>
                      <TableHead className="text-center w-14 text-xs">
                        Member
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERMISSIONS.map(perm => {
                      const hasPermission = (role: string) => {
                        return dbPermissions.some(
                          p => p.permissionKey === perm.key && p.role === role,
                        );
                      };

                      const togglePermission = (
                        role: 'admin' | 'maintainer' | 'editor' | 'user',
                        enabled: boolean,
                      ) => {
                        togglePermissionMutation.mutate({
                          permissionKey: perm.key,
                          role,
                          enabled,
                        });
                      };

                      return (
                        <TableRow key={perm.key}>
                          <TableCell className="font-medium text-xs py-2">
                            <div className="flex items-center gap-2">
                              <perm.icon className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{perm.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <button
                              onClick={() =>
                                togglePermission(
                                  'admin',
                                  !hasPermission('admin'),
                                )
                              }
                              disabled={togglePermissionMutation.isPending}
                              className="mx-auto cursor-pointer hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Klicken zum Umschalten"
                            >
                              {hasPermission('admin') ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/30" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <button
                              onClick={() =>
                                togglePermission(
                                  'maintainer',
                                  !hasPermission('maintainer'),
                                )
                              }
                              disabled={togglePermissionMutation.isPending}
                              className="mx-auto cursor-pointer hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Klicken zum Umschalten"
                            >
                              {hasPermission('maintainer') ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/30" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <button
                              onClick={() =>
                                togglePermission(
                                  'editor',
                                  !hasPermission('editor'),
                                )
                              }
                              disabled={togglePermissionMutation.isPending}
                              className="mx-auto cursor-pointer hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Klicken zum Umschalten"
                            >
                              {hasPermission('editor') ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/30" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <button
                              onClick={() =>
                                togglePermission('user', !hasPermission('user'))
                              }
                              disabled={togglePermissionMutation.isPending}
                              className="mx-auto cursor-pointer hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Klicken zum Umschalten"
                            >
                              {hasPermission('user') ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/30" />
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
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
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ToggleLeft className="h-5 w-5 text-primary" />
              Feature Toggles
            </CardTitle>
            <CardDescription className="text-sm">
              Aktiviere oder deaktiviere Features dynamisch
            </CardDescription>
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
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Monitor className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <Label
                        htmlFor="beamer-toggle"
                        className="font-medium cursor-pointer block truncate"
                      >
                        Beamer-Modus
                      </Label>
                      <p className="text-xs text-muted-foreground truncate">
                        Button im Shotcounter anzeigen
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="beamer-toggle"
                    checked={getFeatureToggle('beamer_mode')?.isEnabled ?? true}
                    onCheckedChange={checked =>
                      toggleFeatureMutation.mutate({
                        featureName: 'beamer_mode',
                        isEnabled: checked,
                      })
                    }
                  />
                </div>

                {/* Maintenance Mode Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                      <Shield className="h-5 w-5 text-warning" />
                    </div>
                    <div className="min-w-0">
                      <Label
                        htmlFor="maintenance-toggle"
                        className="font-medium cursor-pointer block truncate"
                      >
                        Wartungsmodus
                      </Label>
                      <p className="text-xs text-muted-foreground truncate">
                        Website für Besucher sperren
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="maintenance-toggle"
                    checked={
                      getFeatureToggle('maintenance_mode')?.isEnabled ?? false
                    }
                    onCheckedChange={checked =>
                      toggleFeatureMutation.mutate({
                        featureName: 'maintenance_mode',
                        isEnabled: checked,
                      })
                    }
                  />
                </div>

                {/* Temp Button Toggle + Config */}
                <div className="p-4 border rounded-xl hover:border-coral/30 transition-colors space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-coral/10 flex items-center justify-center shrink-0">
                        <Zap className="h-5 w-5 text-coral" />
                      </div>
                      <div className="min-w-0">
                        <Label
                          htmlFor="temp-button-toggle"
                          className="font-medium cursor-pointer block truncate"
                        >
                          Temporärer Button
                        </Label>
                        <p className="text-xs text-muted-foreground truncate">
                          Homepage + Navigation
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="temp-button-toggle"
                      checked={
                        getFeatureToggle('temp_button')?.isEnabled ?? false
                      }
                      onCheckedChange={checked =>
                        toggleFeatureMutation.mutate({
                          featureName: 'temp_button',
                          isEnabled: checked,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Input
                      id="temp-button-url"
                      value={tempLinkUrl}
                      onChange={e => setTempLinkUrl(e.target.value)}
                      placeholder="Ziel: /route oder https://..."
                      aria-label="Ziel (Route oder URL)"
                    />
                    <Input
                      id="temp-button-text"
                      value={tempLinkText}
                      onChange={e => setTempLinkText(e.target.value)}
                      placeholder="Button-Text"
                      aria-label="Button-Text"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        const url = tempLinkUrl.trim();
                        if (url && !/^(\/(?!\/)|https?:\/\/)/i.test(url)) {
                          toast.error(
                            'Ziel muss eine interne Route (/…) oder eine http(s)://-URL sein',
                          );
                          return;
                        }
                        setLinkMutation.mutate({
                          featureName: 'temp_button',
                          linkUrl: url || null,
                          linkText: tempLinkText.trim() || null,
                        });
                      }}
                      disabled={setLinkMutation.isPending}
                    >
                      Speichern
                    </Button>
                  </div>
                </div>

                {/* Diashow Button Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Projector className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <Label
                        htmlFor="diashow-button-toggle"
                        className="font-medium cursor-pointer block"
                      >
                        Live-Diashow Button (Homepage)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Zeigt auf der Homepage einen Button zur aktuellen
                        Live-Diashow (
                        <span className="font-mono text-primary">
                          /diashow/&lt;token&gt;
                        </span>
                        ). Für ein Fest aktivieren.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="diashow-button-toggle"
                    checked={
                      getFeatureToggle('diashow_button')?.isEnabled ?? false
                    }
                    onCheckedChange={checked =>
                      toggleFeatureMutation.mutate({
                        featureName: 'diashow_button',
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

      {/* Navbar Visibility Toggles */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Menu className="h-5 w-5 text-primary" />
              Navigation Sichtbarkeit
            </CardTitle>
            <CardDescription className="text-sm">
              Steuere welche Seiten in der Navigation sichtbar sind.
              Deaktivierte Seiten sind nur für eingeloggte Benutzer zugänglich.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {featuresLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Fixed items that cannot be disabled */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="font-medium">Immer sichtbar:</span>
                  <span className="px-2 py-0.5 rounded bg-muted">Home</span>
                  <span className="px-2 py-0.5 rounded bg-muted">Team</span>
                  <span className="px-2 py-0.5 rounded bg-muted">Kontakt</span>
                </div>

                {/* Toggleable items */}
                <div className="grid sm:grid-cols-2 gap-3">
                  {NAVBAR_ITEMS.map(item => {
                    const isEnabled =
                      getFeatureToggle(item.name)?.isEnabled ?? true;
                    return (
                      <div
                        key={item.name}
                        className={cn(
                          'flex items-center justify-between p-3 border rounded-lg transition-colors',
                          isEnabled
                            ? 'border-success/30 bg-success/5'
                            : 'border-muted bg-muted/30',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {isEnabled ? (
                            <Eye className="h-4 w-4 text-success" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span
                            className={cn(
                              'font-medium text-sm',
                              !isEnabled && 'text-muted-foreground',
                            )}
                          >
                            {item.label}
                          </span>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={checked =>
                            toggleFeatureMutation.mutate({
                              featureName: item.name,
                              isEnabled: checked,
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  Deaktivierte Seiten werden hinter einem Trenner angezeigt und
                  erfordern eine Anmeldung.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </MotionDiv>

      {/* Hidden / unlinked control pages */}
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.37 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Monitor className="h-5 w-5 text-primary" />
              Versteckte Seiten
            </CardTitle>
            <CardDescription className="text-sm">
              Nicht verlinkte Steuerungs-Seiten — nur über diese Links
              erreichbar. Von dort gelangst du auf die jeweiligen Anzeige- und
              Upload-Seiten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <a
                href="/diashow/control"
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <Projector className="h-4 w-4 text-muted-foreground" />
                  Live-Diashow — Steuerung
                </span>
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
              </a>
              <a
                href="/overlay/sdk/control"
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <Wine className="h-4 w-4 text-muted-foreground" />
                  Schlag den Kassier — Overlay-Steuerung
                </span>
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
              </a>
            </div>
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
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wine className="h-5 w-5 text-primary" />
              Shotcounter Verwaltung
            </CardTitle>
            <CardDescription className="text-sm">
              Verwalte den Shotcounter und setze ihn zurück
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border border-destructive/20 rounded-xl bg-destructive/5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-destructive">
                    Shotcounter zurücksetzen
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Wähle, ob nur die Scores oder alles (Teams + Scores)
                    zurückgesetzt werden soll.
                    {teams.length > 0 && (
                      <span className="block mt-1 text-xs">
                        Aktuell: {teams.length} Team
                        {teams.length !== 1 ? 's' : ''} im Jahr{' '}
                        {new Date().getFullYear()}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <Button
                      variant="outline"
                      className="border-warning/50 text-warning hover:bg-warning/10"
                      onClick={() => handleResetChoice('scores_only')}
                      disabled={teams.length === 0}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Nur Scores zurücksetzen
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleResetChoice('everything')}
                      disabled={teams.length === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Alles zurücksetzen
                    </Button>
                  </div>
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
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Shotcounter Audit Log</CardTitle>
            <CardDescription className="text-sm">
              Letzte 50 Aktionen im Shotcounter
            </CardDescription>
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
                      <TableHead className="text-xs">Zeitpunkt</TableHead>
                      <TableHead className="text-xs">Team</TableHead>
                      <TableHead className="text-xs">Aktion</TableHead>
                      <TableHead className="text-xs">Betrag</TableHead>
                      <TableHead className="text-xs">Score</TableHead>
                      <TableHead className="text-xs">
                        Durchgeführt von
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap py-2">
                          {new Date(log.timestamp).toLocaleString('de-DE')}
                        </TableCell>
                        <TableCell className="text-xs py-2 font-medium">
                          {log.teamName || '-'}
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          <span className="capitalize">
                            {log.action.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          {log.amount !== null ? (
                            <span
                              className={cn(
                                'font-medium text-xs',
                                log.amount > 0
                                  ? 'text-success'
                                  : 'text-destructive',
                              )}
                            >
                              {log.amount > 0 ? `+${log.amount}` : log.amount}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          {log.previousScore !== null && log.newScore !== null
                            ? `${log.previousScore} → ${log.newScore}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2">
                          {log.performedByName || 'System'}
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
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {resetType === 'scores_only'
                ? 'Scores zurücksetzen?'
                : 'Alles zurücksetzen?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resetType === 'scores_only' ? (
                <>
                  Alle Scores werden auf 0 zurückgesetzt. Die Teams bleiben
                  erhalten.
                  <strong className="block mt-2 text-warning">
                    Diese Aktion kann nicht rückgängig gemacht werden!
                  </strong>
                </>
              ) : (
                <>
                  Möchtest du den Shotcounter für {new Date().getFullYear()}{' '}
                  wirklich vollständig zurücksetzen?
                  <strong className="block mt-2 text-destructive">
                    Alle Teams und Scores werden unwiderruflich gelöscht!
                  </strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetType(null)}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              className={cn(
                resetType === 'scores_only'
                  ? 'bg-warning text-warning-foreground hover:bg-warning/90'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              )}
            >
              {resetYearMutation.isPending || resetScoresMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Zurücksetzen...
                </>
              ) : (
                'Ja, zurücksetzen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
