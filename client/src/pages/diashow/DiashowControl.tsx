import { useState } from 'react';
import { StyledQr } from '@/components/StyledQr';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { usePermission } from '@/hooks/usePermissions';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Check, X, Trash2, Copy, RefreshCw, ExternalLink } from 'lucide-react';

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DiashowControl() {
  const canManage = usePermission('manage_slideshow');
  const utils = trpc.useUtils();

  const { data: settings } = trpc.slideshow.getSettings.useQuery(undefined, {
    enabled: canManage,
    refetchInterval: 5000,
  });
  const { data: pending = [] } = trpc.slideshow.listPending.useQuery(undefined, {
    enabled: canManage,
    refetchInterval: 3000,
  });
  const { data: all = [] } = trpc.slideshow.listAll.useQuery(undefined, {
    enabled: canManage,
    refetchInterval: 15000,
  });

  const invalidate = () => {
    utils.slideshow.getSettings.invalidate();
    utils.slideshow.listPending.invalidate();
    utils.slideshow.listAll.invalidate();
  };

  const update = trpc.slideshow.updateSettings.useMutation({
    onSuccess: () => utils.slideshow.getSettings.invalidate(),
    onError: e => toast.error(e.message),
  });
  const approve = trpc.slideshow.approve.useMutation({ onSuccess: invalidate });
  const reject = trpc.slideshow.reject.useMutation({ onSuccess: invalidate });
  const approveAll = trpc.slideshow.approveAll.useMutation({ onSuccess: invalidate });
  const del = trpc.slideshow.deletePhoto.useMutation({ onSuccess: invalidate });
  const rotate = trpc.slideshow.rotateToken.useMutation({
    onSuccess: () => {
      utils.slideshow.getSettings.invalidate();
      toast.success('Neuer Token — alter QR-Code ist jetzt ungültig.');
    },
  });
  const clearAll = trpc.slideshow.clearAll.useMutation({
    onSuccess: r => {
      invalidate();
      toast.success(`${r.deleted} Fotos gelöscht.`);
    },
  });

  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  if (!canManage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Kein Zugriff</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Diese Seite ist nur für Maintainer und Admins zugänglich.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        Lädt…
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const uploadUrl = `${origin}/diashow/${settings.uploadToken}/upload`;
  const liveUrl = `${origin}/diashow/${settings.uploadToken}`;
  const title = titleDraft ?? settings.eventTitle ?? '';

  const toggles: Array<[ 'isVisible' | 'uploadsOpen' | 'moderationEnabled' | 'showQr', string ]> = [
    ['isVisible', 'Diashow sichtbar'],
    ['uploadsOpen', 'Uploads offen'],
    ['moderationEnabled', 'Moderation (Freigabe nötig)'],
    ['showQr', 'QR-Code auf Diashow'],
  ];

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <SEO title="Diashow-Steuerung" noIndex />
      <h1 className="text-2xl font-bold">Live-Diashow — Steuerung</h1>

      {/* Status & Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {toggles.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={settings[key]}
                onCheckedChange={v => update.mutate({ [key]: v })}
              />
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="eventTitle">Event-Titel</Label>
            <div className="flex gap-2">
              <Input
                id="eventTitle"
                value={title}
                onChange={e => setTitleDraft(e.target.value)}
                placeholder="z.B. Jogge di Balla 2026"
              />
              <Button
                onClick={() => {
                  update.mutate({ eventTitle: title || null });
                  setTitleDraft(null);
                }}
              >
                Speichern
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>Slide-Dauer (Sek.)</Label>
              <Input
                type="number"
                min={2}
                max={60}
                defaultValue={Math.round(settings.slideDurationMs / 1000)}
                onBlur={e =>
                  update.mutate({
                    slideDurationMs: Math.max(
                      2000,
                      Math.min(60000, Number(e.target.value) * 1000),
                    ),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Übergang</Label>
              <Select
                value={settings.transition}
                onValueChange={v =>
                  update.mutate({ transition: v as 'fade' | 'kenburns' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kenburns">Ken-Burns (verspielt)</SelectItem>
                  <SelectItem value="fade">Fade (ruhig)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>Max. Fotos</Label>
              <Input
                type="number"
                min={1}
                defaultValue={settings.maxPhotos}
                onBlur={e =>
                  update.mutate({ maxPhotos: Math.max(1, Number(e.target.value)) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Upload-Limit (pro IP / 10 min)</Label>
              <Input
                type="number"
                min={1}
                defaultValue={settings.uploadRateLimit}
                onBlur={e =>
                  update.mutate({
                    uploadRateLimit: Math.max(1, Number(e.target.value)),
                  })
                }
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {settings.approvedCount} live · {settings.pendingCount} ausstehend ·{' '}
            {formatBytes(settings.totalBytes)} belegt
          </div>
          <div className="flex gap-3">
            <a href={liveUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1 size-4" /> Diashow
              </Button>
            </a>
            <a href={uploadUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1 size-4" /> Upload
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* QR & Link */}
      <Card>
        <CardHeader>
          <CardTitle>QR-Code & Link</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-6 items-center">
          <div className="bg-white p-3 rounded-xl">
            <StyledQr value={uploadUrl} size={160} />
          </div>
          <div className="flex-1 space-y-3 w-full">
            <div className="flex gap-2">
              <Input readOnly value={uploadUrl} className="text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(uploadUrl);
                  toast.success('Link kopiert');
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <RefreshCw className="mr-1 size-4" /> Token rotieren
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Token rotieren?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Der alte QR-Code und Link werden sofort ungültig. Der neue
                    QR-Code muss neu verteilt werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={() => rotate.mutate()}>
                    Rotieren
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Moderation */}
      {settings.moderationEnabled && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Moderation ({pending.length})</CardTitle>
            {pending.length > 0 && (
              <Button size="sm" onClick={() => approveAll.mutate()}>
                Alle freigeben
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Keine ausstehenden Fotos.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pending.map(p => (
                  <div key={p.id} className="space-y-2">
                    <img
                      src={p.thumbnailUrl}
                      alt=""
                      className="w-full aspect-square object-cover rounded-md"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => approve.mutate({ id: p.id })}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => reject.mutate({ id: p.id })}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Album */}
      <Card>
        <CardHeader>
          <CardTitle>
            Album ({all.filter(p => p.status === 'approved').length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {all
              .filter(p => p.status === 'approved')
              .map(p => (
                <div
                  key={p.id}
                  className="relative aspect-square rounded-md overflow-hidden group"
                >
                  <img
                    src={p.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => del.mutate({ id: p.id })}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    aria-label="Löschen"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Gefahrenzone</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 size-4" /> Alle Fotos löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Wirklich ALLE Fotos löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Löscht alle {settings.approvedCount + settings.pendingCount}{' '}
                  Fotos unwiderruflich von Disk und DB. Für das nächste Event.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearAll.mutate()}
                  className="bg-destructive text-destructive-foreground"
                >
                  Endgültig löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
