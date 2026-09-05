import { useMemo, useState } from 'react';
import { useParams } from 'wouter';
import type { LucideIcon } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  CATEGORY_FALLBACK,
  categoryKey,
  categoryLabel,
  formatChf,
  formatWait,
  matchesCategories,
  urgency,
  waitMinutes,
} from '@/lib/kasse';
import {
  Check,
  EyeOff,
  History,
  Loader2,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

/**
 * Ab welcher Länge eine Notiz überhaupt gekürzt werden kann. Eine Messung von
 * scrollHeight gegen clientHeight wäre exakt, bräuchte aber eine Ref und einen
 * ResizeObserver je Karte; bei zwei Zeilen à rund 40 Zeichen liegt die Grenze
 * praktisch hier. Kürzere Notizen zeigen den Aufklapp-Hinweis gar nicht erst.
 */
const NOTE_CLAMP_THRESHOLD = 80;

/** Farbcodierung der Wartezeit, damit die Station sofort sieht, was liegen bleibt. */
const URGENCY_STYLES = {
  normal: 'border-pending/50 bg-pending/10',
  urgent: 'border-pending bg-pending/20',
  overdue: 'border-destructive bg-destructive/15',
} as const;

export type StationConfig = {
  /** Unterscheidet die gespeicherten Filter der Geräte, siehe storageKey(). */
  id: 'kueche' | 'bar';
  /** Überschrift im Kopf, z. B. „Küche“. */
  title: string;
  /** Titel im Browser-Tab. */
  seoTitle: string;
  icon: LucideIcon;
};

/**
 * Der Kategorienfilter ist eine Geräte-Einstellung, keine Server-Einstellung:
 * das Tablet in der Küche zeigt Food, das an der Bar Drinks und Shots, beide
 * hängen am selben Token. Darum pro Station im localStorage, wie der Name des
 * Service (WAITER_NAME_KEY).
 */
const storageKey = (id: StationConfig['id']) =>
  `kasse.station.${id}.categories`;

function loadCategories(id: StationConfig['id']): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => typeof c === 'string');
  } catch {
    // Kaputter oder fremder Eintrag darf die Station nicht am Start hindern.
    return [];
  }
}

/**
 * Küche und Bar sind dieselbe Ansicht auf verschiedene Kategorien. Beide
 * Seiten sind darum nur eine Konfiguration dieser Komponente — was die eine
 * kann, kann die andere ohne Nacharbeit auch.
 */
