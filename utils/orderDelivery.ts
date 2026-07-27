import type { Order, OrderItem } from "../types";

export const getDeliveredQuantity = (order: Order, productId: string): number => {
  const entry = (order.deliveredItems || []).find(
    (item) => item.productId === productId,
  );
  return entry ? Number(entry.quantity) || 0 : 0;
};

export const getRemainingQuantity = (order: Order, item: OrderItem): number => {
  const remainingEntry = (order.remainingItems || []).find(
    (entry) => entry.productId === item.productId,
  );
  if (remainingEntry) return Math.max(0, Number(remainingEntry.quantity) || 0);
  const ordered = Number(item.quantity) || 0;
  return Math.max(0, ordered - getDeliveredQuantity(order, item.productId));
};

export const isFullyDelivered = (order: Order): boolean => {
  if (order.entregueCliente) return true;
  if (!order.items?.length) return false;
  return order.items.every((item) => getRemainingQuantity(order, item) === 0);
};

export const getOrderDeliveryProgress = (
  order: Order,
): { delivered: number; total: number } => {
  const total = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const remaining = (order.items || []).reduce(
    (sum, item) => sum + getRemainingQuantity(order, item),
    0,
  );
  return { delivered: Math.max(0, total - remaining), total };
};

export const hasPartialDelivery = (order: Order): boolean => {
  const { delivered, total } = getOrderDeliveryProgress(order);
  return delivered > 0 && delivered < total;
};
