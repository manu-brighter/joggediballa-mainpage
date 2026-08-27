import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { usePermission } from '@/hooks/usePermissions';
import { SEO } from '@/components/SEO';
import { StyledQr } from '@/components/StyledQr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatChf, parseChfToRappen } from '@/lib/kasse';
import {
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
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
      toast.success('Neuer Token — alte Links und QR-Codes sind ungültig.');
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
    onSuccess: invalidateSettings,
    onError,
  });
  const reopenSession = trpc.kasse.reopenSession.useMutation({
    onSuccess: invalidateSettings,
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

  // Formular-Drafts
  const [sessionName, setSessionName] = useState('');
  const [productDraft, setProductDraft] = useState({
    name: '',
    category: '',
    price: '',
  });
  const [optionDrafts, setOptionDrafts] = useState<Record<number, string>>({});
  const [tableRange, setTableRange] = useState({
    area: 'A',
    from: '1',
    to: '10',
  });
  const [tableName, setTableName] = useState('');

  if (!canManage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <SEO title="Kasse — Verwaltung" noIndex />
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
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const serviceUrl = `${origin}/kasse/service/${settings.accessToken}`;
  const kuecheUrl = `${origin}/kasse/kueche/${settings.accessToken}`;

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
      <SEO title="Kasse — Verwaltung" noIndex />

      <div>
        <h1 className="text-2xl font-bold">Kassensystem</h1>
        <p className="text-sm text-muted-foreground">
          Produkte, Tische und Auswertung. Service und Küche arbeiten über die
          Links unten — dort braucht es keinen Login.
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
              <Button
                variant="outline"
                disabled={closeSession.isPending}
                onClick={() =>
                  closeSession.mutate({ sessionId: runningSession.id })
                }
              >
                Kasse schliessen
              </Button>
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
          <CardTitle className="text-lg">Zugang für Service & Küche</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium">Service (Handy)</p>
              <div className="flex justify-center rounded-lg border p-4">
                <StyledQr value={serviceUrl} size={150} />
              </div>
              <CopyableLink url={serviceUrl} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Küche (Tablet)</p>
              <div className="flex justify-center rounded-lg border p-4">
                <StyledQr value={kuecheUrl} size={150} />
              </div>
              <CopyableLink url={kuecheUrl} />
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
            <div className="space-y-3">
              {products.map(product => (
                <div key={product.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
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
                        aria-label={`${product.name} löschen`}
                        onClick={() => deleteProduct.mutate({ id: product.id })}
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
                            {option.priceDeltaRappen !== 0 && (
                              <span className="text-xs text-muted-foreground">
                                {option.priceDeltaRappen > 0 ? '+' : '−'}
                                {formatChf(Math.abs(option.priceDeltaRappen))}
                              </span>
                            )}
                            <button
                              type="button"
                              aria-label={`${option.name} entfernen`}
                              onClick={() =>
                                deleteOption.mutate({ id: option.id })
                              }
                              className="text-muted-foreground hover:text-destructive"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
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
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!optionDrafts[product.id]?.trim()}
                        onClick={() =>
                          createOption.mutate(
                            {
                              productId: product.id,
                              name: (optionDrafts[product.id] ?? '').trim(),
                              displayOrder: product.options.length,
                            },
                            {
                              onSuccess: () =>
                                setOptionDrafts(d => ({
                                  ...d,
                                  [product.id]: '',
                                })),
                            },
                          )
                        }
                      >
                        Hinzufügen
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tische */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Tische</CardTitle>
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
                    onClick={() => deleteTable.mutate({ id: table.id })}
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
                  <div className="grid gap-3 sm:grid-cols-3">
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
                  </div>

                  {stats.products.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 font-medium">Produkt</th>
                            <th className="py-2 font-medium">Zusatz</th>
                            <th className="py-2 text-right font-medium">
                              Menge
                            </th>
                            <th className="py-2 text-right font-medium">
                              Umsatz
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.products.map(row => (
                            <tr
                              key={`${row.productName}:${row.optionName ?? ''}`}
                              className="border-b last:border-0"
                            >
                              <td className="py-2">{row.productName}</td>
                              <td className="py-2 text-muted-foreground">
                                {row.optionName ?? '—'}
                              </td>
                              <td className="py-2 text-right tabular-nums">
                                {row.quantity}
                              </td>
                              <td className="py-2 text-right tabular-nums">
                                {formatChf(row.revenueRappen)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {statsSessionId != null &&
                    settings.openSession?.id !== statsSessionId && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            reopenSession.mutate({ sessionId: statsSessionId })
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
