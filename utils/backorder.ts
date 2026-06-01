import type { CartItem, Product } from "../types";

export const BACKORDER_NOTICE =
  "Produto sob encomenda: prazo mínimo de espera de 7 dias úteis.";

export const BACKORDER_SHORT_NOTICE = "Prazo mínimo: 7 dias úteis";

export const getAvailableStock = (product: Product | CartItem) => {
  if (product.stock_available !== undefined && product.stock_available !== null) {
    return Number(product.stock_available);
  }

  if (product.stock !== undefined && product.stock !== null) {
    return Number(product.stock);
  }

  return null;
};

export const isProductBackorder = (product: Product | CartItem) => {
  const availableStock = getAvailableStock(product);
  return Boolean(product.isBackorder) || (availableStock !== null && availableStock <= 0);
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
