import type { CartItem, Product } from "../types";

export const isImportedCategory = (category?: string | null) =>
  String(category || "").trim().toLowerCase() === "importados";

export const isImportedProduct = (product: Product | CartItem) =>
  isImportedCategory(product.category);

export const canSeeImportedCatalog = (fullAccess?: boolean | null) =>
  Boolean(fullAccess);

export const filterPrivateCatalog = <T extends { category?: string; name?: string }>(
  items: T[],
  fullAccess?: boolean | null,
) =>
  canSeeImportedCatalog(fullAccess)
    ? items
    : items.filter((item) => !isImportedCategory(item.category || item.name));
