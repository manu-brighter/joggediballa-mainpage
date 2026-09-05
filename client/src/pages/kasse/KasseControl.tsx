import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { usePermission } from '@/hooks/usePermissions';
import { SEO } from '@/components/SEO';
import { QR_BG, StyledQr } from '@/components/StyledQr';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  categoryKey,
  categoryLabel,
  formatChf,
  formatWait,
  parseChfToRappen,
} from '@/lib/kasse';
import { DragHandle, SortableRow } from './KasseSortable';
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

function CopyableLink({ url }: { url: string }) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={url} className="text-xs" />
      <Button
        variant="outline"
        size="icon"
        aria-label="Link kopieren"
        onClick={() => {
          navigator.clipboard
            .writeText(url)
            .then(() => toast.success('Link kopiert.'))
            .catch(() => toast.error('Kopieren fehlgeschlagen.'));
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" asChild aria-label="Link öffnen">
        <a href={url} target="_blank" rel="noreferrer">
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}

/**
 * Aufpreis eines Zusatzes in Rappen. Leer = 0 (gratis), führendes Minus
 * erlaubt, damit „ohne Beilage“ den Preis senken kann. null = ungültige Eingabe.
 */
function parseOptionDelta(input: string | undefined): number | null {
  const raw = (input ?? '').trim();
  if (raw === '') return 0;
  const negative = raw.startsWith('-') || raw.startsWith('\u2212');
  const rappen = parseChfToRappen(raw.replace(/^[-\u2212]/, ''));
  if (rappen === null) return null;
  return negative ? -rappen : rappen;
}

export default function KasseControl() {
  const canManage = usePermission('manage_kasse');
  const utils = trpc.useUtils();

  const { data: settings } = trpc.kasse.getSettings.useQuery(undefined, {
    enabled: canManage,
    refetchInterval: 15000,
  });
  const { data: products = [] } = trpc.kasse.listProducts.useQuery(undefined, {
    enabled: canManage,
  });
  const { data: tables = [] } = trpc.kasse.listTables.useQuery(undefined, {
    enabled: canManage,
  });

  const [statsSessionId, setStatsSessionId] = useState<number | null>(null);
  const { data: stats } = trpc.kasse.sessionStats.useQuery(
    { sessionId: statsSessionId ?? 0 },
    { enabled: canManage && statsSessionId != null },
  );

  // Standardmässig die Auswertung der laufenden bzw. letzten Kasse zeigen.
  useEffect(() => {
    if (statsSessionId != null || !settings) return;
    const fallback = settings.openSession ?? settings.sessions[0];
    if (fallback) setStatsSessionId(fallback.id);
  }, [settings, statsSessionId]);

  /**
   * Produkte nach Kategorie gruppiert, in der Reihenfolge, in der die Gruppe
   * das erste Mal vorkommt. Genau dieselbe Regel wendet die Serviceansicht an,
   * die Verwaltung zeigt also, was das Handy zeigen wird.
   */
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: typeof products }>();
    for (const product of products) {
      const key = categoryKey(product.category);
      const group = map.get(key);
      if (group) group.items.push(product);
      else
        map.set(key, {
          label: categoryLabel(product.category),
          items: [product],
        });
    }
    return Array.from(map, ([key, group]) => ({ key, ...group }));
  }, [products]);

  // `distance: 8` unterscheidet Ziehen von Tippen: ohne die Schwelle löst
  // jeder Fingerkontakt auf dem Anfasser schon einen Zug aus, und ein
  // Fehlgriff beim Scrollen verschiebt ein Produkt.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const invalidateSettings = () => utils.kasse.getSettings.invalidate();
  const invalidateProducts = () => utils.kasse.listProducts.invalidate();
  const invalidateTables = () => utils.kasse.listTables.invalidate();
  const onError = (e: { message: string }) => toast.error(e.message);

  const updateSettings = trpc.kasse.updateSettings.useMutation({
    onSuccess: invalidateSettings,
    onError,
  });
  const rotateToken = trpc.kasse.rotateToken.useMutation({
    onSuccess: () => {
      invalidateSettings();
      toast.success('Neuer Token. Alte Links und QR-Codes sind ungültig.');
    },
    onError,
  });
  const openSession = trpc.kasse.openSession.useMutation({
    onSuccess: () => {
      invalidateSettings();
      toast.success('Kasse geöffnet.');
    },
    onError,
  });
  const closeSession = trpc.kasse.closeSession.useMutation({
    onSuccess: r => {
      invalidateSettings();
      if (r.cancelled > 0) {
        toast.warning(
          `Kasse geschlossen, ${r.cancelled} offene Bestellung(en) storniert.`,
        );
      } else {
        toast.success('Kasse geschlossen.');
      }
    },
    onError,
  });
  const reopenSession = trpc.kasse.reopenSession.useMutation({
    onSuccess: invalidateSettings,
    onError,
  });
  const clearSession = trpc.kasse.clearSession.useMutation({
    onSuccess: r => {
      invalidateSettings();
      utils.kasse.sessionStats.invalidate();
      utils.kasse.sessionOrders.invalidate();
      toast.success(
        r.deleted > 0
          ? `${r.deleted} Bestellung(en) gelöscht, die Auswertung steht auf null.`
          : 'Es gab nichts zu löschen.',
      );
    },
    onError,
  });
  const deleteSession = trpc.kasse.deleteSession.useMutation({
    onSuccess: () => {
      invalidateSettings();
      setStatsSessionId(null);
    },
    onError,
  });

  const createProduct = trpc.kasse.createProduct.useMutation({
    onSuccess: invalidateProducts,
    onError,
  });
  const updateProduct = trpc.kasse.updateProduct.useMutation({
    onSuccess: invalidateProducts,
    onError,
  });
  const reorderProducts = trpc.kasse.reorderProducts.useMutation({
    onSuccess: invalidateProducts,
    onError: e => {
      // Die Liste steht lokal schon in der neuen Reihenfolge (applyOrder).
      // Ohne das Nachladen bliebe sie so stehen und zeigte eine Sortierung,
      // die in der Datenbank nie angekommen ist.
      toast.error(e.message);
      invalidateProducts();
    },
  });
  const deleteProduct = trpc.kasse.deleteProduct.useMutation({
    onSuccess: invalidateProducts,
    onError,
  });
  const createOption = trpc.kasse.createOption.useMutation({
    onSuccess: invalidateProducts,
    onError,
  });
  const deleteOption = trpc.kasse.deleteOption.useMutation({
    onSuccess: invalidateProducts,
    onError,
  });

  const createTableRange = trpc.kasse.createTableRange.useMutation({
    onSuccess: r => {
      invalidateTables();
      toast.success(`${r.created} Tische angelegt.`);
    },
    onError,
  });
  const createTable = trpc.kasse.createTable.useMutation({
    onSuccess: invalidateTables,
    onError,
  });
  const updateTable = trpc.kasse.updateTable.useMutation({
    onSuccess: invalidateTables,
    onError,
  });
  const deleteTable = trpc.kasse.deleteTable.useMutation({
    onSuccess: invalidateTables,
    onError,
  });
  const deleteAllTables = trpc.kasse.deleteAllTables.useMutation({
    onSuccess: r => {
      invalidateTables();
      toast.success(`${r.deleted} Tische gelöscht.`);
    },
    onError,
  });

  // Formular-Drafts
  const [sessionName, setSessionName] = useState('');
  const [productDraft, setProductDraft] = useState({
    name: '',
    category: '',
    price: '',
  });
  const [optionDrafts, setOptionDrafts] = useState<Record<number, string>>({});
  // Produkt in Bearbeitung. Nur eines gleichzeitig, damit ein angefangener
  // Preis nicht in einer zweiten offenen Zeile untergeht.
  const [editProductId, setEditProductId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    category: '',
    price: '',
  });
  // Ein Dialog für alle harten Löschungen. Produkt, Zusatz und Tisch werden
  // serverseitig echt gelöscht; Kasse schliessen, Token rotieren und Session
  // löschen fragen in dieser Datei längst nach, diese drei feuerten auf einen
  // Fingertipp, mitten am Event neben dem Mengen-Plus keine gute Idee.
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    run: () => void;
  } | null>(null);
  // Aufpreis je Zusatz, als Text. Geparst wird erst beim Anlegen. Leer heisst
  // 0, der Zusatz kostet dann gleich viel wie das Produkt ohne ihn.
  const [optionPriceDrafts, setOptionPriceDrafts] = useState<
    Record<number, string>
  >({});
  const [tableRange, setTableRange] = useState({
    area: 'A',
    from: '1',
    to: '10',
  });
  const [tableName, setTableName] = useState('');

  if (!canManage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <SEO title="Kassen-Verwaltung" noIndex />
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const runningSession = settings.openSession;
  // Die Kasse, deren Auswertung gerade angezeigt wird — nicht zwingend die
  // laufende. `orderCount` zählt ohne Stornos, für den Bestätigungstext soll
  // aber dastehen, was tatsächlich verschwindet.
  const statsSession = stats?.session ?? null;
  const statsOrderCount = stats
    ? stats.orderCount + stats.cancelledCount
    : null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const serviceUrl = `${origin}/kasse/service/${settings.accessToken}`;
  const kuecheUrl = `${origin}/kasse/kueche/${settings.accessToken}`;
  const barUrl = `${origin}/kasse/bar/${settings.accessToken}`;

  const startEdit = (product: (typeof products)[number]) => {
    setEditProductId(product.id);
    setEditDraft({
      name: product.name,
      category: product.category ?? '',
      // Als Text, sonst müsste jeder Tastendruck durch parseChfToRappen und
      // „8.“ wäre zwischendurch ungültig. Geparst wird beim Speichern.
      price: (product.priceRappen / 100).toFixed(2),
    });
  };

  const submitEdit = () => {
    if (editProductId == null) return;
    const previousName =
      products.find(p => p.id === editProductId)?.name ?? editDraft.name.trim();
    const priceRappen = parseChfToRappen(editDraft.price);
    if (!editDraft.name.trim() || priceRappen == null) {
      toast.error('Name und ein gültiger Preis (z. B. 8.50) sind nötig.');
      return;
    }
    updateProduct.mutate(
      {
        id: editProductId,
        name: editDraft.name.trim(),
        category: editDraft.category.trim() || null,
        priceRappen,
      },
      {
        onSuccess: () => {
          setEditProductId(null);
          // Bereits erfasste Bestellungen behalten ihre Snapshots; die
          // Änderung gilt erst ab der nächsten Bestellung. Beim Namen hat das
          // eine sichtbare Folge: die Auswertung gruppiert über den Namen,
          // ein Umbenennen mitten in der Kasse ergibt dort zwei Zeilen.
          const renamed = editDraft.name.trim() !== previousName;
          toast.success(
            renamed
              ? `Produkt gespeichert. „${previousName}“ bleibt in der Auswertung der laufenden Kasse als eigene Zeile stehen.`
              : 'Produkt gespeichert.',
          );
        },
      },
    );
  };

  /**
   * Ein Produkt eine Position nach oben oder unten. Geschickt wird die ganze
   * neue Reihenfolge, nicht „tausche 3 und 4“: die Verwaltung sieht die Liste
   * ohnehin komplett, und der Server muss keine relative Bewegung gegen einen
   * womöglich veralteten Stand auflösen.
   */
  /**
   * Reihenfolge speichern und die Liste sofort lokal umsortieren. Ohne das
   * optimistische Update schnappt die gezogene Zeile zurück, bis die Antwort
   * da ist — und ein zweiter Zug in diesem Fenster ginge von der alten
   * Reihenfolge aus und nähme den ersten zurück.
   */
  const applyOrder = (ids: number[]) => {
    const rank = new Map(ids.map((id, index) => [id, index]));
    utils.kasse.listProducts.setData(undefined, prev =>
      prev
        ? [...prev].sort(
            (a, b) =>
              (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
              (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
          )
        : prev,
    );
    reorderProducts.mutate({ ids });
  };

  /** Die Gruppen wieder zu einer flachen Reihenfolge von Produkt-IDs. */
  const flatten = (list: Array<{ items: typeof products }>) =>
    list.flatMap(group => group.items.map(p => p.id));

  /** Index der Gruppe, zu der eine Zieh-ID gehört — Überschrift wie Produkt. */
  const groupIndexOf = (id: string) =>
    id.startsWith('group:')
      ? groups.findIndex(g => `group:${g.key}` === id)
      : groups.findIndex(g => g.items.some(p => `product:${p.id}` === id));

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    // Ganze Kategorie verschieben. Beim Ziehen über eine andere Gruppe liegt
    // unter dem Zeiger meist eines ihrer Produkte, nicht ihre Überschrift —
    // darum das Ziel auf die Gruppe auflösen, zu der es gehört.
    if (activeId.startsWith('group:')) {
      const from = groupIndexOf(activeId);
      const to = groupIndexOf(overId);
      if (from === -1 || to === -1 || from === to) return;
      applyOrder(flatten(arrayMove(groups, from, to)));
      return;
    }

    // Produkt innerhalb seiner Kategorie verschieben. Ein Zug in eine fremde
    // Kategorie tut nichts: das wäre eine Änderung am Produkt, nicht an der
    // Reihenfolge — dafür ist der Stift da.
    if (activeId.startsWith('product:') && overId.startsWith('product:')) {
      const group = groups.find(g =>
        g.items.some(p => `product:${p.id}` === activeId),
      );
      if (!group) return;
      const from = group.items.findIndex(p => `product:${p.id}` === activeId);
      const to = group.items.findIndex(p => `product:${p.id}` === overId);
      if (from === -1 || to === -1) return;
      applyOrder(
        flatten(
          groups.map(g =>
            g === group ? { ...g, items: arrayMove(g.items, from, to) } : g,
          ),
        ),
      );
    }
  };

  const submitProduct = () => {
    const priceRappen = parseChfToRappen(productDraft.price);
    if (!productDraft.name.trim() || priceRappen == null) {
      toast.error('Name und ein gültiger Preis (z. B. 8.50) sind nötig.');
      return;
    }
    createProduct.mutate(
      {
        name: productDraft.name.trim(),
        category: productDraft.category.trim() || null,
        priceRappen,
        displayOrder: products.length,
      },
      {
        onSuccess: () => setProductDraft({ name: '', category: '', price: '' }),
      },
    );
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <SEO title="Kassen-Verwaltung" noIndex />

      <div>
        <h1 className="text-2xl font-bold">Kassensystem</h1>
        <p className="text-sm text-muted-foreground">
          Produkte, Tische und Auswertung. Service und Küche arbeiten über die
          Links unten, dort braucht es keinen Login.
        </p>
      </div>

      {/* Kasse öffnen / schliessen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Kasse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {runningSession ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/40 bg-success/10 p-4">
              <div>
                <p className="font-semibold">{runningSession.name}</p>
                <p className="text-xs text-muted-foreground">
                  Offen seit{' '}
                  {new Date(runningSession.openedAt).toLocaleString('de-CH')}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={closeSession.isPending}
                  >
                    Kasse schliessen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Kasse schliessen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {settings.openOrderCount > 0
                        ? `Es sind noch ${settings.openOrderCount} Bestellung(en) offen. Beim Schliessen werden sie storniert. Sie verschwinden aus Küche und Service und zählen nicht zum Umsatz.`
                        : 'Service und Küche können danach keine Bestellungen mehr aufnehmen. Die Auswertung bleibt erhalten.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        closeSession.mutate({
                          sessionId: runningSession.id,
                          force: true,
                        })
                      }
                    >
                      Schliessen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Input
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                placeholder="Event-Name, z. B. Sommerfest 2026"
                className="flex-1 min-w-[16rem]"
                maxLength={150}
              />
              <Button
                disabled={!sessionName.trim() || openSession.isPending}
                onClick={() =>
                  openSession.mutate(
                    { name: sessionName.trim() },
                    { onSuccess: () => setSessionName('') },
                  )
                }
              >
                Kasse öffnen
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <Label htmlFor="kasse-orders-open">Bestellungen offen</Label>
              <p className="text-xs text-muted-foreground">
                Aus: Service kann keine neuen Bestellungen mehr senden.
              </p>
            </div>
            <Switch
              id="kasse-orders-open"
              checked={settings.ordersOpen}
              onCheckedChange={v => updateSettings.mutate({ ordersOpen: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Zugangslinks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Zugang für Service, Küche & Bar
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Küche und Bar zeigen dieselbe Ansicht. Welche Kategorien ein Gerät
            anzeigt, wird direkt auf dem Gerät eingestellt (Knopf oben rechts).
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3">
              <p className="text-sm font-medium">Service (Handy)</p>
              <div
                className="flex justify-center rounded-xl p-5"
                style={{ backgroundColor: QR_BG }}
              >
                <StyledQr
                  value={serviceUrl}
                  size={150}
                  label="QR-Code für die Service-Seite (Handy)"
                />
              </div>
              <CopyableLink url={serviceUrl} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Küche (Tablet)</p>
              <div
                className="flex justify-center rounded-xl p-5"
                style={{ backgroundColor: QR_BG }}
              >
                <StyledQr
                  value={kuecheUrl}
                  size={150}
                  label="QR-Code für die Küchen-Seite (Tablet)"
                />
              </div>
              <CopyableLink url={kuecheUrl} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Bar (Tablet)</p>
              <div
                className="flex justify-center rounded-xl p-5"
                style={{ backgroundColor: QR_BG }}
              >
                <StyledQr
                  value={barUrl}
                  size={150}
                  label="QR-Code für die Bar-Seite (Tablet)"
                />
              </div>
              <CopyableLink url={barUrl} />
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Token rotieren
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Token rotieren?</AlertDialogTitle>
                <AlertDialogDescription>
                  Alle bestehenden Links und QR-Codes werden sofort ungültig.
                  Alle Geräte brauchen danach den neuen Link.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={() => rotateToken.mutate()}>
                  Rotieren
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Produkte */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Produkte</CardTitle>
          <p className="text-xs text-muted-foreground">
            Zusätze: Aufpreis leer lassen für gratis, dann kostet der Zusatz
            gleich viel wie das Produkt. Ein Minus ist erlaubt, etwa −1.00 für
            „ohne Beilage“.
          </p>
          <p className="text-xs text-muted-foreground">
            Reihenfolge am Punkteraster ziehen — Produkte innerhalb ihrer
            Kategorie, ganze Kategorien am Raster neben der Überschrift. Genau
            so steht es danach im Service. Die Kategorie eines Produkts ändert
            man über den Stift, nicht durchs Ziehen; sie steuert ausserdem,
            welche Station (Küche oder Bar) eine Position sieht.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={productDraft.name}
              onChange={e =>
                setProductDraft(d => ({ ...d, name: e.target.value }))
              }
              placeholder="Produkt, z. B. Pommes Frites"
              className="flex-1 min-w-[12rem]"
              maxLength={100}
            />
            <Input
              value={productDraft.category}
              onChange={e =>
                setProductDraft(d => ({ ...d, category: e.target.value }))
              }
              placeholder="Kategorie"
              className="w-36"
              maxLength={50}
            />
            <Input
              value={productDraft.price}
              onChange={e =>
                setProductDraft(d => ({ ...d, price: e.target.value }))
              }
              placeholder="8.50"
              inputMode="decimal"
              className="w-24"
            />
            <Button onClick={submitProduct} disabled={createProduct.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Anlegen
            </Button>
          </div>

          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Produkte erfasst.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={groups.map(g => `group:${g.key}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {groups.map(group => (
                    <SortableRow
                      key={`group:${group.key}`}
                      id={`group:${group.key}`}
                    >
                      {groupHandle => (
                        <section className="rounded-xl border bg-muted/40 p-3">
                          <div className="mb-3 flex items-center gap-1">
                            <DragHandle
                              label={`Kategorie ${group.label} verschieben`}
                              handle={groupHandle}
                            />
                            <h3 className="min-w-0 truncate text-sm font-semibold uppercase tracking-wide">
                              {group.label}
                            </h3>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              ({group.items.length})
                            </span>
                          </div>

                          <SortableContext
                            items={group.items.map(p => `product:${p.id}`)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-3">
                              {group.items.map(product => (
                                <SortableRow
                                  key={product.id}
                                  id={`product:${product.id}`}
                                >
                                  {handle => (
                                    <div className="rounded-lg border bg-background p-4">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <DragHandle
                                          label={`${product.name} verschieben`}
                                          handle={handle}
                                        />
                                        {editProductId === product.id ? (
                                          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                                            <Input
                                              value={editDraft.name}
                                              onChange={e =>
                                                setEditDraft(d => ({
                                                  ...d,
                                                  name: e.target.value,
                                                }))
                                              }
                                              className="flex-1 min-w-[12rem]"
                                              maxLength={100}
                                              aria-label={`Name von ${product.name}`}
                                            />
                                            <Input
                                              value={editDraft.category}
                                              onChange={e =>
                                                setEditDraft(d => ({
                                                  ...d,
                                                  category: e.target.value,
                                                }))
                                              }
                                              placeholder="Kategorie"
                                              className="w-36"
                                              maxLength={50}
                                              aria-label={`Kategorie von ${product.name}`}
                                            />
                                            <Input
                                              value={editDraft.price}
                                              onChange={e =>
                                                setEditDraft(d => ({
                                                  ...d,
                                                  price: e.target.value,
                                                }))
                                              }
                                              placeholder="8.50"
                                              inputMode="decimal"
                                              className="w-24"
                                              aria-label={`Preis von ${product.name}`}
                                            />
                                            <Button
                                              size="icon"
                                              aria-label="Änderungen speichern"
                                              disabled={updateProduct.isPending}
                                              onClick={submitEdit}
                                            >
                                              <Check className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              aria-label="Bearbeiten abbrechen"
                                              onClick={() =>
                                                setEditProductId(null)
                                              }
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        ) : (
                                          // `flex-1`, damit der Name direkt
                                          // neben dem Anfasser steht:
                                          // justify-between schöbe ihn sonst
                                          // in die Mitte der Zeile.
                                          <div className="min-w-0 flex-1">
                                            <p className="font-medium">
                                              {product.name}
                                              {product.category && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                  {product.category}
                                                </span>
                                              )}
                                            </p>
                                            <p className="text-sm tabular-nums text-muted-foreground">
                                              {formatChf(product.priceRappen)}
                                            </p>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-2">
                                            <Label
                                              htmlFor={`product-active-${product.id}`}
                                              className="text-xs text-muted-foreground"
                                            >
                                              Aktiv
                                            </Label>
                                            <Switch
                                              id={`product-active-${product.id}`}
                                              checked={product.isActive}
                                              onCheckedChange={v =>
                                                updateProduct.mutate({
                                                  id: product.id,
                                                  isActive: v,
                                                })
                                              }
                                            />
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`${product.name} bearbeiten`}
                                            onClick={() =>
                                              editProductId === product.id
                                                ? setEditProductId(null)
                                                : startEdit(product)
                                            }
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`${product.name} löschen`}
                                            onClick={() =>
                                              setConfirm({
                                                title: `„${product.name}“ löschen?`,
                                                description:
                                                  'Das Produkt und seine Zusätze verschwinden aus der Auswahl. Bereits erfasste Bestellungen behalten Name und Preis.',
                                                run: () =>
                                                  deleteProduct.mutate({
                                                    id: product.id,
                                                  }),
                                              })
                                            }
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Zusätze */}
                                      <div className="mt-3 space-y-2 border-t pt-3">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                          Zusätze
                                        </p>
                                        {product.options.length > 0 && (
                                          <div className="flex flex-wrap gap-2">
                                            {product.options.map(option => (
                                              <span
                                                key={option.id}
                                                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                                              >
                                                {option.name}
                                                {option.priceDeltaRappen !==
                                                  0 && (
                                                  <span className="text-xs text-muted-foreground">
                                                    {option.priceDeltaRappen > 0
                                                      ? '+'
                                                      : '−'}
                                                    {formatChf(
                                                      Math.abs(
                                                        option.priceDeltaRappen,
                                                      ),
                                                    )}
                                                  </span>
                                                )}
                                                <button
                                                  type="button"
                                                  aria-label={`${option.name} entfernen`}
                                                  onClick={() =>
                                                    setConfirm({
                                                      title: `Zusatz „${option.name}“ löschen?`,
                                                      description:
                                                        'Der Zusatz verschwindet aus der Auswahl. Bereits erfasste Bestellungen behalten ihn als Snapshot.',
                                                      run: () =>
                                                        deleteOption.mutate({
                                                          id: option.id,
                                                        }),
                                                    })
                                                  }
                                                  className="text-muted-foreground hover:text-destructive"
                                                >
                                                  ×
                                                </button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Input
                                            value={
                                              optionDrafts[product.id] ?? ''
                                            }
                                            onChange={e =>
                                              setOptionDrafts(d => ({
                                                ...d,
                                                [product.id]: e.target.value,
                                              }))
                                            }
                                            placeholder="Zusatz, z. B. Ketchup"
                                            className="max-w-xs"
                                            maxLength={100}
                                          />
                                          <Input
                                            value={
                                              optionPriceDrafts[product.id] ??
                                              ''
                                            }
                                            onChange={e =>
                                              setOptionPriceDrafts(d => ({
                                                ...d,
                                                [product.id]: e.target.value,
                                              }))
                                            }
                                            placeholder="Aufpreis, z. B. 0.50"
                                            className="w-40"
                                            inputMode="decimal"
                                            aria-label={`Aufpreis für Zusatz von ${product.name}`}
                                          />
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={
                                              !optionDrafts[
                                                product.id
                                              ]?.trim() ||
                                              parseOptionDelta(
                                                optionPriceDrafts[product.id],
                                              ) === null
                                            }
                                            onClick={() => {
                                              const delta = parseOptionDelta(
                                                optionPriceDrafts[product.id],
                                              );
                                              if (delta === null) return;
                                              createOption.mutate(
                                                {
                                                  productId: product.id,
                                                  name: (
                                                    optionDrafts[product.id] ??
                                                    ''
                                                  ).trim(),
                                                  priceDeltaRappen: delta,
                                                  displayOrder:
                                                    product.options.length,
                                                },
                                                {
                                                  onSuccess: () => {
                                                    setOptionDrafts(d => ({
                                                      ...d,
                                                      [product.id]: '',
                                                    }));
                                                    setOptionPriceDrafts(d => ({
                                                      ...d,
                                                      [product.id]: '',
                                                    }));
                                                  },
                                                },
                                              );
                                            }}
                                          >
                                            Hinzufügen
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </SortableRow>
                              ))}
                            </div>
                          </SortableContext>
                        </section>
                      )}
                    </SortableRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirm != null}
        onOpenChange={open => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirm?.run();
                setConfirm(null);
              }}
            >
              Bestätigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tische */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Tische</CardTitle>
          {tables.length > 0 && (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={deleteAllTables.isPending}
                onClick={() =>
                  setConfirm({
                    title: 'Alle Tische löschen?',
                    description: runningSession
                      ? `Die Kasse läuft gerade. Alle ${tables.length} Tische verschwinden sofort aus der Tischauswahl im Service, laufende Bestellungen behalten ihren Tischnamen.`
                      : `Alle ${tables.length} Tische verschwinden aus der Auswahl. Laufende Bestellungen behalten ihren Tischnamen.`,
                    run: () => deleteAllTables.mutate(),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
                Alle löschen
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="kasse-area" className="text-xs">
                Bereich
              </Label>
              <Input
                id="kasse-area"
                value={tableRange.area}
                onChange={e =>
                  setTableRange(r => ({ ...r, area: e.target.value }))
                }
                className="w-20"
                maxLength={10}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kasse-from" className="text-xs">
                von
              </Label>
              <Input
                id="kasse-from"
                value={tableRange.from}
                onChange={e =>
                  setTableRange(r => ({ ...r, from: e.target.value }))
                }
                className="w-20"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kasse-to" className="text-xs">
                bis
              </Label>
              <Input
                id="kasse-to"
                value={tableRange.to}
                onChange={e =>
                  setTableRange(r => ({ ...r, to: e.target.value }))
                }
                className="w-20"
                inputMode="numeric"
              />
            </div>
            <Button
              variant="outline"
              disabled={createTableRange.isPending}
              onClick={() => {
                const from = Number(tableRange.from);
                const to = Number(tableRange.to);
                if (!tableRange.area.trim() || !from || !to) {
                  toast.error('Bereich, von und bis ausfüllen.');
                  return;
                }
                createTableRange.mutate({
                  area: tableRange.area.trim(),
                  from,
                  to,
                });
              }}
            >
              Reihe anlegen
            </Button>

            <div className="ml-auto flex gap-2">
              <Input
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                placeholder="Einzelner Tisch"
                className="w-40"
                maxLength={20}
              />
              <Button
                variant="outline"
                disabled={!tableName.trim() || createTable.isPending}
                onClick={() =>
                  createTable.mutate(
                    { name: tableName.trim(), displayOrder: tables.length },
                    { onSuccess: () => setTableName('') },
                  )
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {tables.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Tische erfasst.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tables.map(table => (
                <span
                  key={table.id}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    table.isActive ? '' : 'opacity-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      updateTable.mutate({
                        id: table.id,
                        isActive: !table.isActive,
                      })
                    }
                    className="font-medium"
                    title={table.isActive ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    {table.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Tisch ${table.name} löschen`}
                    onClick={() =>
                      setConfirm({
                        title: `Tisch „${table.name}“ löschen?`,
                        description:
                          'Der Tisch verschwindet aus der Auswahl. Laufende Bestellungen behalten ihren Tischnamen.',
                        run: () => deleteTable.mutate({ id: table.id }),
                      })
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auswertung */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Auswertung</CardTitle>
          {/* Für die Generalprobe: am Nachmittag ein paar Bestellungen
              durchspielen und vor dem Öffnen der Tore auf null stellen, ohne
              die Kasse neu anzulegen und QR-Codes neu zu verteilen. Der Dialog
              nennt die Kasse beim Namen — die Auswahl oben kann auf einem
              alten Event stehen. */}
          {statsSession && (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={clearSession.isPending}
                onClick={() =>
                  setConfirm({
                    title: `Auswertung von „${statsSession.name}“ zurücksetzen?`,
                    description:
                      `Alle ${statsOrderCount ?? 0} erfassten Bestellungen dieser Kasse werden gelöscht, Umsatz und Statistik stehen danach auf null. ` +
                      (statsSession.status === 'open'
                        ? 'Die Kasse bleibt offen, Links und QR-Codes gelten weiter — auch offene Bestellungen verschwinden aber aus Küche, Bar und Service. '
                        : '') +
                      'Rückgängig machen geht nicht.',
                    run: () =>
                      clearSession.mutate({ sessionId: statsSession.id }),
                  })
                }
              >
                <RotateCcw className="h-4 w-4" />
                Auswertung zurücksetzen
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Kasse geführt.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {settings.sessions.map(session => (
                  <Button
                    key={session.id}
                    size="sm"
                    variant={
                      statsSessionId === session.id ? 'default' : 'outline'
                    }
                    onClick={() => setStatsSessionId(session.id)}
                  >
                    {session.name}
                    {session.status === 'open' && ' ●'}
                  </Button>
                ))}
              </div>

              {stats && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-muted-foreground">Umsatz</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {formatChf(stats.revenueRappen)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-muted-foreground">
                        Bestellungen
                      </p>
                      <p className="text-2xl font-bold tabular-nums">
                        {stats.orderCount}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-muted-foreground">Storniert</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {stats.cancelledCount}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-muted-foreground">
                        Ø bis bereit
                      </p>
                      <p className="text-2xl font-bold tabular-nums">
                        {formatWait(stats.avgReadySeconds)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Bestellung → Küche fertig
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-muted-foreground">
                        Ø bis abgeschlossen
                      </p>
                      <p className="text-2xl font-bold tabular-nums">
                        {formatWait(stats.avgDeliveredSeconds)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Bestellung bis serviert oder abgeholt
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {stats.products.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                          Produkte
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produkt</TableHead>
                              <TableHead className="text-right">
                                Menge
                              </TableHead>
                              <TableHead className="text-right">
                                Umsatz
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stats.products.map(row => (
                              <TableRow key={row.productName}>
                                <TableCell>{row.productName}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {row.quantity}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatChf(row.revenueRappen)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Zusätze separat: eine Position kann mehrere haben, für
                        den Einkauf zählt der Verbrauch pro Zusatz. */}
                    {stats.options.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                          Zusätze
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Zusatz</TableHead>
                              <TableHead className="text-right">
                                Menge
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stats.options.map(row => (
                              <TableRow key={row.optionName}>
                                <TableCell>{row.optionName}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {row.quantity}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {stats.waiters.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                        Aufgenommen pro Service
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">
                              Bestellungen
                            </TableHead>
                            <TableHead className="text-right">Umsatz</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.waiters.map(row => (
                            <TableRow
                              // Ein Gerät kann sich „ohne Name" nennen, ein
                              // fester Platzhalter wäre also kollidierbar.
                              key={
                                row.waiterName == null
                                  ? '\u0000null'
                                  : `n:${row.waiterName}`
                              }
                            >
                              <TableCell>
                                {row.waiterName ?? (
                                  <span className="text-muted-foreground">
                                    ohne Name
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.orderCount}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatChf(row.revenueRappen)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Der Name stammt vom Gerät des Service. Gross- und
                        Kleinschreibung werden zusammengefasst, unterschiedliche
                        Schreibweisen nicht. Stornierte Bestellungen zählen
                        nicht mit.
                      </p>
                    </div>
                  )}

                  {statsSessionId != null &&
                    settings.openSession?.id !== statsSessionId && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setConfirm({
                              title: 'Diese Kasse wieder öffnen?',
                              description:
                                'Eine laufende Kasse wird dabei geschlossen. Sind dort noch Bestellungen offen, werden sie storniert. Sie verschwinden aus Küche und Service und zählen nicht zum Umsatz.',
                              run: () =>
                                reopenSession.mutate({
                                  sessionId: statsSessionId,
                                  force: true,
                                }),
                            })
                          }
                        >
                          Wieder öffnen
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                              Löschen
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Kasse löschen?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Alle Bestellungen dieses Events werden
                                unwiderruflich gelöscht. Die Auswertung ist
                                danach weg.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  deleteSession.mutate({
                                    sessionId: statsSessionId,
                                  })
                                }
                              >
                                Löschen
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
