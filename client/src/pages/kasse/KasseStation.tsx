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
  categoryKey,
  formatChf,
  formatWait,
  matchesCategories,
  sortItemsForDisplay,
  urgency,
  waitMinutes,
} from '@/lib/kasse';
import {
  Check,
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

/**
 * Farbcodierung der Wartezeit. Die ursprünglichen zwei Stufen (5′/10′)
 * reichten am Event nicht — Bestellungen sind über eine Stunde liegen
 * geblieben, ohne dass sich das optisch noch von „überfällig“ absetzte.
 */
const URGENCY_STYLES = {
  normal: 'border-pending/50 bg-pending/10',
  urgent: 'border-pending bg-pending/20',
  overdue: 'border-destructive bg-destructive/15',
  critical: 'border-destructive bg-destructive/30',
  extreme: 'border-destructive bg-destructive/40 animate-pulse',
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
 * Der Kategorien-Sub-Filter ist eine Geräte-Einstellung, keine
 * Server-Einstellung: die Bar bedient z. B. Drinks *und* Shots, ein einzelnes
 * Tablet will aber vielleicht nur Shots sehen. Darum pro Station im
 * localStorage, wie der Name des Service (WAITER_NAME_KEY).
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
 * Küche und Bar sind dieselbe Ansicht auf verschiedene Stationen. Beide
 * Seiten sind darum nur eine Konfiguration dieser Komponente — was die eine
 * kann, kann die andere ohne Nacharbeit auch.
 *
 * Eine Bestellung mit Positionen mehrerer Stationen wird beim Senden im
 * Service serverseitig aufgeteilt (siehe createOrder im Router) — hier kommt
 * darum nie eine Order mit fremden Positionen an, `station` filtert bereits
 * in SQL. Der Kategorien-Filter unten ist nur noch ein Sub-Filter *innerhalb*
 * der eigenen Station (z. B. „nur Shots“ an der Bar).
 */
export default function KasseStation({ station }: { station: StationConfig }) {
  const params = useParams<{ token: string }>();
  const token = params.token ?? '';
  const StationIcon = station.icon;

  const [showClosed, setShowClosed] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  // Gespeicherte Kategorien als Vergleichsschlüssel (kleingeschrieben, siehe
  // categoryKey). Leer heisst „alle Kategorien dieser Station zeigen“.
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
  // `station` filtert bereits in SQL — dieses Tablet bekommt nie Positionen
  // der anderen Station zu sehen.
  const orders = trpc.kasse.listOpenOrders.useQuery(
    { token, station: station.id },
    { enabled: state.data?.valid === true, refetchInterval: 3000 },
  );
  const closedOrders = trpc.kasse.listClosedOrders.useQuery(
    {
      token,
      limit: 50,
      station: station.id,
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
   * Auswahl für den Sub-Filter: nur Kategorien dieser Station, dazu die
   * bereits gewählten. Ohne den zweiten Teil verschwände ein Filter aus der
   * Liste, sobald die Kategorie umbenannt oder deaktiviert wird — und liesse
   * sich nicht mehr abwählen, obwohl er noch filtert.
   */
  const categoryChoices = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const category of menu.data?.categories ?? []) {
      if (category.station !== station.id) continue;
      byKey.set(categoryKey(category.name), category.name);
    }
    for (const key of selected) {
      if (!byKey.has(key)) {
        byKey.set(key, key.charAt(0).toLocaleUpperCase('de-CH') + key.slice(1));
      }
    }
    return Array.from(byKey.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de-CH'));
  }, [menu.data, selected, station.id]);

  /**
   * Sub-Filter innerhalb der eigenen Station anwenden. Eine Bestellung, bei
   * der danach keine Position mehr übrig bleibt, verschwindet ganz aus der
   * Liste — anders als früher gibt es kein „ausserhalb dieser Kategorien“
   * mehr, weil eine fremde Station hier strukturell nicht mehr ankommen kann.
   */
  function applyFilter<
    T extends { items: Array<{ productCategory: string | null }> },
  >(list: T[]): Array<T & { hiddenCount: number }> {
    if (selected.length === 0) {
      return list.map(order => ({ ...order, hiddenCount: 0 }));
    }
    return list
      .map(order => {
        const items = order.items.filter(item =>
          matchesCategories(item.productCategory, selected),
        );
        return {
          ...order,
          items,
          hiddenCount: order.items.length - items.length,
        };
      })
      .filter(order => order.items.length > 0);
  }

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
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

  const open = applyFilter(orders.data ?? []);
  const pending = open.filter(o => o.status === 'pending');
  const ready = open.filter(o => o.status === 'ready');
  const closed = applyFilter(closedOrders.data ?? []);
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
          <StationIcon className="size-6 shrink-0 text-primary" />
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
            <SlidersHorizontal className="mr-2 size-4 shrink-0" />
            <span className="truncate">{filterLabel}</span>
          </Button>
        </div>
      </header>

      <main className="space-y-8 p-4 xl:p-6">
        {/* Zu erledigen und Bereit nebeneinander ab xl: auf dem iPad, das als
            Hauptscreen dient, musste man sonst an viel offenem durch die ganze
            Pending-Liste scrollen, um zu sehen, was schon abholbereit ist. Die
            einzelnen Karten bleiben bis 2xl in ihrer kompakten Form (siehe
            unten) — der dichte Vierspalten-Aufbau brauchte die volle
            Bildschirmbreite, nicht nur eine halbe Spalte. */}
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
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
                  const items = sortItemsForDisplay(order.items);
                  return (
                    <article
                      key={order.id}
                      className={`grid gap-3 rounded-xl border-2 p-3 2xl:grid-cols-[8rem_1fr_7rem_17rem] 2xl:items-center 2xl:gap-6 2xl:p-4 ${
                        URGENCY_STYLES[urgency(minutes)]
                      }`}
                    >
                      {/* Unter 2xl stehen Tisch und Wartezeit nebeneinander in
                          einer Kopfzeile; die feste Vierspalten-Aufteilung
                          (32rem allein für Tisch, Wartezeit und Knöpfe) liess
                          der Produktliste auf einem schmaleren Tablet oder in
                          der Zwei-Spalten-Ansicht zu wenig Platz. */}
                      <div className="flex items-baseline justify-between gap-3 2xl:block">
                        <div className="min-w-0">
                          <p
                            className="truncate text-2xl font-bold leading-none 2xl:text-3xl"
                            title={order.tableName}
                          >
                            {order.tableName}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {order.waiterName ?? 'ohne Name'}
                          </p>
                        </div>
                        <p className="shrink-0 text-xl font-bold tabular-nums 2xl:hidden">
                          {formatWait(order.waitSeconds)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <ul className="space-y-1">
                          {items.map(item => (
                            <li
                              key={item.id}
                              className="break-words text-base leading-snug 2xl:text-lg"
                            >
                              <span className="font-bold tabular-nums">
                                {item.quantity}×
                              </span>{' '}
                              {item.productName}
                              {item.options.length > 0 && (
                                <span className="text-muted-foreground">
                                  {' · '}
                                  {item.options
                                    .map(o => o.optionName)
                                    .join(', ')}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {order.hiddenCount > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            + {order.hiddenCount} Position(en) einer anderen
                            Kategorie ausgeblendet
                          </p>
                        )}
                        {order.note &&
                          (() => {
                            const clampable =
                              order.note.length > NOTE_CLAMP_THRESHOLD;
                            const noteOpen = openNotes.has(order.id);
                            // Kurze Notizen sind ohnehin ganz zu sehen und
                            // brauchen weder Knopf noch Hinweis.
                            if (!clampable) {
                              return (
                                <p className="mt-2 break-words text-sm italic 2xl:text-base">
                                  {order.note}
                                </p>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={() => toggleNote(order.id)}
                                className="mt-2 block w-full text-left"
                                aria-expanded={noteOpen}
                                title={order.note}
                              >
                                {/* `block` und `line-clamp-2` setzen beide
                                    display; nebeneinander gewinnt `block` und
                                    die Kürzung greift nicht. Darum sich
                                    ausschliessend. */}
                                <span
                                  className={`break-words text-sm italic 2xl:text-base ${
                                    noteOpen ? 'block' : 'line-clamp-2'
                                  }`}
                                >
                                  {order.note}
                                </span>
                                <span className="text-xs text-muted-foreground underline">
                                  {noteOpen
                                    ? 'Notiz einklappen'
                                    : 'Ganze Notiz'}
                                </span>
                              </button>
                            );
                          })()}
                      </div>

                      <div className="hidden text-center 2xl:block">
                        <p className="text-2xl font-bold tabular-nums">
                          {formatWait(order.waitSeconds)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Wartezeit
                        </p>
                      </div>

                      <div className="flex min-w-0 items-center gap-2">
                        <Button
                          className="h-14 min-w-0 flex-1 text-base font-semibold 2xl:h-20 2xl:text-xl"
                          disabled={busy(order.id)}
                          onClick={() =>
                            setStatus.mutate({
                              token,
                              orderId: order.id,
                              status: 'ready',
                            })
                          }
                        >
                          <Check className="mr-2 size-5 2xl:size-7" />
                          Bereit
                        </Button>
                        <Button
                          variant="outline"
                          // Rand in derselben Farbe wie die Fläche, sonst steht
                          // der neutrale Standard-Rand um ein rotes Feld.
                          // dark:-Pendants nötig: die outline-Variante setzt
                          // dark:bg-transparent und dark:border-input, die sonst
                          // im Dark Mode gewinnen.
                          className="h-14 w-14 shrink-0 border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive/50 hover:bg-destructive/20 hover:text-destructive dark:border-destructive/30 dark:bg-destructive/10 dark:hover:border-destructive/50 dark:hover:bg-destructive/20 2xl:h-20 2xl:w-20"
                          disabled={busy(order.id)}
                          onClick={() => setCancelId(order.id)}
                          aria-label={`Bestellung für Tisch ${order.tableName} stornieren`}
                        >
                          <Trash2 className="size-5 2xl:size-6" />
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
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
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
                          ? `+${order.hiddenCount} andere Kategorie${order.hiddenCount > 1 ? 'n' : ''}`
                          : formatChf(order.totalRappen)}
                      </p>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.waiterName ?? 'ohne Name'}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                      {sortItemsForDisplay(order.items).map(item => (
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
                      <Check className="mr-2 size-5" />
                      Abgeholt
                      <span className="sr-only">, Tisch {order.tableName}</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Nachschlagen, was schon durch ist. Ohne Polling, damit die
            Arbeitsliste oben die einzige ist, die sich dauernd bewegt. */}
        <section className="space-y-3 border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setShowClosed(v => !v)}
          >
            <History className="mr-2 size-4" />
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
                    <p className="truncate text-xs text-muted-foreground">
                      {order.waiterName ?? 'ohne Name'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {sortItemsForDisplay(order.items)
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
              Kategorien dieser Station.
            </p>
            <Button
              variant={selected.length === 0 ? 'default' : 'outline'}
              className="h-12 justify-start text-base"
              onClick={() => persistSelected([])}
            >
              {selected.length === 0 && <Check className="mr-2 size-4" />}
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
                  {active && <Check className="mr-2 size-4 shrink-0" />}
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
              Diese Bestellung verschwindet aus dieser Station und dem Service
              und zählt nicht zum Umsatz — auch Positionen, die hier gerade
              ausgeblendet sind. Eine allfällige Bestellung der anderen Station
              (falls gemischt aufgenommen) ist davon nicht betroffen. Rückgängig
              machen geht nicht.
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
