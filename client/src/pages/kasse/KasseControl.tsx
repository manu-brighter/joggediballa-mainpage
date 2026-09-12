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
import { formatChf, formatWait, parseChfToRappen } from '@/lib/kasse';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const STATION_LABEL: Record<'kueche' | 'bar', string> = {
  kueche: 'Küche',
  bar: 'Bar',
};

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
        <Copy className="size-4" />
      </Button>
      <Button variant="outline" size="icon" asChild aria-label="Link öffnen">
        <a href={url} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" />
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
  const { data: categories = [] } = trpc.kasse.listCategories.useQuery(
    undefined,
    { enabled: canManage },
  );
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

  const categoryById = useMemo(
    () => new Map(categories.map(c => [c.id, c])),
    [categories],
  );

  /**
   * Produkte nach Kategorie gruppiert, sortiert nach der Reihenfolge der
   * Kategorien selbst (siehe Kategorien-Karte), nicht mehr nach der
   * Reihenfolge, in der ein Produkt zuerst auftaucht — die Kategorie ist seit
   * dem Stations-Split eine eigene Entität mit eigener `displayOrder`.
   */
  const groups = useMemo(() => {
    const map = new Map<number, { items: typeof products }>();
    for (const product of products) {
      const group = map.get(product.categoryId);
      if (group) group.items.push(product);
      else map.set(product.categoryId, { items: [product] });
    }
    return Array.from(map, ([categoryId, group]) => ({
      categoryId,
      key: String(categoryId),
      label: categoryById.get(categoryId)?.name ?? 'Unbekannt',
      station: categoryById.get(categoryId)?.station,
      ...group,
    })).sort(
      (a, b) =>
        (categoryById.get(a.categoryId)?.displayOrder ?? 0) -
        (categoryById.get(b.categoryId)?.displayOrder ?? 0),
    );
  }, [products, categoryById]);

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
  const invalidateCategories = () => utils.kasse.listCategories.invalidate();
  const invalidateProducts = () => utils.kasse.listProducts.invalidate();
  const invalidateTables = () => utils.kasse.listTables.invalidate();
  const onError = (e: { message: string }) => toast.error(e.message);

  const createCategory = trpc.kasse.createCategory.useMutation({
    onSuccess: invalidateCategories,
    onError,
  });
  const updateCategory = trpc.kasse.updateCategory.useMutation({
    onSuccess: invalidateCategories,
    onError,
  });
  const reorderCategories = trpc.kasse.reorderCategories.useMutation({
    onSuccess: invalidateCategories,
    onError: e => {
      toast.error(e.message);
      invalidateCategories();
    },
  });
  const deleteCategory = trpc.kasse.deleteCategory.useMutation({
    onSuccess: invalidateCategories,
    onError,
  });

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
    categoryId: '',
    price: '',
  });
  const [optionDrafts, setOptionDrafts] = useState<Record<number, string>>({});
  // Produkt in Bearbeitung. Nur eines gleichzeitig, damit ein angefangener
  // Preis nicht in einer zweiten offenen Zeile untergeht.
  const [editProductId, setEditProductId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    categoryId: '',
    price: '',
  });
  const [categoryDraft, setCategoryDraft] = useState<{
    name: string;
    station: 'kueche' | 'bar';
  }>({ name: '', station: 'kueche' });
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [categoryEditDraft, setCategoryEditDraft] = useState<{
    name: string;
    station: 'kueche' | 'bar';
  }>({ name: '', station: 'kueche' });
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
      categoryId: String(product.categoryId),
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
    const categoryId = Number(editDraft.categoryId);
    if (!editDraft.name.trim() || priceRappen == null || !categoryId) {
      toast.error(
        'Name, Kategorie und ein gültiger Preis (z. B. 8.50) sind nötig.',
      );
      return;
    }
    updateProduct.mutate(
      {
        id: editProductId,
        name: editDraft.name.trim(),
        categoryId,
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

  /**
   * Nur Produkte innerhalb ihrer eigenen Kategorie lassen sich ziehen — die
   * Reihenfolge der Kategorien selbst gehört der Kategorien-Karte (eigene
   * `displayOrder`), nicht länger dieser Liste hier.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    if (!activeId.startsWith('product:') || !overId.startsWith('product:')) {
      return;
    }

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
  };

  const submitProduct = () => {
    const priceRappen = parseChfToRappen(productDraft.price);
    const categoryId = Number(productDraft.categoryId);
    if (!productDraft.name.trim() || priceRappen == null || !categoryId) {
      toast.error(
        'Name, Kategorie und ein gültiger Preis (z. B. 8.50) sind nötig.',
      );
      return;
    }
    createProduct.mutate(
      {
        name: productDraft.name.trim(),
        categoryId,
        priceRappen,
        displayOrder: products.length,
      },
      {
        onSuccess: () =>
          setProductDraft({ name: '', categoryId: '', price: '' }),
      },
    );
  };

  const submitCategory = () => {
    if (!categoryDraft.name.trim()) {
      toast.error('Ein Name ist nötig.');
      return;
    }
    createCategory.mutate(
      {
        name: categoryDraft.name.trim(),
        station: categoryDraft.station,
        displayOrder: categories.length,
      },
      {
        onSuccess: () => setCategoryDraft({ name: '', station: 'kueche' }),
      },
    );
  };

  const startEditCategory = (category: (typeof categories)[number]) => {
    setEditCategoryId(category.id);
    setCategoryEditDraft({ name: category.name, station: category.station });
  };

  const submitCategoryEdit = () => {
    if (editCategoryId == null) return;
    if (!categoryEditDraft.name.trim()) {
      toast.error('Ein Name ist nötig.');
      return;
    }
    updateCategory.mutate(
      {
        id: editCategoryId,
        name: categoryEditDraft.name.trim(),
        station: categoryEditDraft.station,
      },
      { onSuccess: () => setEditCategoryId(null) },
    );
  };

  const applyCategoryOrder = (ids: number[]) => {
    const rank = new Map(ids.map((id, index) => [id, index]));
    utils.kasse.listCategories.setData(undefined, prev =>
      prev
        ? [...prev].sort(
            (a, b) =>
              (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
              (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
          )
        : prev,
    );
    reorderCategories.mutate({ ids });
  };

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const activeId = Number(event.active.id);
    const overId = event.over ? Number(event.over.id) : null;
    if (overId == null || activeId === overId) return;
    const from = categories.findIndex(c => c.id === activeId);
    const to = categories.findIndex(c => c.id === overId);
    if (from === -1 || to === -1) return;
    applyCategoryOrder(arrayMove(categories, from, to).map(c => c.id));
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
                <RefreshCw className="mr-2 size-4" />
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

      {/* Kategorien */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Kategorien</CardTitle>
          <p className="text-xs text-muted-foreground">
            Jede Kategorie gehört fix zu einer Station. Eine Bestellung mit
            Produkten mehrerer Stationen wird beim Senden im Service automatisch
            in ein Ticket pro Station aufgeteilt — deshalb muss hier vor dem
            Event stimmen, was zu Küche und was zur Bar gehört.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={categoryDraft.name}
              onChange={e =>
                setCategoryDraft(d => ({ ...d, name: e.target.value }))
              }
              placeholder="Kategorie, z. B. Drinks"
              className="flex-1 min-w-[12rem]"
              maxLength={50}
            />
            <Select
              value={categoryDraft.station}
              onValueChange={v =>
                setCategoryDraft(d => ({
                  ...d,
                  station: v as 'kueche' | 'bar',
                }))
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kueche">Küche</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={submitCategory}
              disabled={createCategory.isPending}
            >
              <Plus className="mr-2 size-4" />
              Anlegen
            </Button>
          </div>

          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Kategorien erfasst.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCategoryDragEnd}
            >
              <SortableContext
                items={categories.map(c => String(c.id))}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {categories.map(category => (
                    <SortableRow key={category.id} id={String(category.id)}>
                      {handle => (
                        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
                          <DragHandle
                            label={`${category.name} verschieben`}
                            handle={handle}
                          />
                          {editCategoryId === category.id ? (
                            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                              <Input
                                value={categoryEditDraft.name}
                                onChange={e =>
                                  setCategoryEditDraft(d => ({
                                    ...d,
                                    name: e.target.value,
                                  }))
                                }
                                className="flex-1 min-w-[10rem]"
                                maxLength={50}
                                aria-label={`Name von ${category.name}`}
                              />
                              <Select
                                value={categoryEditDraft.station}
                                onValueChange={v =>
                                  setCategoryEditDraft(d => ({
                                    ...d,
                                    station: v as 'kueche' | 'bar',
                                  }))
                                }
                              >
                                <SelectTrigger
                                  className="w-32"
                                  aria-label={`Station von ${category.name}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="kueche">Küche</SelectItem>
                                  <SelectItem value="bar">Bar</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="icon"
                                aria-label="Änderungen speichern"
                                disabled={updateCategory.isPending}
                                onClick={submitCategoryEdit}
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="Bearbeiten abbrechen"
                                onClick={() => setEditCategoryId(null)}
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">
                                {category.name}
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {STATION_LABEL[category.station]}
                                </span>
                              </p>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Label
                                htmlFor={`category-active-${category.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Aktiv
                              </Label>
                              <Switch
                                id={`category-active-${category.id}`}
                                checked={category.isActive}
                                onCheckedChange={v =>
                                  updateCategory.mutate({
                                    id: category.id,
                                    isActive: v,
                                  })
                                }
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${category.name} bearbeiten`}
                              onClick={() =>
                                editCategoryId === category.id
                                  ? setEditCategoryId(null)
                                  : startEditCategory(category)
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${category.name} löschen`}
                              onClick={() =>
                                setConfirm({
                                  title: `„${category.name}“ löschen?`,
                                  description:
                                    'Geht nur, wenn kein Produkt mehr an dieser Kategorie hängt — sonst zuerst die Produkte umkategorisieren.',
                                  run: () =>
                                    deleteCategory.mutate({ id: category.id }),
                                })
                              }
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </SortableRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
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
            Kategorie. Die Reihenfolge der Kategorien selbst wird unten bei
            „Kategorien" gezogen. Genau so steht es danach im Service.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Zuerst unten mindestens eine Kategorie anlegen — jedes Produkt
              braucht eine, sie entscheidet, an welche Station (Küche/Bar) seine
              Bestellungen gehen.
            </p>
          ) : (
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
              <Select
                value={productDraft.categoryId}
                onValueChange={v =>
                  setProductDraft(d => ({ ...d, categoryId: v }))
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name} ({STATION_LABEL[category.station]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={productDraft.price}
                onChange={e =>
                  setProductDraft(d => ({ ...d, price: e.target.value }))
                }
                placeholder="8.50"
                inputMode="decimal"
                className="w-24"
              />
              <Button
                onClick={submitProduct}
                disabled={createProduct.isPending}
              >
                <Plus className="mr-2 size-4" />
                Anlegen
              </Button>
            </div>
          )}

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
              <div className="space-y-4">
                {groups.map(group => (
                  <section
                    key={group.key}
                    className="rounded-xl border bg-muted/40 p-3"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="min-w-0 truncate text-sm font-semibold uppercase tracking-wide">
                        {group.label}
                      </h3>
                      {group.station && (
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                          {STATION_LABEL[group.station]}
                        </span>
                      )}
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
                                      <Select
                                        value={editDraft.categoryId}
                                        onValueChange={v =>
                                          setEditDraft(d => ({
                                            ...d,
                                            categoryId: v,
                                          }))
                                        }
                                      >
                                        <SelectTrigger
                                          className="w-40"
                                          aria-label={`Kategorie von ${product.name}`}
                                        >
                                          <SelectValue placeholder="Kategorie" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {categories.map(category => (
                                            <SelectItem
                                              key={category.id}
                                              value={String(category.id)}
                                            >
                                              {category.name} (
                                              {STATION_LABEL[category.station]})
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
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
                                        <Check className="size-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Bearbeiten abbrechen"
                                        onClick={() => setEditProductId(null)}
                                      >
                                        <X className="size-4" />
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
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          {categoryById.get(product.categoryId)
                                            ?.name ?? 'Unbekannt'}
                                        </span>
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
                                      <Pencil className="size-4" />
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
                                      <Trash2 className="size-4 text-destructive" />
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
                                          {option.priceDeltaRappen !== 0 && (
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
                                      value={optionDrafts[product.id] ?? ''}
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
                                        optionPriceDrafts[product.id] ?? ''
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
                                        !optionDrafts[product.id]?.trim() ||
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
                                              optionDrafts[product.id] ?? ''
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
                ))}
              </div>
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
                <Trash2 className="size-4" />
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
                <Plus className="size-4" />
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
                <RotateCcw className="size-4" />
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
                              <Trash2 className="mr-2 size-4 text-destructive" />
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
