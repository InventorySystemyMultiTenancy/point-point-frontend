// Estrutura do histórico de movimentações de estoque
export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  date: string; // ISO string
}

// Utilitário para salvar e buscar do localStorage
export const STOCK_MOVEMENTS_KEY = "primeplush_stock_movements";

export function getStockMovements(): StockMovement[] {
  const data = localStorage.getItem(STOCK_MOVEMENTS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function addStockMovement(movement: StockMovement) {
  const list = getStockMovements();
  list.push(movement);
  localStorage.setItem(STOCK_MOVEMENTS_KEY, JSON.stringify(list));
}

export function filterStockMovementsByDate(
  start: string,
  end: string,
): StockMovement[] {
  const list = getStockMovements();
  const startDate = new Date(start);
  const endDate = new Date(end);
  return list.filter((m) => {
    const d = new Date(m.date);
    return d >= startDate && d <= endDate;
  });
}
