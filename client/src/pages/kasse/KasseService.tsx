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
  User,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';

const WAITER_NAME_KEY = 'kasse.waiterName';
/**
 * „Meine“ oder „Alle“ Bestellungen in der Offen-Ansicht. Geräte-Einstellung
 * wie der Name: an einem Event mit mehreren Servicekräften interessiert
 * normalerweise nur, was man selbst aufgenommen hat.
 */
const ORDER_SCOPE_KEY = 'kasse.orderScope';

type OrderScope = 'mine' | 'all';

/** Wie viele Zusätze als Pill unter dem Produkt stehen, bevor „+n“ übernimmt. */
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

/**
 * Vergleichsform eines Servicenamens. Der Name wird auf jedem Gerät von Hand
 * eingetippt, „Anna“ und „anna“ sind dieselbe Person — sonst fiele die halbe
 * eigene Liste unter „Alle“.
 */
const normalizeWaiter = (name: string | null | undefined) =>
  (name ?? '').trim().toLocaleLowerCase('de-CH');

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
  // Namen ändern: das Feld ersetzt das Abzeichen im Kopf an Ort und Stelle.
  const [editingName, setEditingName] = useState(false);
  const [scope, setScope] = useState<OrderScope>(() => {
    if (typeof window === 'undefined') return 'mine';
    return window.localStorage.getItem(ORDER_SCOPE_KEY) === 'all'
      ? 'all'
      : 'mine';
  });
  // Aufleuchten nach dem Antippen. Ohne das quittiert nur das
  // active:bg-accent des Browsers, was auf dem Handy unter dem Finger liegt
  // und beim Loslassen schon wieder weg ist.
  const [flashId, setFlashId] = useState<number | null>(null);

  const saveWaiterName = (name: string) => {
    setWaiterName(name);
    try {
      window.localStorage.setItem(WAITER_NAME_KEY, name);
    } catch {
      // Privater Modus o. ä.: der Name gilt dann nur für diese Sitzung.
    }
  };

  /**
   * Namen übernehmen. Der Name hängt an jeder Bestellung, die dieses Gerät
   * absetzt, und entscheidet unter „Meine“, was in der Liste steht — darum
   * nicht still tauschen, sondern sagen, was zurückbleibt.
   */
  const commitName = () => {
    const name = nameDraft.trim();
    if (!name) return;
    const previous = waiterName;
    saveWaiterName(name);
    setEditingName(false);
    if (normalizeWaiter(previous) === normalizeWaiter(name)) return;
    const stranded = (openOrders.data ?? []).filter(
      o => normalizeWaiter(o.waiterName) === normalizeWaiter(previous),
    ).length;
    if (stranded > 0) {
      toast.info(
        `${stranded} offene Bestellung(en) laufen weiter unter „${previous}“.`,
      );
    }
  };

  const setOrderScope = (next: OrderScope) => {
    setScope(next);
    try {
      window.localStorage.setItem(ORDER_SCOPE_KEY, next);
    } catch {
      // Privater Modus o. ä.: die Wahl gilt dann nur für diese Sitzung.
    }
  };

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
      toast.success('Bestellung abgeschickt.');
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

  /** Ob eine Bestellung im gewählten Umfang liegt („Meine“ oder „Alle“). */
  const inScope = (order: { waiterName: string | null }) =>
    scope === 'all' ||
    normalizeWaiter(order.waiterName) === normalizeWaiter(waiterName);

  // Sobald eine Bestellung von der Küche auf „bereit“ gesetzt wird, meldet sich
  // das Handy. Sonst müsste das Personal die Liste dauernd im Auge behalten.
  const seenReady = useRef<Set<number> | null>(null);
  useEffect(() => {
    const orders = openOrders.data;
    if (!orders) return;
    // Gemerkt wird über *alle* Bestellungen, gemeldet nur über die im
    // gewählten Umfang. Sonst gälte eine Bestellung nach dem Umschalten auf
    // „Alle“ als neu und meldete sich ein zweites Mal.
    const ready = orders.filter(o => o.status === 'ready').map(o => o.id);
    if (seenReady.current === null) {
      seenReady.current = new Set(ready);
      return;
    }
    const me = normalizeWaiter(waiterName);
    for (const order of orders) {
      const mine = normalizeWaiter(order.waiterName) === me;
      if (
        order.status === 'ready' &&
        !seenReady.current.has(order.id) &&
        (scope === 'all' || mine)
      ) {
        toast.success(`Tisch ${order.tableName} ist bereit zum Abholen.`, {
          duration: 10000,
        });
      }
    }
    seenReady.current = new Set(ready);
  }, [openOrders.data, scope, waiterName]);

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
  // stehen und beantwortet die Frage „habe ich das jetzt getippt oder nicht“
  // auch dann noch, wenn das Aufleuchten längst vorbei ist.
  const quantityByProduct = useMemo(() => {
    const map = new Map<number, number>();
    for (const line of cart) {
      map.set(line.productId, (map.get(line.productId) ?? 0) + line.quantity);
    }
    return map;
  }, [cart]);

  /**
   * Ob ein weiterer Tipp überhaupt im Warenkorb landet. addToCart lehnt an den
   * Grenzen ab und meldet das per Toast; ohne diese Vorabprüfung leuchtete die
   * Zeile trotzdem grün auf und widerspräche der roten Meldung.
   */
  const canAddToCart = (productId: number, optionIds: number[]) => {
    const key = lineKey(productId, optionIds);
    const line = cart.find(l => lineKey(l.productId, l.optionIds) === key);
    if (!line) return cart.length < MAX_LINES;
    return line.quantity < MAX_QUANTITY;
  };

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
  const flashFrame = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      if (flashFrame.current !== null)
        window.cancelAnimationFrame(flashFrame.current);
    };
  }, []);

  /**
   * Zweimal dasselbe Produkt hintereinander ist der häufigste Fall überhaupt
   * (drei Bier). Dieselbe ID nochmals zu setzen ändert die Klassenliste nicht,
   * und eine CSS-Animation startet nur neu, wenn sich der animation-name
   * ändert oder das Element neu eingehängt wird. Darum erst abräumen und im
   * nächsten Frame neu setzen, damit die Klasse wirklich weg war.
   */
  const flashProduct = (productId: number) => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    if (flashFrame.current !== null)
      window.cancelAnimationFrame(flashFrame.current);

    setFlashId(null);
    flashFrame.current = window.requestAnimationFrame(() => {
      flashFrame.current = null;
      setFlashId(productId);
      flashTimer.current = window.setTimeout(() => setFlashId(null), 700);
    });
  };

  const handleProductTap = (productId: number) => {
    const product = productById.get(productId);
    if (!product) return;
    if (product.options.length > 0) {
      setDraftOptionIds([]);
      setOptionsFor(productId);
      return;
    }
    const accepted = canAddToCart(productId, []);
    addToCart(productId, []);
    if (accepted) flashProduct(productId);
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
            <CardTitle>Name</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Kein sichtbares Label mehr: der Kartentitel sagt es bereits.
                aria-label hält das Feld trotzdem beschriftet, weil der Titel
                nicht programmatisch damit verknüpft ist. */}
            <Input
              aria-label="Name"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              maxLength={60}
            />
            <Button
              className="w-full"
              disabled={!nameDraft.trim()}
              onClick={() => saveWaiterName(nameDraft.trim())}
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
  // senden“. Ohne diese Auswertung merkte das Handy davon nichts und lief
  // erst beim Senden in eine rote Fehlermeldung, mit fertig getippter
  // Bestellung. Gleiches gilt, wenn gar keine Kasse offen ist.
  const canSend = state.data.ordersOpen && session != null;
  const orders = (openOrders.data ?? []).filter(inScope);
  const readyOrders = orders.filter(o => o.status === 'ready');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const closed = (closedOrders.data ?? []).filter(inScope);
  // Wie viele Bestellungen die Ansicht gerade ausblendet. Ohne den Hinweis
  // wirkt eine leere Liste wie „nichts offen“, obwohl der Filter greift.
  const hiddenOpenCount =
    scope === 'mine' ? (openOrders.data ?? []).length - orders.length : 0;
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
        {/* Der Name lässt sich ändern, ohne dass ein Knopf dafür dauerhaft
            Platz wegnimmt: das Abzeichen selbst ist der Auslöser und wird an
            Ort und Stelle zum Feld. Beim Tippen gehört die Zeile ganz dem
            Feld — auf einem 320px-Gerät liefen Titel und Feld sonst
            ineinander, und der Kassenname interessiert für die drei Sekunden
            ohnehin nicht. */}
        <div className="flex items-center justify-between gap-3">
          {editingName ? (
            <div className="flex w-full items-center gap-2">
              <Input
                // Fokus direkt: das Feld erscheint auf Antippen und ist das
                // einzige Ziel. Ohne autoFocus müsste man am Handy ein zweites
                // Mal tippen, nur um die Tastatur zu bekommen.
                autoFocus
                aria-label="Name ändern"
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                maxLength={60}
                className="h-10 min-w-0 flex-1"
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                disabled={!nameDraft.trim()}
                onClick={commitName}
                aria-label="Name speichern"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => setEditingName(false)}
                aria-label="Namensänderung abbrechen"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <ConciergeBell className="h-6 w-6 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold leading-tight">
                    Service
                  </h1>
                  <p className="truncate text-xs text-muted-foreground">
                    {session?.name ?? 'Keine offene Kasse'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNameDraft(waiterName);
                  setEditingName(true);
                }}
                className="max-w-[10rem] shrink-0 truncate rounded-full border px-3 py-1 text-xs text-muted-foreground"
                title="Name ändern"
              >
                {waiterName}
              </button>
            </>
          )}
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
                      // Beim Antippen färbt sich die ganze Zeile satt in der
                      // Bestätigungsfarbe und stösst kurz an. Ein getönter
                      // Hintergrund allein ging am Event unter, darum
                      // Vollfläche, Häkchen und Bewegung zusammen.
                      const flashing = flashId === product.id;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleProductTap(product.id)}
                          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-[background-color,border-color,color,box-shadow,opacity] duration-200 active:bg-accent ${
                            flashing
                              ? 'kasse-tap-flash border-success bg-success text-success-foreground shadow-lg'
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
                                    className={`max-w-[9rem] truncate rounded-full border px-2 py-0.5 text-xs ${
                                      flashing
                                        ? 'border-success-foreground/40'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {option.name}
                                  </span>
                                ))}
                                {hidden > 0 && (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-xs ${
                                      flashing
                                        ? 'border-success-foreground/40'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    +{hidden}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                          <span className="ml-3 flex shrink-0 items-center gap-2">
                            {/* Platz dauerhaft reserviert: ein eingehängtes
                                Icon schöbe Abzeichen und Preis zur Seite und
                                kürzte den Produktnamen für die Dauer der
                                Rückmeldung ab, genau unter dem Finger. */}
                            <Check
                              className={`h-5 w-5 shrink-0 ${
                                flashing ? 'opacity-100' : 'opacity-0'
                              }`}
                              aria-hidden="true"
                            />
                            {inCart > 0 && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                                  flashing
                                    ? 'bg-success-foreground text-success'
                                    : 'bg-primary text-primary-foreground'
                                }`}
                              >
                                {inCart}×
                                <span className="sr-only"> im Warenkorb</span>
                              </span>
                            )}
                            <span
                              className={`tabular-nums text-sm ${
                                flashing ? '' : 'text-muted-foreground'
                              }`}
                            >
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
          {/* Standardmässig nur die eigenen Bestellungen: an einem Event mit
              mehreren Servicekräften ist die gemeinsame Liste zu lang, um
              darin die eigenen drei Tische zu finden. „Alle“ bleibt einen
              Fingertipp entfernt, etwa wenn jemand einspringt. */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={scope === 'mine' ? 'default' : 'outline'}
              className="h-11"
              onClick={() => setOrderScope('mine')}
            >
              <User className="mr-2 h-4 w-4" />
              Meine
            </Button>
            <Button
              variant={scope === 'all' ? 'default' : 'outline'}
              className="h-11"
              onClick={() => setOrderScope('all')}
            >
              <Users className="mr-2 h-4 w-4" />
              Alle
            </Button>
          </div>
          {hiddenOpenCount > 0 && (
            <p className="-mt-3 text-xs text-muted-foreground">
              {hiddenOpenCount} Bestellung(en) von anderen sind ausgeblendet.
            </p>
          )}

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
                      <li key={item.id} className="break-words">
                        {item.quantity}× {item.productName}
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
                    <p className="mt-2 break-words text-sm italic text-muted-foreground">
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
                      <li key={item.id} className="break-words">
                        {item.quantity}× {item.productName}
                        {item.options.length > 0 &&
                          ` · ${item.options.map(o => o.optionName).join(', ')}`}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="ghost"
                    size="sm"
                    // dark:-Pendants nötig: die ghost-Variante setzt
                    // dark:hover:bg-accent/50, das sonst im Dark Mode gewinnt.
                    className="mt-2 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive dark:bg-destructive/10 dark:hover:bg-destructive/20"
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
              ) : closed.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {scope === 'mine'
                    ? 'Von dir ist noch nichts abgeschlossen.'
                    : 'Noch nichts abgeschlossen.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {closed.map(order => (
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
                if (optionProduct) {
                  const accepted = canAddToCart(
                    optionProduct.id,
                    draftOptionIds,
                  );
                  addToCart(optionProduct.id, draftOptionIds);
                  if (accepted) flashProduct(optionProduct.id);
                }
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
