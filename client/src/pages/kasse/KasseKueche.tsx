import { useState } from 'react';
import { useParams } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatChf, formatWait, urgency, waitMinutes } from '@/lib/kasse';
import { Check, History, Loader2, Trash2, Utensils } from 'lucide-react';

/** Farbcodierung der Wartezeit — die Küche sieht sofort, was liegen bleibt. */
const URGENCY_STYLES = {
  normal: 'border-pending/50 bg-pending/10',
  urgent: 'border-pending bg-pending/20',
  overdue: 'border-destructive bg-destructive/15',
} as const;

export default function KasseKueche() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? '';

  const [showClosed, setShowClosed] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);

  const state = trpc.kasse.publicState.useQuery(
    { token },
    { refetchInterval: 30000 },
  );
  // Die Wartezeit kommt als Sekunden vom Server mit; bei 3 s Poll-Intervall
  // läuft sie ohne eigenen Timer mit und hängt nicht an der Uhr des Tablets.
  const orders = trpc.kasse.listOpenOrders.useQuery(
    { token },
    { enabled: state.data?.valid === true, refetchInterval: 3000 },
  );
  const closedOrders = trpc.kasse.listClosedOrders.useQuery(
    { token, limit: 50 },
    { enabled: state.data?.valid === true && showClosed },
  );

  const utils = trpc.useUtils();
  const setStatus = trpc.kasse.setOrderStatus.useMutation({
    onSuccess: (_result, variables) => {
      utils.kasse.listOpenOrders.invalidate();
      // Nur nachladen, wenn die Liste überhaupt offen ist: das Tablet pollt
      // im 3-Sekunden-Takt, und jede „Bereit"-Bestätigung hätte sonst eine
      // zweite Abfrage über die ganze Historie ausgelöst.
      if (
        showClosed &&
        (variables.status === 'delivered' || variables.status === 'cancelled')
      ) {
        utils.kasse.listClosedOrders.invalidate();
      }
    },
    onError: e => toast.error(e.message),
  });

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!state.data?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <SEO title="Kasse" noIndex />
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Ungültiger Link</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Dieser Kassen-Link ist nicht (mehr) gültig. Hol dir den aktuellen
            Link oder QR-Code beim Admin.
          </CardContent>
        </Card>
      </div>
    );
  }

  const all = orders.data ?? [];
  const pending = all.filter(o => o.status === 'pending');
  const ready = all.filter(o => o.status === 'ready');
  const busy = (orderId: number) =>
    setStatus.isPending && setStatus.variables?.orderId === orderId;

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Kasse — Küche" noIndex />

      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Utensils className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">Küche</h1>
            <p className="text-xs text-muted-foreground">
              {state.data.session?.name ?? 'Keine offene Kasse'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span>
            <span className="text-2xl font-bold tabular-nums text-pending">
              {pending.length}
            </span>
            <span className="ml-2 text-muted-foreground">offen</span>
          </span>
          <span>
            <span className="text-2xl font-bold tabular-nums text-success">
              {ready.length}
            </span>
            <span className="ml-2 text-muted-foreground">bereit</span>
          </span>
        </div>
      </header>

      <main className="space-y-8 p-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Zu erledigen
          </h2>

          {pending.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Keine offenen Bestellungen.
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map(order => {
                const minutes = waitMinutes(order.waitSeconds);
                return (
                  <article
                    key={order.id}
                    className={`grid grid-cols-[8rem_1fr_7rem_17rem] items-center gap-6 rounded-xl border-2 p-4 ${
                      URGENCY_STYLES[urgency(minutes)]
                    }`}
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate text-3xl font-bold leading-none"
                        title={order.tableName}
                      >
                        {order.tableName}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {order.waiterName ?? 'ohne Name'}
                      </p>
                    </div>

                    <div>
                      <ul className="space-y-1">
                        {order.items.map(item => (
                          <li key={item.id} className="text-lg leading-snug">
                            <span className="font-bold tabular-nums">
                              {item.quantity}×
                            </span>{' '}
                            {item.productName}
                            {item.options.length > 0 && (
                              <span className="text-muted-foreground">
                                {' — '}
                                {item.options.map(o => o.optionName).join(', ')}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {order.note && (
                        <p className="mt-2 text-base italic">{order.note}</p>
                      )}
                    </div>

                    <div className="text-center">
                      <p className="text-2xl font-bold tabular-nums">
                        {formatWait(order.waitSeconds)}
                      </p>
                      <p className="text-xs text-muted-foreground">Wartezeit</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        className="h-20 flex-1 text-xl font-semibold"
                        disabled={busy(order.id)}
                        onClick={() =>
                          setStatus.mutate({
                            token,
                            orderId: order.id,
                            status: 'ready',
                          })
                        }
                      >
                        <Check className="mr-2 h-7 w-7" />
                        Bereit
                      </Button>
                      <Button
                        variant="outline"
                        className="h-20 w-20 shrink-0 text-destructive hover:text-destructive"
                        disabled={busy(order.id)}
                        onClick={() => setCancelId(order.id)}
                        aria-label={`Bestellung für Tisch ${order.tableName} stornieren`}
                      >
                        <Trash2 className="h-6 w-6" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-success">
            Wartet auf Abholung
          </h2>
          {ready.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nichts wartet auf Abholung.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {ready.map(order => (
                <div
                  key={order.id}
                  className="rounded-xl border-2 border-success bg-success/10 p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className="min-w-0 truncate text-2xl font-bold"
                      title={order.tableName}
                    >
                      {order.tableName}
                    </p>
                    <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatChf(order.totalRappen)}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                    {order.items.map(item => (
                      <li key={item.id}>
                        {item.quantity}× {item.productName}
                        {item.options.length > 0 &&
                          ` — ${item.options.map(o => o.optionName).join(', ')}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Nachschlagen, was schon durch ist — ohne Polling, damit die
            Arbeitsliste oben die einzige ist, die sich dauernd bewegt. */}
        <section className="space-y-3 border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setShowClosed(v => !v)}
          >
            <History className="mr-2 h-4 w-4" />
            {showClosed
              ? 'Abgeschlossene ausblenden'
              : 'Abgeschlossene anzeigen'}
          </Button>

          {showClosed &&
            (closedOrders.isLoading ? (
              <p className="text-sm text-muted-foreground">Lädt …</p>
            ) : (closedOrders.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch nichts abgeschlossen.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {(closedOrders.data ?? []).map(order => (
                  <li
                    key={order.id}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="min-w-0 truncate font-medium"
                        title={order.tableName}
                      >
                        {order.tableName}
                        {order.status === 'cancelled' && (
                          <span className="ml-2 text-xs text-destructive">
                            storniert
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatWait(order.readySeconds)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {order.items
                        .map(i => `${i.quantity}× ${i.productName}`)
                        .join(', ')}
                    </p>
                  </li>
                ))}
              </ul>
            ))}
        </section>
      </main>

      {/* Auch am Tablet bestätigen: ein Streifschuss auf den Storno-Knopf
          würde die Bestellung sonst wortlos aus dem Service entfernen. */}
      <AlertDialog
        open={cancelId != null}
        onOpenChange={open => !open && setCancelId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestellung stornieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Bestellung verschwindet aus Küche und Service und zählt nicht
              zum Umsatz. Rückgängig machen geht nicht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelId != null) {
                  setStatus.mutate({
                    token,
                    orderId: cancelId,
                    status: 'cancelled',
                  });
                }
                setCancelId(null);
              }}
            >
              Stornieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
