import { TRPCError } from '@trpc/server';
import type { NewOrderItem } from './kasse_db';

/**
 * Preisberechnung einer Bestellung — bewusst als reine Funktion ausgelagert,
 * damit sie ohne DB testbar ist. Der Client schickt nur Produkt-, Options- und
 * Mengenangaben; jeder Preis kommt aus diesen (aus der DB geladenen) Listen.
 *
 * Eine Position kann mehrere Zusätze haben (Senf *und* Mayo). Der Stückpreis
 * ist der Produktpreis plus die Aufpreise aller gewählten Zusätze — ohne
 * Zusatz also schlicht der Produktpreis.
 */

export type PricingProduct = {
  id: number;
  name: string;
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

    // Doppelte IDs würden den Aufpreis mehrfach berechnen — der Zusatz ist
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
    // einen negativen Aufpreis haben („ohne Beilage") und mehrere davon
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
