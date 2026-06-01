// Serviço de API para Categorias com Multi-tenant
import { authenticatedFetch, catalogFetch } from "./apiService";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const API_URL = `${BASE_URL}/api`;

export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
  store_id: string;
  source?: "categories" | "products" | string;
}

/**
 * Busca todas as categorias da loja atual (público)
 */
export async function getCategories(
  options: { catalog?: boolean } = {},
): Promise<Category[]> {
  try {
    const url = `${API_URL}/categories${options.catalog ? "?catalog=true" : ""}`;
    const response = options.catalog
      ? await catalogFetch(url)
      : await authenticatedFetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ Erro ao buscar categorias (${response.status}):`,
        errorText
      );
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const categories = Array.isArray(data)
      ? data
      : Array.isArray(data.categories)
        ? data.categories
        : Array.isArray(data.data)
          ? data.data
          : [];

    if (!Array.isArray(categories)) {
      console.error("❌ Backend retornou dados inválidos (não é array):", data);
      return [];
    }

    return categories;
  } catch (error) {
    console.error("❌ Erro ao buscar categorias:", error);
    return [];
  }
}

/**
 * Cria uma nova categoria (autenticado - admin)
 */
export async function createCategory(categoryData: {
  name: string;
  icon?: string;
  order?: number;
}): Promise<Category> {
  const response = await authenticatedFetch(`${API_URL}/categories`, {
    method: "POST",
    body: JSON.stringify(categoryData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.error || error.message || "Erro ao criar categoria";
    if (response.status === 409 || String(message).includes("Categoria já existe")) {
      throw new Error(
        "Essa categoria já existe. Ela já está disponível para seleção.",
      );
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Atualiza uma categoria existente (autenticado - admin)
 */
export async function updateCategory(
  categoryId: string,
  categoryData: {
    name?: string;
    icon?: string;
    order?: number;
  }
): Promise<Category> {
  const response = await authenticatedFetch(
    `${API_URL}/categories/${categoryId}`,
    {
      method: "PUT",
      body: JSON.stringify(categoryData),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao atualizar categoria");
  }

  return response.json();
}

/**
 * Deleta uma categoria (autenticado - admin)
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  const response = await authenticatedFetch(
    `${API_URL}/categories/${categoryId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao deletar categoria");
  }
}
