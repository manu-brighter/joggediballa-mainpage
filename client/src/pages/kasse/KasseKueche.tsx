import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatChf, minutesSince, urgency } from '@/lib/kasse';
import { Check, Loader2, Utensils } from 'lucide-react';

/** Farbcodierung der Wartezeit — die Küche sieht sofort, was liegen bleibt. */
const URGENCY_STYLES = {
  normal: 'border-pending/50 bg-pending/10',
  urgent: 'border-pending bg-pending/20',
  overdue: 'border-destructive bg-destructive/15',
} as const;

export default function KasseKueche() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? '';

  // Eigener Tick, damit die Wartezeit auch ohne Refetch weiterläuft.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(id);
  }, []);

  const state = trpc.kasse.publicState.useQuery(
    { token },
    { refetchInterval: 30000 },
  );
  const orders = trpc.kasse.listOpenOrders.useQuery(
    { token },
    { enabled: state.data?.valid === true, refetchInterval: 3000 },
  );

  const utils = trpc.useUtils();
  const setStatus = trpc.kasse.setOrderStatus.useMutation({
    onSuccess: () => utils.kasse.listOpenOrders.invalidate(),
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
            Zu erledigen — älteste zuoberst
          </h2>

          {pending.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Keine offenen Bestellungen.
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map(order => {
                const minutes = minutesSince(order.createdAt, now);
                return (
                  <article
                    key={order.id}
                    className={`grid grid-cols-[8rem_1fr_7rem_14rem] items-center gap-6 rounded-xl border-2 p-4 ${
                      URGENCY_STYLES[urgency(minutes)]
                    }`}
                  >
                    <div>
                      <p className="text-3xl font-bold leading-none">
                        {order.tableName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.waiterName ?? '—'}
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
                            {item.optionName && (
                              <span className="text-muted-foreground">
                                {' '}
                                — {item.optionName}
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
                        {minutes}′
                      </p>
                      <p className="text-xs text-muted-foreground">Wartezeit</p>
                    </div>

                    <Button
                      className="h-20 w-full text-xl font-semibold"
                      disabled={
                        setStatus.isPending &&
                        setStatus.variables?.orderId === order.id
                      }
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
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-success">
            Bereit — wartet auf Abholung
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
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-bold">{order.tableName}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatChf(order.totalRappen)}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                    {order.items.map(item => (
                      <li key={item.id}>
                        {item.quantity}× {item.productName}
                        {item.optionName ? ` — ${item.optionName}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
