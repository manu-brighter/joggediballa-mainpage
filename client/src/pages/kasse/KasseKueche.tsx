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

/** Farbcodierung der Wartezeit, damit die Küche sofort sieht, was liegen bleibt. */
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
  // Ausgeklappte Notizen. Standardmässig auf zwei Zeilen gekürzt, damit eine
  // ausschweifende Notiz die Karte nicht sprengt und der Rest der Liste
  // sichtbar bleibt. Antippen zeigt den vollen Text, denn in der Küche kann
  // genau dort das Entscheidende stehen.
  const [openNotes, setOpenNotes] = useState<Set<number>>(new Set());

  const toggleNote = (orderId: number) =>
    setOpenNotes(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });

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
      // im 3-Sekunden-Takt, und jede „Bereit“-Bestätigung hätte sonst eine
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
      <SEO title="Kassen-Küche" noIndex />

      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Utensils className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Küche</h1>
            <p className="truncate text-xs text-muted-foreground">
              {state.data.session?.name ?? 'Keine offene Kasse'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm sm:gap-6">
          <span>
            <span className="text-xl font-bold tabular-nums text-pending sm:text-2xl">
              {pending.length}
            </span>
            <span className="ml-1 text-muted-foreground sm:ml-2">offen</span>
          </span>
          <span>
            <span className="text-xl font-bold tabular-nums text-success sm:text-2xl">
              {ready.length}
            </span>
            <span className="ml-1 text-muted-foreground sm:ml-2">bereit</span>
          </span>
        </div>
      </header>

      <main className="space-y-8 p-4 xl:p-6">
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
                    className={`grid gap-3 rounded-xl border-2 p-3 xl:grid-cols-[8rem_1fr_7rem_17rem] xl:items-center xl:gap-6 xl:p-4 ${
                      URGENCY_STYLES[urgency(minutes)]
                    }`}
                  >
                    {/* Unter xl stehen Tisch und Wartezeit nebeneinander in
                        einer Kopfzeile; die feste Vierspalten-Aufteilung
                        (32rem allein für Tisch, Wartezeit und Knöpfe) liess
                        der Produktliste auf einem Hochkant-Tablet rund 150px
                        und blähte jede Bestellung über den ganzen Schirm. */}
                    <div className="flex items-baseline justify-between gap-3 xl:block">
                      <div className="min-w-0">
                        <p
                          className="truncate text-2xl font-bold leading-none xl:text-3xl"
                          title={order.tableName}
                        >
                          {order.tableName}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {order.waiterName ?? 'ohne Name'}
                        </p>
                      </div>
                      <p className="shrink-0 text-xl font-bold tabular-nums xl:hidden">
                        {formatWait(order.waitSeconds)}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <ul className="space-y-1">
                        {order.items.map(item => (
                          <li
                            key={item.id}
                            className="break-words text-base leading-snug xl:text-lg"
                          >
                            <span className="font-bold tabular-nums">
                              {item.quantity}×
                            </span>{' '}
                            {item.productName}
                            {item.options.length > 0 && (
                              <span className="text-muted-foreground">
                                {' · '}
                                {item.options.map(o => o.optionName).join(', ')}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {order.note && (
                        <button
                          type="button"
                          onClick={() => toggleNote(order.id)}
                          className="mt-2 block w-full text-left"
                          title={order.note}
                        >
                          {/* `block` und `line-clamp-2` setzen beide display;
                              nebeneinander gewinnt `block` und die Kürzung
                              greift nicht. Darum sich ausschliessend. */}
                          <span
                            className={`break-words text-sm italic xl:text-base ${
                              openNotes.has(order.id) ? 'block' : 'line-clamp-2'
                            }`}
                          >
                            {order.note}
                          </span>
                          <span className="text-xs text-muted-foreground underline">
                            {openNotes.has(order.id)
                              ? 'Notiz einklappen'
                              : 'Ganze Notiz'}
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="hidden text-center xl:block">
                      <p className="text-2xl font-bold tabular-nums">
                        {formatWait(order.waitSeconds)}
                      </p>
                      <p className="text-xs text-muted-foreground">Wartezeit</p>
                    </div>

                    <div className="flex min-w-0 items-center gap-2">
                      <Button
                        className="h-14 min-w-0 flex-1 text-base font-semibold xl:h-20 xl:text-xl"
                        disabled={busy(order.id)}
                        onClick={() =>
                          setStatus.mutate({
                            token,
                            orderId: order.id,
                            status: 'ready',
                          })
                        }
                      >
                        <Check className="mr-2 h-5 w-5 xl:h-7 xl:w-7" />
                        Bereit
                      </Button>
                      <Button
                        variant="outline"
                        className="h-14 w-14 shrink-0 text-destructive hover:text-destructive xl:h-20 xl:w-20"
                        disabled={busy(order.id)}
                        onClick={() => setCancelId(order.id)}
                        aria-label={`Bestellung für Tisch ${order.tableName} stornieren`}
                      >
                        <Trash2 className="h-5 w-5 xl:h-6 xl:w-6" />
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
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ready.map(order => (
                <div
                  key={order.id}
                  className="rounded-xl border-2 border-success bg-success/10 p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className="min-w-0 truncate text-xl font-bold xl:text-2xl"
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
                      <li key={item.id} className="break-words">
                        {item.quantity}× {item.productName}
                        {item.options.length > 0 &&
                          ` · ${item.options.map(o => o.optionName).join(', ')}`}
                      </li>
                    ))}
                  </ul>
                  {/* Holt der Service am Durchreichefenster ab, ohne sein Handy
                      zu zücken, bleibt die Bestellung sonst in der Abholliste
                      liegen. Derselbe Statuswechsel wie im Service. */}
                  <Button
                    variant="outline"
                    className="mt-3 h-12 w-full border-success text-base font-semibold"
                    disabled={busy(order.id)}
                    onClick={() =>
                      setStatus.mutate({
                        token,
                        orderId: order.id,
                        status: 'delivered',
                      })
                    }
                  >
                    <Check className="mr-2 h-5 w-5" />
                    Abgeholt
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Nachschlagen, was schon durch ist. Ohne Polling, damit die
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
