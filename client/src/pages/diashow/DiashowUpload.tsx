import { useParams } from 'wouter';
import { useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { trpc } from '@/lib/trpc';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus, Check, Loader2, X } from 'lucide-react';

// Growing poll intervals (ms, fibonacci-ish) so checking the moderation status
// of pending uploads backs off and never hammers the server.
const FIB_MS = [3000, 4000, 6000, 9000, 14000, 22000, 30000];

type Item = {
  localId: string;
  previewUrl: string;
  state:
    | 'compressing'
    | 'uploading'
    | 'pending'
    | 'live'
    | 'rejected'
    | 'error';
  photoId?: number;
  error?: string;
};

const COMPRESSION = {
  maxSizeMB: 1.2,
  maxWidthOrHeight: 2560,
  useWebWorker: true,
  initialQuality: 0.8,
};

export default function DiashowUpload() {
  const { token } = useParams<{ token: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: state } = trpc.slideshow.publicState.useQuery(
    { token: token ?? '' },
    { refetchInterval: 8000, enabled: !!token },
  );

  function patch(localId: string, next: Partial<Item>) {
    setItems(prev =>
      prev.map(it => (it.localId === localId ? { ...it, ...next } : it)),
    );
  }

  // Live moderation status for this device's pending uploads, polled with a
  // backing-off interval. Stops automatically once nothing is pending.
  const pendingIds = items
    .filter(it => it.state === 'pending' && it.photoId != null)
    .map(it => it.photoId as number)
    .sort((a, b) => a - b);

  const { data: statuses } = trpc.slideshow.photoStatuses.useQuery(
    { token: token ?? '', ids: pendingIds },
    {
      enabled: !!token && pendingIds.length > 0,
      refetchInterval: query =>
        FIB_MS[Math.min(query.state.dataUpdateCount ?? 0, FIB_MS.length - 1)],
    },
  );

  useEffect(() => {
    if (!statuses) return;
    setItems(prev =>
      prev.map(it => {
        if (it.state !== 'pending' || it.photoId == null) return it;
        const found = statuses.find(s => s.id === it.photoId);
        if (!found) return { ...it, state: 'rejected' as const };
        if (found.status === 'approved')
          return { ...it, state: 'live' as const };
        return it;
      }),
    );
  }, [statuses]);

  async function handleFiles(files: FileList | null) {
    if (!files || !token) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const localId = `${file.name}-${file.size}-${items.length}-${Math.round(
        performance.now(),
      )}`;
      const previewUrl = URL.createObjectURL(file);
      setItems(prev => [
        ...prev,
        { localId, previewUrl, state: 'compressing' },
      ]);
      try {
        const compressed = await imageCompression(file, COMPRESSION);
        patch(localId, { state: 'uploading' });
        const form = new FormData();
        form.append('file', compressed, 'photo.jpg');
        const res = await fetch(
          `/api/upload/slideshow-photo?token=${encodeURIComponent(token)}`,
          { method: 'POST', body: form, credentials: 'include' },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          patch(localId, {
            state: 'error',
            error: body.error || 'Upload fehlgeschlagen',
          });
          continue;
        }
        const body = (await res.json()) as {
          status: 'pending' | 'live';
          id: number;
        };
        patch(localId, { state: body.status, photoId: body.id });
      } catch {
        patch(localId, { state: 'error', error: 'Fehler beim Verarbeiten' });
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  const invalid = state && state.valid === false;
  const uploadsClosed = state?.valid && !state.uploadsOpen;
  const contributed = items.filter(
    it => it.state === 'pending' || it.state === 'live',
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-8">
      <SEO title="Foto hochladen" noIndex />

      <h1 className="text-3xl font-bold text-center">
        {state?.valid && state.eventTitle ? state.eventTitle : 'Live-Diashow'}
      </h1>
      <p className="text-muted-foreground text-center mt-1 mb-6 max-w-sm">
        Lade deine Fotos hoch — sie erscheinen auf der Event-Leinwand.
      </p>

      {invalid ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-center max-w-sm">
          Dieser Link ist abgelaufen, oder war nie echt. Frag am Event kurz beim
          Team nach.
        </div>
      ) : uploadsClosed ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-center max-w-sm">
          Grad Pause. Die Diashow nimmt momentan keine neuen Fotos. Bis gleich!
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <Button
              size="lg"
              className="h-16 text-lg"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="mr-2 size-6" /> Fotos auswählen
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-16 text-lg"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.setAttribute('capture', 'environment');
                  inputRef.current.click();
                  inputRef.current.removeAttribute('capture');
                }
              }}
            >
              <Camera className="mr-2 size-6" /> Foto aufnehmen
            </Button>
          </div>

          {state?.valid && state.moderationEnabled && (
            <p className="text-xs text-muted-foreground mt-4 text-center max-w-sm">
              Deine Fotos werden kurz vom Team geprüft, bevor sie erscheinen.
            </p>
          )}

          {/* Subtiler Datenschutz-/Einwilligungshinweis am Upload-Punkt. */}
          <p className="text-[11px] leading-relaxed text-muted-foreground/70 mt-4 text-center max-w-xs">
            Hochgeladene Fotos erscheinen öffentlich auf der Leinwand — bitte nur
            Bilder, die du zeigen darfst.{' '}
            <a
              href="/datenschutz"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Datenschutz
            </a>
          </p>

          {contributed > 0 && (
            <p className="text-sm font-medium mt-4">
              Du hast {contributed} {contributed === 1 ? 'Foto' : 'Fotos'}{' '}
              beigesteuert 🎉
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 mt-6 w-full max-w-sm">
            {items.map(it => (
              <div
                key={it.localId}
                className="relative aspect-square rounded-md overflow-hidden bg-muted"
              >
                <img
                  src={it.previewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  {(it.state === 'compressing' || it.state === 'uploading') && (
                    <Loader2 className="size-5 animate-spin text-white" />
                  )}
                  {it.state === 'pending' && (
                    <span className="text-[10px] text-white text-center px-1">
                      Wird geprüft…
                    </span>
                  )}
                  {it.state === 'live' && (
                    <Check className="size-6 text-success" />
                  )}
                  {it.state === 'rejected' && (
                    <span className="text-[10px] text-white/70 text-center px-1">
                      nicht übernommen
                    </span>
                  )}
                  {it.state === 'error' && (
                    <X className="size-6 text-destructive" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