export default function KasseStation({ station }: { station: StationConfig }) {
  const params = useParams<{ token: string }>();
  const token = params.token ?? '';
  const StationIcon = station.icon;

  const [showClosed, setShowClosed] = useState(false);
  // Bestellungen ausserhalb der eigenen Kategorien: eingeklappt, siehe unten.
  const [showOther, setShowOther] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  // Gespeicherte Kategorien als Vergleichsschlüssel (kleingeschrieben, siehe
  // categoryKey). Leer heisst „alles zeigen“.
  const [selected, setSelected] = useState<string[]>(() =>
    loadCategories(station.id),
  );
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

  const persistSelected = (next: string[]) => {
    setSelected(next);
    try {
      window.localStorage.setItem(storageKey(station.id), JSON.stringify(next));
    } catch {
      // Privater Modus o. ä.: der Filter gilt dann nur für diese Sitzung.
    }
  };

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
    // Kategorien gehen an den Server: er filtert vor dem LIMIT von 50. Filterte
    // erst der Client, meldete die Bar „noch nichts abgeschlossen“, sobald die
    // 50 neuesten Bestellungen reine Küchenbestellungen waren.
    {
      token,
      limit: 50,
      categoryKeys: selected.length > 0 ? selected : undefined,
    },
    { enabled: state.data?.valid === true && showClosed },
  );
  // Nur für die Auswahlliste im Filter: welche Kategorien es überhaupt gibt.
  // Selten, darum langsam pollen — die Bestellungen laufen über listOpenOrders.
  const menu = trpc.kasse.menu.useQuery(
    { token },
    { enabled: state.data?.valid === true, refetchInterval: 120000 },
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

  /**
   * Auswahl für den Filter: die Kategorien der aktiven Produkte, dazu die
   * bereits gewählten. Ohne den zweiten Teil verschwände ein Filter aus der
   * Liste, sobald das letzte Produkt dieser Kategorie inaktiv geschaltet wird
   * — und liesse sich nicht mehr abwählen, obwohl er noch filtert.
   *
   * „Weiteres“ steht immer zur Wahl, auch wenn gerade kein Produkt ohne
   * Kategorie aktiv ist: Positionen aus der Zeit vor der Kategorie-Spalte und
   * jedes Produkt, bei dem jemand das Feld leer lässt, landen dort — sie
   * müssen sich anwählen lassen.
   */
  const categoryChoices = useMemo(() => {
    const byKey = new Map<string, string>([
      [categoryKey(null), CATEGORY_FALLBACK],
    ]);
    for (const product of menu.data?.products ?? []) {
      byKey.set(categoryKey(product.category), categoryLabel(product.category));
    }
    for (const key of selected) {
      // Kategorie gibt es nicht mehr (umbenannt, letztes Produkt gelöscht):
      // der Schlüssel ist kleingeschrieben, als Label taugt er so nicht.
      if (!byKey.has(key)) {
        byKey.set(key, key.charAt(0).toLocaleUpperCase('de-CH') + key.slice(1));
      }
    }
    return Array.from(byKey.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de-CH'));
  }, [menu.data, selected]);

  /**
   * Bestellungen auf die Kategorien dieser Station eindampfen. Positionen
   * anderer Stationen fliegen raus, ihre Anzahl bleibt als Hinweis stehen:
   * sonst wirkt eine Bestellung mit zwei Bier und einer Wurst an der Bar wie
   * eine vollständige, und niemand wundert sich über die fehlende Wurst.
   *
   * Bestellungen, bei denen *keine* Position passt, werden nicht verworfen,
   * sondern getrennt zurückgegeben. Der Filter ist eine Geräte-Einstellung;
   * keine Station weiss, was die andere eingestellt hat. Ein neues Produkt
   * ohne Kategorie oder eine umbenannte Kategorie liesse eine Bestellung sonst
   * auf *keinem* Tablet erscheinen — der Service wartet, die Küche weiss von
   * nichts, und niemand kann es merken.
   */
  function forStation<
    T extends { items: Array<{ productCategory: string | null }> },
  >(list: T[]) {
    const mine: Array<T & { hiddenCount: number }> = [];
    const unassigned: T[] = [];
    for (const order of list) {
      const items = order.items.filter(item =>
        matchesCategories(item.productCategory, selected),
      );
      if (items.length === 0) {
        unassigned.push(order);
        continue;
      }
      mine.push({
        ...order,
        items,
        hiddenCount: order.items.length - items.length,
      });
    }
    return { mine, unassigned };
  }

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

  const open = forStation(orders.data ?? []);
  const pending = open.mine.filter(o => o.status === 'pending');
  const ready = open.mine.filter(o => o.status === 'ready');
  // Offene Bestellungen, für die diese Station keine einzige Position hat —
  // pending wie ready. Ohne die zweite Hälfte fiele eine solche Bestellung
  // nach dem Antippen von „Bereit“ sofort wieder aus jeder Ansicht.
  const unassigned = open.unassigned;
  // Welche Bestellungen abgeschlossen zurückkommen, entscheidet der Server
  // (vor dem LIMIT). Die Positionen anderer Stationen hier trotzdem
  // wegblenden, damit die Historie dieselbe Sicht zeigt wie die Arbeitsliste.
  const closed = (closedOrders.data ?? []).map(order => ({
    ...order,
    items: order.items.filter(item =>
      matchesCategories(item.productCategory, selected),
    ),
  }));
  const busy = (orderId: number) =>
    setStatus.isPending && setStatus.variables?.orderId === orderId;

  const filterLabel =
    selected.length === 0
      ? 'Alle Kategorien'
      : categoryChoices
          .filter(c => selected.includes(c.key))
          .map(c => c.label)
          .join(', ');

  return (
    <div className="min-h-screen bg-background">
      <SEO title={station.seoTitle} noIndex />

      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <StationIcon className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight">
              {station.title}
            </h1>
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

          {/* Der Filter gehört in den Kopf, nicht in ein Menü: er entscheidet,
              was diese Station überhaupt sieht, und muss darum jederzeit
              ablesbar sein. */}
          <Button
            variant="outline"
            className="h-11 max-w-[14rem]"
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{filterLabel}</span>
          </Button>
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
                      {order.hiddenCount > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          + {order.hiddenCount} Position(en) für eine andere
                          Station
                        </p>
                      )}
                      {order.note &&
                        (() => {
                          const clampable =
                            order.note.length > NOTE_CLAMP_THRESHOLD;
                          const open = openNotes.has(order.id);
                          // Kurze Notizen sind ohnehin ganz zu sehen und
                          // brauchen weder Knopf noch Hinweis.
                          if (!clampable) {
                            return (
                              <p className="mt-2 break-words text-sm italic xl:text-base">
                                {order.note}
                              </p>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => toggleNote(order.id)}
                              className="mt-2 block w-full text-left"
                              aria-expanded={open}
                              title={order.note}
                            >
                              {/* `block` und `line-clamp-2` setzen beide
                                  display; nebeneinander gewinnt `block` und
                                  die Kürzung greift nicht. Darum sich
                                  ausschliessend. */}
                              <span
                                className={`break-words text-sm italic xl:text-base ${
                                  open ? 'block' : 'line-clamp-2'
                                }`}
                              >
                                {order.note}
                              </span>
                              <span className="text-xs text-muted-foreground underline">
                                {open ? 'Notiz einklappen' : 'Ganze Notiz'}
                              </span>
                            </button>
                          );
                        })()}
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
                        // Rand in derselben Farbe wie die Fläche, sonst steht
                        // der neutrale Standard-Rand um ein rotes Feld.
                        // dark:-Pendants nötig: die outline-Variante setzt
                        // dark:bg-transparent und dark:border-input, die sonst
                        // im Dark Mode gewinnen.
                        className="h-14 w-14 shrink-0 border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive/50 hover:bg-destructive/20 hover:text-destructive dark:border-destructive/30 dark:bg-destructive/10 dark:hover:border-destructive/50 dark:hover:bg-destructive/20 xl:h-20 xl:w-20"
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

        {/* Sicherheitsnetz gegen die eine Sorte Fehler, die am Event niemand
            bemerkt: eine Bestellung, die auf *keinem* Tablet auftaucht. Der
            Filter ist eine Geräte-Einstellung, keine Station weiss, was die
            andere eingestellt hat — ein Produkt ohne Kategorie, eine neue oder
            eine umbenannte Kategorie fällt sonst überall durch.

            Bewusst leise und eingeklappt: hier steht auch jede ganz normale
            Bestellung der anderen Station drin. Als roter Alarm wäre die Zeile
            nach zehn Minuten Event Rauschen, den alle wegsehen — und damit
            wertlos für den einen Fall, für den sie da ist. Wer sie aufklappt,
            kann die Bestellung auch gleich erledigen. */}
        {unassigned.length > 0 && (
          <section className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowOther(v => !v)}
              aria-expanded={showOther}
            >
              <EyeOff className="mr-2 h-4 w-4" />
              {unassigned.length} offene Bestellung(en) ausserhalb dieser
              Kategorien
            </Button>

            {showOther && (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {unassigned.map(order => (
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
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatWait(order.waitSeconds)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {order.items
                        .map(
                          i =>
                            `${i.quantity}× ${i.productName} (${categoryLabel(
                              i.productCategory,
                            )})`,
                        )
                        .join(', ')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-9 w-full"
                      disabled={busy(order.id)}
                      onClick={() =>
                        setStatus.mutate({
                          token,
                          orderId: order.id,
                          status:
                            order.status === 'ready' ? 'delivered' : 'ready',
                        })
                      }
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {order.status === 'ready' ? 'Abgeholt' : 'Bereit'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

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
                    {/* Der Betrag gilt für die ganze Bestellung. Sind
                        Positionen ausgeblendet, passt er nicht zur Liste
                        darunter — dann lieber sagen, was fehlt. */}
                    <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {order.hiddenCount > 0
                        ? `+${order.hiddenCount} andernorts`
                        : formatChf(order.totalRappen)}
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
                    className="mt-3 h-12 w-full bg-success text-base font-semibold text-success-foreground shadow-sm hover:bg-success/90"
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
                    <span className="sr-only">, Tisch {order.tableName}</span>
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
            ) : closed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch nichts abgeschlossen.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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

      {/* Kategorien dieser Station. Mehrfachauswahl: die Bar bedient Drinks
       *und* Shots. */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Kategorien für {station.title}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 p-4">
            <p className="text-xs text-muted-foreground">
              Gilt nur für dieses Gerät. Ohne Auswahl zeigt die Ansicht alle
              Produkte.
            </p>
            <Button
              variant={selected.length === 0 ? 'default' : 'outline'}
              className="h-12 justify-start text-base"
              onClick={() => persistSelected([])}
            >
              {selected.length === 0 && <Check className="mr-2 h-4 w-4" />}
              Alle Kategorien
            </Button>
            {categoryChoices.map(choice => {
              const active = selected.includes(choice.key);
              return (
                <Button
                  key={choice.key}
                  variant={active ? 'default' : 'outline'}
                  className="h-12 justify-start text-base"
                  onClick={() =>
                    persistSelected(
                      active
                        ? selected.filter(k => k !== choice.key)
                        : [...selected, choice.key],
                    )
                  }
                >
                  {active && <Check className="mr-2 h-4 w-4 shrink-0" />}
                  <span className="truncate">{choice.label}</span>
                </Button>
              );
            })}
            <Button
              className="mt-2 h-12 text-base"
              onClick={() => setFilterOpen(false)}
            >
              Fertig
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
              Die ganze Bestellung verschwindet aus Küche, Bar und Service und
              zählt nicht zum Umsatz — auch Positionen, die hier gerade
              ausgeblendet sind. Rückgängig machen geht nicht.
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
