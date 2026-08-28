import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatChf, formatWait } from '@/lib/kasse';
import {
  Check,
  ClipboardList,
  ConciergeBell,
  History,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';

const WAITER_NAME_KEY = 'kasse.waiterName';

/** Wie viele Zusätze als Pill unter dem Produkt stehen, bevor „+n" übernimmt. */
const OPTION_PILL_LIMIT = 3;

// Spiegel der Zod-Grenzen in server/kasse_router.ts (orderItemInput). Ohne sie
// scheitert erst die Mutation, und zwar an der Eingabevalidierung, die eine
// Zod-Fehlerliste statt eines deutschen Satzes zurückgibt und die *ganze*
// Bestellung ablehnt, nicht die eine Position.
const MAX_QUANTITY = 99;
const MAX_LINES = 40;
const MAX_OPTIONS_PER_LINE = 20;

type CartLine = {
  productId: number;
  optionIds: number[];
  quantity: number;
};

/** Gleiches Produkt mit gleicher Zusatz-Kombination ist dieselbe Position. */
const lineKey = (productId: number, optionIds: number[]) =>
  `${productId}:${[...optionIds].sort((a, b) => a - b).join('-') || 'none'}`;

export default function KasseService() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? '';

  const [tab, setTab] = useState<'order' | 'open'>('order');
  const [waiterName, setWaiterName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(WAITER_NAME_KEY) ?? '';
  });
  const [nameDraft, setNameDraft] = useState('');
  const [tableId, setTableId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState('');
  const [optionsFor, setOptionsFor] = useState<number | null>(null);
  const [draftOptionIds, setDraftOptionIds] = useState<number[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);
  // Kurzes Aufleuchten nach dem Antippen. Ohne das quittiert nur das
  // active:bg-accent des Browsers, was auf dem Handy unter dem Finger liegt
  // und beim Loslassen schon wieder weg ist.
  const [flashId, setFlashId] = useState<number | null>(null);

  const state = trpc.kasse.publicState.useQuery(
    { token },
    { refetchInterval: 20000 },
  );
  // Produkte/Tische ändern sich am Event selten, aber wenn der Admin etwas
  // anpasst, sollen die Handys es ohne Reload mitbekommen.
  const menu = trpc.kasse.menu.useQuery(
    { token },
    { enabled: state.data?.valid === true, refetchInterval: 60000 },
  );
  const openOrders = trpc.kasse.listOpenOrders.useQuery(
    { token },
    { enabled: state.data?.valid === true, refetchInterval: 5000 },
  );
  // Abgeschlossene bewusst ohne Polling. Die Liste ist ein Nachschlagewerk,
  // kein Arbeitsvorrat, und am Event werden das schnell ein paar hundert.
  const closedOrders = trpc.kasse.listClosedOrders.useQuery(
    { token, limit: 50 },
    { enabled: state.data?.valid === true && showClosed },
  );

  const utils = trpc.useUtils();
  const refreshOrders = () => utils.kasse.listOpenOrders.invalidate();

  const createOrder = trpc.kasse.createOrder.useMutation({
    onSuccess: () => {
      setCart([]);
      setNote('');
      setTableId(null);
      setCartOpen(false);
      refreshOrders();
      toast.success('Bestellung an die Küche geschickt.');
    },
    onError: e => toast.error(e.message),
  });
  const setStatus = trpc.kasse.setOrderStatus.useMutation({
    onSuccess: (_result, variables) => {
      refreshOrders();
      // Die abgeschlossenen Bestellungen sind eine eigene Abfrage, also nur
      // nachladen, wenn die Liste offen ist und der Wechsel überhaupt eine
      // dorthin verschiebt.
      if (
        showClosed &&
        (variables.status === 'delivered' || variables.status === 'cancelled')
      ) {
        utils.kasse.listClosedOrders.invalidate();
      }
    },
    onError: e => toast.error(e.message),
  });

  // Sobald eine Bestellung von der Küche auf „bereit" gesetzt wird, meldet sich
  // das Handy. Sonst müsste das Personal die Liste dauernd im Auge behalten.
  const seenReady = useRef<Set<number> | null>(null);
  useEffect(() => {
    const orders = openOrders.data;
    if (!orders) return;
    const ready = orders.filter(o => o.status === 'ready').map(o => o.id);
    if (seenReady.current === null) {
      seenReady.current = new Set(ready);
      return;
    }
    for (const order of orders) {
      if (order.status === 'ready' && !seenReady.current.has(order.id)) {
        toast.success(`Tisch ${order.tableName} ist bereit zum Abholen.`, {
          duration: 10000,
        });
      }
    }
    seenReady.current = new Set(ready);
  }, [openOrders.data]);

  const products = menu.data?.products ?? [];
  const tables = menu.data?.tables ?? [];

  const productById = useMemo(
    () => new Map(products.map(p => [p.id, p])),
    [products],
  );

  const categories = useMemo(() => {
    const groups = new Map<string, typeof products>();
    for (const product of products) {
      const key = product.category?.trim() || 'Weiteres';
      const list = groups.get(key);
      if (list) list.push(product);
      else groups.set(key, [product]);
    }
    return Array.from(groups.entries());
  }, [products]);

  const tableAreas = useMemo(() => {
    const groups = new Map<string, typeof tables>();
    for (const table of tables) {
      const key = table.area?.trim() || 'Tische';
      const list = groups.get(key);
      if (list) list.push(table);
      else groups.set(key, [table]);
    }
    return Array.from(groups.entries());
  }, [tables]);

  const cartLines = cart.map(line => {
    const product = productById.get(line.productId);
    const chosen = line.optionIds
      .map(id => product?.options.find(o => o.id === id))
      .filter((o): o is NonNullable<typeof o> => o != null);
    const unit =
      (product?.priceRappen ?? 0) +
      chosen.reduce((sum, o) => sum + o.priceDeltaRappen, 0);
    return {
      ...line,
      productName: product?.name ?? 'Unbekannt',
      optionNames: chosen.map(o => o.name),
      unitPriceRappen: unit,
      lineTotalRappen: unit * line.quantity,
    };
  });
  const cartTotal = cartLines.reduce((sum, l) => sum + l.lineTotalRappen, 0);
  const cartCount = cartLines.reduce((sum, l) => sum + l.quantity, 0);

  // Menge je Produkt über alle Zusatz-Kombinationen. Das Abzeichen bleibt
  // stehen und beantwortet die Frage „habe ich das jetzt getippt oder nicht"
  // auch dann noch, wenn das Aufleuchten längst vorbei ist.
  const quantityByProduct = new Map<number, number>();
  for (const line of cart) {
    quantityByProduct.set(
      line.productId,
      (quantityByProduct.get(line.productId) ?? 0) + line.quantity,
    );
  }

  const addToCart = (productId: number, optionIds: number[]) => {
    const key = lineKey(productId, optionIds);
    setCart(prev => {
      const idx = prev.findIndex(
        l => lineKey(l.productId, l.optionIds) === key,
      );
      if (idx === -1) {
        if (prev.length >= MAX_LINES) {
          toast.error(`Mehr als ${MAX_LINES} Positionen gehen nicht.`);
          return prev;
        }
        return [...prev, { productId, optionIds, quantity: 1 }];
      }
      const next = [...prev];
      const quantity = Math.min(MAX_QUANTITY, next[idx].quantity + 1);
      if (quantity === next[idx].quantity) {
        toast.error(`Mehr als ${MAX_QUANTITY} pro Position gehen nicht.`);
        return prev;
      }
      next[idx] = { ...next[idx], quantity };
      return next;
    });
  };

  const changeQuantity = (key: string, delta: number) => {
    setCart(prev =>
      prev
        .map(l =>
          lineKey(l.productId, l.optionIds) === key
            ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + delta) }
            : l,
        )
        .filter(l => l.quantity > 0),
    );
  };

  const flashTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    };
  }, []);

  const flashProduct = (productId: number) => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setFlashId(productId);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 600);
  };

  const handleProductTap = (productId: number) => {
    const product = productById.get(productId);
    if (!product) return;
    if (product.options.length > 0) {
      setDraftOptionIds([]);
      setOptionsFor(productId);
      return;
    }
    addToCart(productId, []);
    flashProduct(productId);
  };

  const toggleDraftOption = (optionId: number) => {
    setDraftOptionIds(prev => {
      if (prev.includes(optionId)) return prev.filter(id => id !== optionId);
      if (prev.length >= MAX_OPTIONS_PER_LINE) {
        toast.error(`Mehr als ${MAX_OPTIONS_PER_LINE} Zusätze gehen nicht.`);
        return prev;
      }
      return [...prev, optionId];
    });
  };

  const submit = () => {
    if (tableId == null) {
      toast.error('Bitte zuerst einen Tisch wählen.');
      return;
    }
    if (cart.length === 0) {
      toast.error('Die Bestellung ist leer.');
      return;
    }
    createOrder.mutate({
      token,
      tableId,
      waiterName: waiterName || undefined,
      note: note.trim() || undefined,
      items: cart.map(l => ({
        productId: l.productId,
        optionIds: l.optionIds,
        quantity: l.quantity,
      })),
    });
  };

  // ---- Zugriff / Zustand ----

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

  if (!waiterName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <SEO title="Kassen-Service" noIndex />
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Wer bist du?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Der Name erscheint auf deinen Bestellungen, damit die Küche weiss,
              wer sie aufgenommen hat. Er wird nur auf diesem Gerät gespeichert.
            </p>
            <div className="space-y-2">
              <Label htmlFor="kasse-waiter-name">Name</Label>
              <Input
                id="kasse-waiter-name"
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                placeholder="z. B. Manuel"
                maxLength={60}
              />
            </div>
            <Button
              className="w-full"
              disabled={!nameDraft.trim()}
              onClick={() => {
                const name = nameDraft.trim();
                window.localStorage.setItem(WAITER_NAME_KEY, name);
                setWaiterName(name);
              }}
            >
              Weiter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = state.data.session;
  // Der Admin-Schalter verspricht „Service kann keine neuen Bestellungen mehr
  // senden". Ohne diese Auswertung merkte das Handy davon nichts und lief
  // erst beim Senden in eine rote Fehlermeldung, mit fertig getippter
  // Bestellung. Gleiches gilt, wenn gar keine Kasse offen ist.
  const canSend = state.data.ordersOpen && session != null;
  const orders = openOrders.data ?? [];
  const readyOrders = orders.filter(o => o.status === 'ready');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const optionProduct =
    optionsFor != null ? (productById.get(optionsFor) ?? null) : null;

  const draftUnitPrice = optionProduct
    ? optionProduct.priceRappen +
      optionProduct.options
        .filter(o => draftOptionIds.includes(o.id))
        .reduce((sum, o) => sum + o.priceDeltaRappen, 0)
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <SEO title="Kassen-Service" noIndex />

      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ConciergeBell className="h-6 w-6 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight">Service</h1>
              <p className="truncate text-xs text-muted-foreground">
                {session?.name ?? 'Keine offene Kasse'}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            {waiterName}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant={tab === 'order' ? 'default' : 'outline'}
            onClick={() => setTab('order')}
            className="h-11"
          >
            <UtensilsCrossed className="mr-2 h-4 w-4" />
            Bestellen
          </Button>
          <Button
            variant={tab === 'open' ? 'default' : 'outline'}
            onClick={() => setTab('open')}
            className="h-11"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Offen
            {/* Bereit und in der Küche getrennt: auf dem Handy soll man ohne
                Umschalten sehen, ob etwas zum Abholen bereitsteht. */}
            {readyOrders.length > 0 && (
              <span className="ml-2 rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground">
                {readyOrders.length} bereit
              </span>
            )}
            {pendingOrders.length > 0 && (
              <span className="ml-1 rounded-full bg-pending px-2 py-0.5 text-xs font-semibold text-pending-foreground">
                {pendingOrders.length}
              </span>
            )}
          </Button>
        </div>
      </header>

      {!session ? (
        <div className="m-4 rounded-lg border border-pending/40 bg-pending/10 p-4 text-sm">
          Aktuell ist keine Kasse offen. Ein Admin muss im Kassen-Admin zuerst
          ein Event öffnen.
        </div>
      ) : (
        !state.data.ordersOpen && (
          <div className="m-4 rounded-lg border border-pending/40 bg-pending/10 p-4 text-sm">
            Die Bestellannahme ist geschlossen. Offene Bestellungen lassen sich
            noch abschliessen, neue nimmt die Küche nicht mehr an.
          </div>
        )
      )}

      {tab === 'order' ? (
        <main className="flex-1 space-y-6 p-4">
          {/* Produkte zuerst, der Griff zum Tisch kommt beim Abschicken. */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Produkte
            </h2>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Produkte erfasst.
              </p>
            ) : (
              categories.map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <p className="text-xs text-muted-foreground">{category}</p>
                  <div className="grid gap-2">
                    {items.map(product => {
                      const shown = product.options.slice(0, OPTION_PILL_LIMIT);
                      const hidden =
                        product.options.length - shown.length > 0
                          ? product.options.length - shown.length
                          : 0;
                      const inCart = quantityByProduct.get(product.id) ?? 0;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleProductTap(product.id)}
                          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-150 active:bg-accent ${
                            flashId === product.id
                              ? 'border-success bg-success/15 scale-[0.98]'
                              : 'border-border'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {product.name}
                            </span>
                            {product.options.length > 0 && (
                              <span className="mt-1 flex flex-wrap items-center gap-1">
                                {shown.map(option => (
                                  <span
                                    key={option.id}
                                    className="max-w-[9rem] truncate rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                                  >
                                    {option.name}
                                  </span>
                                ))}
                                {hidden > 0 && (
                                  <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                                    +{hidden}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                          <span className="ml-3 flex shrink-0 items-center gap-2">
                            {inCart > 0 && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground">
                                {inCart}×
                              </span>
                            )}
                            <span className="tabular-nums text-sm text-muted-foreground">
                              {formatChf(product.priceRappen)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Tisch und Notiz nebeneinander: die Notiz gehört zur Bestellung,
              nicht zum zuletzt angetippten Produkt. Direkt unter der
              Produktliste las sie sich wie ein weiterer Zusatz. */}
          <div className="grid gap-6 sm:grid-cols-2">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Tisch
              </h2>
              {tables.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Tische erfasst.
                </p>
              ) : (
                tableAreas.map(([area, areaTables]) => (
                  <div key={area} className="space-y-2">
                    <p className="text-xs text-muted-foreground">{area}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {areaTables.map(table => (
                        <Button
                          key={table.id}
                          variant={tableId === table.id ? 'default' : 'outline'}
                          className="h-12 px-2 text-base font-semibold"
                          onClick={() => setTableId(table.id)}
                          title={table.name}
                        >
                          <span className="truncate">{table.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Notiz
              </h2>
              <div className="rounded-lg border p-3">
                <Label htmlFor="kasse-note" className="text-xs">
                  Gilt für die ganze Bestellung (optional)
                </Label>
                <Input
                  id="kasse-note"
                  className="mt-2"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="z. B. eine Pommes ohne Salz"
                  maxLength={255}
                />
              </div>
            </section>
          </div>
        </main>
      ) : (
        <main className="flex-1 space-y-6 p-4">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-success">
              Bereit zum Abholen ({readyOrders.length})
            </h2>
            {readyOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nichts bereit im Moment.
              </p>
            ) : (
              readyOrders.map(order => (
                <div
                  key={order.id}
                  className="rounded-lg border-2 border-success bg-success/10 p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className="min-w-0 truncate text-xl font-bold"
                      title={order.tableName}
                    >
                      Tisch {order.tableName}
                    </p>
                    <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatChf(order.totalRappen)}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {order.items.map(item => (
                      <li key={item.id}>
                        {item.quantity}× {item.productName}
                        {item.options.length > 0 && (
                          <span className="text-muted-foreground">
                            {', '}
                            {item.options.map(o => o.optionName).join(', ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {order.note && (
                    <p className="mt-2 text-sm italic text-muted-foreground">
                      {order.note}
                    </p>
                  )}
                  <Button
                    className="mt-3 h-12 w-full text-base"
                    disabled={
                      setStatus.isPending &&
                      setStatus.variables?.orderId === order.id
                    }
                    onClick={() =>
                      setStatus.mutate({
                        token,
                        orderId: order.id,
                        status: 'delivered',
                      })
                    }
                  >
                    <Check className="mr-2 h-5 w-5" />
                    Serviert, abschliessen
                  </Button>
                </div>
              ))
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              In der Küche ({pendingOrders.length})
            </h2>
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine offenen Bestellungen.
              </p>
            ) : (
              pendingOrders.map(order => (
                <div
                  key={order.id}
                  className="rounded-lg border border-pending/50 bg-pending/5 p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className="min-w-0 truncate text-lg font-semibold"
                      title={order.tableName}
                    >
                      Tisch {order.tableName}
                    </p>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      seit {formatWait(order.waitSeconds)} ·{' '}
                      {order.waiterName ?? 'ohne Name'}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                    {order.items.map(item => (
                      <li key={item.id}>
                        {item.quantity}× {item.productName}
                        {item.options.length > 0 &&
                          `, ${item.options.map(o => o.optionName).join(', ')}`}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-destructive hover:text-destructive"
                    disabled={
                      setStatus.isPending &&
                      setStatus.variables?.orderId === order.id
                    }
                    onClick={() => setCancelId(order.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Stornieren
                  </Button>
                </div>
              ))
            )}
          </section>

          {/* Abgeschlossenes ist zum Nachschauen da, nicht zum Arbeiten,
              darum eingeklappt und ohne Polling. */}
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
                <ul className="space-y-2">
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
                          Tisch {order.tableName}
                          {order.status === 'cancelled' && (
                            <span className="ml-2 text-xs text-destructive">
                              storniert
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {formatChf(order.totalRappen)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {order.items
                          .map(i => `${i.quantity}× ${i.productName}`)
                          .join(', ')}
                        {order.deliveredSeconds != null &&
                          ` · ${formatWait(order.deliveredSeconds)} Wartezeit`}
                      </p>
                    </li>
                  ))}
                </ul>
              ))}
          </section>
        </main>
      )}

      {/* Warenkorb-Leiste */}
      {tab === 'order' && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-12 flex-1"
              onClick={() => setCartOpen(true)}
              disabled={cartCount === 0}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {cartCount} Pos. · {formatChf(cartTotal)}
            </Button>
            <Button
              className="h-12 flex-1 text-base"
              onClick={submit}
              disabled={
                createOrder.isPending ||
                cartCount === 0 ||
                tableId == null ||
                !canSend
              }
            >
              {createOrder.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Senden
            </Button>
          </div>
        </div>
      )}

      {/* Zusatz-Auswahl, mehrere gleichzeitig möglich (Senf *und* Mayo). */}
      <Sheet
        open={optionProduct != null}
        onOpenChange={open => {
          if (!open) {
            setOptionsFor(null);
            setDraftOptionIds([]);
          }
        }}
      >
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{optionProduct?.name}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 p-4">
            <p className="text-xs text-muted-foreground">
              Mehrfachauswahl möglich. Ohne Auswahl gilt der Produktpreis.
            </p>
            {optionProduct?.options.map(option => {
              const active = draftOptionIds.includes(option.id);
              return (
                <Button
                  key={option.id}
                  variant={active ? 'default' : 'outline'}
                  className="h-12 justify-between text-base"
                  onClick={() => toggleDraftOption(option.id)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {active && <Check className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{option.name}</span>
                  </span>
                  {option.priceDeltaRappen !== 0 && (
                    <span className="shrink-0 text-sm tabular-nums opacity-80">
                      {option.priceDeltaRappen > 0 ? '+' : '−'}
                      {formatChf(Math.abs(option.priceDeltaRappen))}
                    </span>
                  )}
                </Button>
              );
            })}
            <Button
              className="mt-2 h-12 text-base"
              onClick={() => {
                if (optionProduct) addToCart(optionProduct.id, draftOptionIds);
                setOptionsFor(null);
                setDraftOptionIds([]);
              }}
            >
              Hinzufügen · {formatChf(draftUnitPrice)}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Warenkorb */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Bestellung</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 p-4">
            {cartLines.map(line => {
              const key = lineKey(line.productId, line.optionIds);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{line.productName}</p>
                    {line.optionNames.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {line.optionNames.join(', ')}
                      </p>
                    )}
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatChf(line.lineTotalRappen)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => changeQuantity(key, -1)}
                      aria-label="Weniger"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => changeQuantity(key, 1)}
                      disabled={line.quantity >= MAX_QUANTITY}
                      aria-label="Mehr"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t pt-3 text-lg font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatChf(cartTotal)}</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Storno bestätigen. Ein Fehlgriff auf dem Handy soll die Küche nicht
          um eine Bestellung bringen. */}
      <AlertDialog
        open={cancelId != null}
        onOpenChange={open => !open && setCancelId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestellung stornieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Bestellung verschwindet aus der Küche und zählt nicht zum
              Umsatz. Rückgängig machen geht nicht.
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
