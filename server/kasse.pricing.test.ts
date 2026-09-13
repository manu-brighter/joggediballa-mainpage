/**
 * Preisberechnung der Kasse, reine Funktion, keine DB. Deckt die
 * geldkritischen Fälle ab: Preise kommen immer vom Server, Zusätze müssen zum
 * Produkt gehören, und Beträge bleiben ganzzahlig in Rappen.
 */
import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import {
  buildOrderItems,
  groupItemsByStation,
  orderTotalRappen,
  type PricingOption,
  type PricingProduct,
} from './kasse_pricing';

const products: PricingProduct[] = [
  {
    id: 1,
    name: 'Pommes Frites',
    categoryName: 'Food',
    station: 'kueche',
    priceRappen: 600,
    isActive: true,
  },
  {
    id: 2,
    name: 'Bier',
    categoryName: 'Drinks',
    station: 'bar',
    priceRappen: 450,
    isActive: true,
  },
  {
    id: 3,
    name: 'Suppe',
    categoryName: 'Food',
    station: 'kueche',
    priceRappen: 500,
    isActive: false,
  },
  {
    id: 4,
    name: 'Kaffee',
    categoryName: 'Weiteres',
    station: 'kueche',
    priceRappen: 350,
    isActive: true,
  },
];

const options: PricingOption[] = [
  {
    id: 10,
    productId: 1,
    name: 'Ketchup',
    priceDeltaRappen: 0,
    isActive: true,
  },
  { id: 11, productId: 1, name: 'Mayo', priceDeltaRappen: 50, isActive: true },
  {
    id: 12,
    productId: 2,
    name: 'Gross',
    priceDeltaRappen: 150,
    isActive: true,
  },
  {
    id: 13,
    productId: 1,
    name: 'Trüffelmayo',
    priceDeltaRappen: 200,
    isActive: false,
  },
];

