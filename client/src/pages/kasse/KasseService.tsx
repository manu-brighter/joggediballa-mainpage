import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatChf, minutesSince } from '@/lib/kasse';
import {
  Check,
  ClipboardList,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';

const WAITER_NAME_KEY = 'kasse.waiterName';

type CartLine = {
  productId: number;
  optionId: number | null;
  quantity: number;
};

const lineKey = (productId: number, optionId: number | null) =>
  `${productId}:${optionId ?? 'none'}`;

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
  const [cartOpen, setCartOpen] = useState(false);

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
    onSuccess: () => refreshOrders(),
    onError: e => toast.error(e.message),
  });

  // Sobald eine Bestellung von der Küche auf „bereit" gesetzt wird, meldet sich
  // das Handy — sonst müsste das Personal die Liste dauernd im Auge behalten.
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
    const option =
      line.optionId != null
        ? (product?.options.find(o => o.id === line.optionId) ?? null)
        : null;
    const unit = (product?.priceRappen ?? 0) + (option?.priceDeltaRappen ?? 0);
    return {
      ...line,
      productName: product?.name ?? 'Unbekannt',
      optionName: option?.name ?? null,
      unitPriceRappen: unit,
      lineTotalRappen: unit * line.quantity,
    };
  });
  const cartTotal = cartLines.reduce((sum, l) => sum + l.lineTotalRappen, 0);
  const cartCount = cartLines.reduce((sum, l) => sum + l.quantity, 0);

  const addToCart = (productId: number, optionId: number | null) => {
    setCart(prev => {
      const idx = prev.findIndex(
        l => l.productId === productId && l.optionId === optionId,
      );
      if (idx === -1) return [...prev, { productId, optionId, quantity: 1 }];
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
      return next;
    });
  };

  const changeQuantity = (key: string, delta: number) => {
    setCart(prev =>
      prev
        .map(l =>
          lineKey(l.productId, l.optionId) === key
            ? { ...l, quantity: l.quantity + delta }
            : l,
        )
        .filter(l => l.quantity > 0),
    );
  };

  const handleProductTap = (productId: number) => {
    const product = productById.get(productId);
    if (!product) return;
    if (product.options.length > 0) {
      setOptionsFor(productId);
      return;
    }
    addToCart(productId, null);
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
        optionId: l.optionId,
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
        <SEO title="Kasse — Service" noIndex />
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
                autoFocus
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
              Los geht's
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = state.data.session;
  const orders = openOrders.data ?? [];
  const readyOrders = orders.filter(o => o.status === 'ready');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const optionProduct =
    optionsFor != null ? (productById.get(optionsFor) ?? null) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <SEO title="Kasse — Service" noIndex />

      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Service</p>
            <h1 className="truncate text-base font-semibold">
              {session?.name ?? 'Keine offene Kasse'}
            </h1>
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
            {orders.length > 0 && (
              <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-xs">
                {orders.length}
              </span>
            )}
          </Button>
        </div>
      </header>

      {!session && (
        <div className="m-4 rounded-lg border border-pending/40 bg-pending/10 p-4 text-sm">
          Aktuell ist keine Kasse offen. Ein Admin muss im Kassen-Admin zuerst
          ein Event öffnen.
        </div>
      )}

      {tab === 'order' ? (
        <main className="flex-1 space-y-6 p-4">
          {/* Tischauswahl */}
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
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
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

          {/* Produkte */}
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
                    {items.map(product => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductTap(product.id)}
                        className="flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors active:bg-accent"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {product.name}
                          </span>
                          {product.options.length > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              {product.options.length} Zusätze
                            </span>
                          )}
                        </span>
                        <span className="ml-3 shrink-0 tabular-nums text-sm text-muted-foreground">
                          {formatChf(product.priceRappen)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="space-y-2">
            <Label htmlFor="kasse-note">Notiz (optional)</Label>
            <Input
              id="kasse-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="z. B. eine Pommes ohne Salz"
              maxLength={255}
            />
          </section>
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
                        {item.optionName ? ` — ${item.optionName}` : ''}
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
                    Serviert — abschliessen
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
                      seit {minutesSince(order.createdAt, Date.now())} Min ·{' '}
                      {order.waiterName ?? '—'}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-destructive hover:text-destructive"
                    disabled={
                      setStatus.isPending &&
                      setStatus.variables?.orderId === order.id
                    }
                    onClick={() =>
                      setStatus.mutate({
                        token,
                        orderId: order.id,
                        status: 'cancelled',
                      })
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Stornieren
                  </Button>
                </div>
              ))
            )}
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
                createOrder.isPending || cartCount === 0 || tableId == null
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

      {/* Zusatz-Auswahl */}
      <Sheet
        open={optionProduct != null}
        onOpenChange={open => !open && setOptionsFor(null)}
      >
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{optionProduct?.name}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 p-4">
            {optionProduct?.options.map(option => (
              <Button
                key={option.id}
                variant="outline"
                className="h-12 justify-between text-base"
                onClick={() => {
                  addToCart(optionProduct.id, option.id);
                  setOptionsFor(null);
                }}
              >
                <span>{option.name}</span>
                {option.priceDeltaRappen !== 0 && (
                  <span className="text-sm text-muted-foreground">
                    {option.priceDeltaRappen > 0 ? '+' : '−'}
                    {formatChf(Math.abs(option.priceDeltaRappen))}
                  </span>
                )}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="h-12 text-base"
              onClick={() => {
                if (optionProduct) addToCart(optionProduct.id, null);
                setOptionsFor(null);
              }}
            >
              Ohne Zusatz
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
              const key = lineKey(line.productId, line.optionId);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{line.productName}</p>
                    {line.optionName && (
                      <p className="text-xs text-muted-foreground">
                        {line.optionName}
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
    </div>
  );
}
