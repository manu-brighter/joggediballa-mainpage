import { TRPCError } from '@trpc/server';
import type { KasseStationId, NewOrderItem } from './kasse_db';

/**
 * Preisberechnung einer Bestellung, bewusst als reine Funktion ausgelagert,
 * damit sie ohne DB testbar ist. Der Client schickt nur Produkt-, Options- und
 * Mengenangaben; jeder Preis kommt aus diesen (aus der DB geladenen) Listen.
 *
 * Eine Position kann mehrere Zusätze haben (Senf *und* Mayo). Der Stückpreis
 * ist der Produktpreis plus die Aufpreise aller gewählten Zusätze, ohne
 * Zusatz also schlicht der Produktpreis.
 */

export type PricingProduct = {
  id: number;
  name: string;
  categoryName: string;
  station: KasseStationId;
  priceRappen: number;
  isActive: boolean;
};

export type PricingOption = {
  id: number;
  productId: number;
  name: string;
  priceDeltaRappen: number;
  isActive: boolean;
};

export type OrderLineInput = {
  productId: number;
  optionIds?: number[] | null;
  quantity: number;
};

export function buildOrderItems(
  products: PricingProduct[],
  options: PricingOption[],
  lines: OrderLineInput[],
): NewOrderItem[] {
  const items: NewOrderItem[] = [];

  for (const line of lines) {
    const product = products.find(p => p.id === line.productId && p.isActive);
    if (!product) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Unbekanntes Produkt',
      });
    }

    // Doppelte IDs würden den Aufpreis mehrfach berechnen. Der Zusatz ist
    // gewählt oder nicht, eine Menge gibt es auf dieser Ebene nicht.
    const optionIds = Array.from(new Set(line.optionIds ?? []));
    const chosen = optionIds.map(optionId => {
      const option = options.find(
        o => o.id === optionId && o.productId === product.id && o.isActive,
      );
      if (!option) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unbekannter Zusatz für ${product.name}`,
        });
      }
      return {
        optionId: option.id,
        optionName: option.name,
        priceDeltaRappen: option.priceDeltaRappen,
      };
    });

    // Abschläge dürfen den Preis nicht unter null drücken: Zusätze können
    // einen negativen Aufpreis haben („ohne Beilage“) und mehrere davon
    // kombiniert ergäben sonst eine Position mit negativem Betrag, die sich
    // direkt vom Umsatz der Session abzieht.
    const unitPriceRappen = Math.max(
      0,
      product.priceRappen +
        chosen.reduce((sum, o) => sum + o.priceDeltaRappen, 0),
    );

    items.push({
      productId: product.id,
      productName: product.name,
      // Kategorie-Name als Snapshot mitschreiben, wie productName/optionName:
      // benennt oder verschiebt jemand die Kategorie später, darf sich die
      // Anzeige einer bereits abgeschickten Bestellung nicht rückwirkend
      // ändern. `station` ist dagegen kein Snapshot auf der Position, sondern
      // nur transient hier — sie entscheidet, in welche Order (siehe
      // groupItemsByStation) diese Position beim Anlegen wandert.
      productCategory: product.categoryName,
      station: product.station,
      quantity: line.quantity,
      unitPriceRappen,
      lineTotalRappen: unitPriceRappen * line.quantity,
      options: chosen,
    });
  }

  return items;
}

export function orderTotalRappen(items: NewOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.lineTotalRappen, 0);
}

/**
 * Teilt die Positionen einer Bestellung nach Station auf. Eine gemischte
 * Bestellung (Food + Drinks) wird so beim Senden zu einer Order pro
 * betroffener Station statt einer einzigen Order mit einem gemeinsamen
 * Status — die Bar konnte sonst die ganze Bestellung auf „bereit“ setzen,
 * während das Essen in der Küche noch offen war.
 *
 * Reihenfolge deterministisch (Küche vor Bar), damit Tests und Anzeige nicht
 * von der Item-Reihenfolge im Warenkorb abhängen.
 */
export function groupItemsByStation(
  items: NewOrderItem[],
): Array<{ station: KasseStationId; items: NewOrderItem[] }> {
  const groups = new Map<KasseStationId, NewOrderItem[]>();
  for (const item of items) {
    const list = groups.get(item.station);
    if (list) list.push(item);
    else groups.set(item.station, [item]);
  }
  const order: KasseStationId[] = ['kueche', 'bar'];
  const result: Array<{ station: KasseStationId; items: NewOrderItem[] }> = [];
  for (const station of order) {
    const stationItems = groups.get(station);
    if (stationItems) result.push({ station, items: stationItems });
  }
  return result;
}