describe('buildOrderItems', () => {
  it('rechnet Menge × Produktpreis ohne Zusatz', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, quantity: 3 },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].unitPriceRappen).toBe(600);
    expect(items[0].lineTotalRappen).toBe(1800);
    expect(items[0].options).toEqual([]);
  });

  it('schlägt den Options-Aufpreis auf den Stückpreis', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, optionIds: [11], quantity: 2 },
    ]);
    expect(items[0].unitPriceRappen).toBe(650);
    expect(items[0].lineTotalRappen).toBe(1300);
    expect(items[0].options.map(o => o.optionName)).toEqual(['Mayo']);
  });

  it('schreibt Namen als Snapshot in die Position', () => {
    const items = buildOrderItems(products, options, [
      { productId: 2, optionIds: [12], quantity: 1 },
    ]);
    expect(items[0].productName).toBe('Bier');
    expect(items[0].options.map(o => o.optionName)).toEqual(['Gross']);
  });

  it('summiert mehrere Positionen', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, optionIds: [10], quantity: 3 }, // 3 × 6.00
      { productId: 2, quantity: 5 }, // 5 × 4.50
      { productId: 2, optionIds: [12], quantity: 1 }, // 1 × 6.00
    ]);
    expect(orderTotalRappen(items)).toBe(1800 + 2250 + 600);
  });

  it('lehnt ein unbekanntes Produkt ab', () => {
    expect(() =>
      buildOrderItems(products, options, [{ productId: 999, quantity: 1 }]),
    ).toThrow(TRPCError);
  });

  it('lehnt ein inaktives Produkt ab', () => {
    expect(() =>
      buildOrderItems(products, options, [{ productId: 3, quantity: 1 }]),
    ).toThrow(TRPCError);
  });

  it('lehnt einen Zusatz ab, der zu einem anderen Produkt gehört', () => {
    expect(() =>
      buildOrderItems(products, options, [
        { productId: 1, optionIds: [12], quantity: 1 },
      ]),
    ).toThrow(/Unbekannter Zusatz/);
  });

  it('lehnt einen deaktivierten Zusatz ab', () => {
    expect(() =>
      buildOrderItems(products, options, [
        { productId: 1, optionIds: [13], quantity: 1 },
      ]),
    ).toThrow(/Unbekannter Zusatz/);
  });

  it('bleibt bei Rappen-Beträgen ganzzahlig', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, optionIds: [11], quantity: 7 },
    ]);
    expect(Number.isInteger(items[0].lineTotalRappen)).toBe(true);
    expect(items[0].lineTotalRappen).toBe(4550);
  });

  it('ergibt bei leerer Bestellung ein Total von 0', () => {
    expect(orderTotalRappen(buildOrderItems(products, options, []))).toBe(0);
  });

  it('summiert die Aufpreise mehrerer Zusätze auf einer Position', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, optionIds: [10, 11], quantity: 2 }, // 6.00 + 0 + 0.50
    ]);
    expect(items[0].unitPriceRappen).toBe(650);
    expect(items[0].lineTotalRappen).toBe(1300);
    expect(items[0].options.map(o => o.optionName)).toEqual([
      'Ketchup',
      'Mayo',
    ]);
  });

  it('hält den Preis-Snapshot jedes gewählten Zusatzes fest', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, optionIds: [11], quantity: 1 },
    ]);
    expect(items[0].options).toEqual([
      { optionId: 11, optionName: 'Mayo', priceDeltaRappen: 50 },
    ]);
  });

  it('zählt einen doppelt geschickten Zusatz nur einmal', () => {
    // Ein Handy, das dieselbe Option zweimal in die Liste legt, darf den
    // Aufpreis nicht verdoppeln, gewählt ist gewählt.
    const items = buildOrderItems(products, options, [
      { productId: 1, optionIds: [11, 11], quantity: 1 },
    ]);
    expect(items[0].unitPriceRappen).toBe(650);
    expect(items[0].options).toHaveLength(1);
  });

  it('lehnt die ganze Position ab, wenn einer von mehreren Zusätzen fremd ist', () => {
    expect(() =>
      buildOrderItems(products, options, [
        { productId: 1, optionIds: [11, 12], quantity: 1 },
      ]),
    ).toThrow(/Unbekannter Zusatz/);
  });

  it('lässt den Stückpreis nicht unter null fallen', () => {
    // Zusätze dürfen einen Abschlag tragen; mehrere kombiniert könnten den
    // Produktpreis sonst unterschreiten und der Umsatz der Session sänke.
    const abschlaege: PricingOption[] = [
      {
        id: 20,
        productId: 1,
        name: 'ohne Beilage',
        priceDeltaRappen: -500,
        isActive: true,
      },
      {
        id: 21,
        productId: 1,
        name: 'ohne Sauce',
        priceDeltaRappen: -300,
        isActive: true,
      },
    ];
    const items = buildOrderItems(products, abschlaege, [
      { productId: 1, optionIds: [20, 21], quantity: 2 },
    ]);
    expect(items[0].unitPriceRappen).toBe(0);
    expect(items[0].lineTotalRappen).toBe(0);
    expect(orderTotalRappen(items)).toBe(0);
  });

  it('nimmt eine leere Zusatzliste wie „ohne Zusatz“', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, optionIds: [], quantity: 1 },
    ]);
    expect(items[0].unitPriceRappen).toBe(600);
    expect(items[0].options).toEqual([]);
  });
});

describe('Kategorie-Snapshot', () => {
  it('schreibt den Kategorie-Namen des Produkts in die Position', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 2 },
    ]);
    expect(items.map(i => i.productCategory)).toEqual(['Food', 'Drinks']);
  });
});

describe('groupItemsByStation', () => {
  it('lässt eine reine Küchen-Bestellung unangetastet als eine Gruppe', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, quantity: 2 },
      { productId: 4, quantity: 1 },
    ]);
    const groups = groupItemsByStation(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].station).toBe('kueche');
    expect(groups[0].items).toHaveLength(2);
  });

  it('teilt eine gemischte Bestellung in Küche und Bar auf', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, quantity: 1 }, // Food -> Küche
      { productId: 2, quantity: 3 }, // Drinks -> Bar
    ]);
    const groups = groupItemsByStation(items);
    expect(groups.map(g => g.station)).toEqual(['kueche', 'bar']);
    expect(groups[0].items.map(i => i.productName)).toEqual(['Pommes Frites']);
    expect(groups[1].items.map(i => i.productName)).toEqual(['Bier']);
  });

  it('summiert pro Station unabhängig, das Gesamttotal bleibt gleich', () => {
    const items = buildOrderItems(products, options, [
      { productId: 1, quantity: 2 }, // 2 x 6.00 = 12.00 Küche
      { productId: 2, quantity: 1 }, // 1 x 4.50 = 4.50 Bar
    ]);
    const groups = groupItemsByStation(items);
    const totals = groups.map(g => orderTotalRappen(g.items));
    expect(totals).toEqual([1200, 450]);
    expect(totals.reduce((a, b) => a + b, 0)).toBe(orderTotalRappen(items));
  });
});
