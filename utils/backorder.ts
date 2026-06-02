import type { CartItem, Product } from "../types";

export const BACKORDER_NOTICE =
  "Produto sob encomenda: prazo mínimo de espera de 7 dias úteis.";

export const BACKORDER_SHORT_NOTICE = "Prazo mínimo: 7 dias úteis";

const getNumericField = (
  product: Product | CartItem,
  fieldNames: string[],
): number | null => {
  const record = product as Record<string, unknown>;

  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    if (value === undefined || value === null || value === "") continue;

    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return null;
};

export const getAvailableStock = (product: Product | CartItem) => {
  const stock = getNumericField(product, ["stock", "estoque"]);
  const stockAvailable = getNumericField(product, [
    "stock_available",
    "stockAvailable",
    "availableStock",
    "available_stock",
    "estoqueDisponivel",
    "estoque_disponivel",
  ]);

  if (stock !== null && stockAvailable !== null) {
    return Math.min(stock, stockAvailable);
  }

  return stockAvailable ?? stock;
};

export const isProductBackorder = (product: Product | CartItem) => {
  const availableStock = getAvailableStock(product);
  const record = product as Record<string, unknown>;
  return (
    Boolean(product.isBackorder || record.is_backorder || record.backorder) ||
    (availableStock !== null && availableStock <= 0)
  );
};

export const isCartItemBackorder = (item: CartItem) => {
  const availableStock = getAvailableStock(item);
  return (
    isProductBackorder(item) ||
    (availableStock !== null && item.quantity > availableStock)
  );
};

export const getBackorderQuantity = (item: CartItem) => {
  const availableStock = getAvailableStock(item);

  if (availableStock === null) {
    return item.isBackorder ? item.quantity : 0;
  }

  return Math.max(item.quantity - Math.max(availableStock, 0), 0);
};
