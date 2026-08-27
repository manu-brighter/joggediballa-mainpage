import { TRPCError } from '@trpc/server';
import type { NewOrderItem } from './kasse_db';

/**
 * Preisberechnung einer Bestellung — bewusst als reine Funktion ausgelagert,
 * damit sie ohne DB testbar ist. Der Client schickt nur Produkt-, Options- und
 * Mengenangaben; jeder Preis kommt aus diesen (aus der DB geladenen) Listen.
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
  optionId?: number | null;
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

    let option: PricingOption | null = null;
    if (line.optionId != null) {
      option =
        options.find(
          o =>
            o.id === line.optionId && o.productId === product.id && o.isActive,
        ) ?? null;
      if (!option) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unbekannter Zusatz für ${product.name}`,
        });
      }
    }

    const unitPriceRappen =
      product.priceRappen + (option?.priceDeltaRappen ?? 0);

    items.push({
      productId: product.id,
      productName: product.name,
      optionId: option?.id ?? null,
      optionName: option?.name ?? null,
      quantity: line.quantity,
      unitPriceRappen,
      lineTotalRappen: unitPriceRappen * line.quantity,
    });
  }

  return items;
}

export function orderTotalRappen(items: NewOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.lineTotalRappen, 0);
}
