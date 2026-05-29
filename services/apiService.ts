// Atualiza os dados do usuário (self-service)
export async function updateUser(userId: string, userData: any) {
  const response = await authenticatedFetch(`${API_URL}/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(userData),
  });
  return response.json();
}
// Serviço de API com autenticação JWT e Multi-tenant

import api from "./api";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const API_URL = `${BASE_URL}/api`;

/**
 * Pega o token JWT salvo no localStorage.
 */
export function getToken(): string | null {
  return localStorage.getItem("jwt_token");
}

/**
 * Salva o token JWT no localStorage.
 */
function saveToken(token: string): void {
  localStorage.setItem("jwt_token", token);
}

/**
 * Remove o token JWT do localStorage.
 */
export function logout(): void {
  localStorage.removeItem("jwt_token");
  console.log("Usuário deslogado.");
}

export interface DeleteOrderFromHistoryResponse {
  ok: boolean;
  message: string;
  orderId: string;
}

interface ApiHttpError extends Error {
  status?: number;
}

/**
 * Remove (soft delete) um pedido do histórico via rota administrativa.
 * Exige JWT de admin no header Authorization.
 */
export async function deleteOrderFromHistory(
  orderId: string,
  token: string,
): Promise<DeleteOrderFromHistoryResponse> {
  if (!token) {
    const error: ApiHttpError = new Error("Sessão expirada");
    error.status = 401;
    throw error;
  }

  const response = await fetch(`${API_URL}/admin/orders/history/${orderId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  let data: Partial<DeleteOrderFromHistoryResponse> = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error: ApiHttpError = new Error(
      data.message || `Erro ao excluir pedido (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return {
    ok: data.ok ?? true,
    message: data.message || "Pedido removido do histórico com sucesso",
    orderId: data.orderId || orderId,
  };
}

/**
 * Tenta fazer login e salva o token se for bem-sucedido.
 * @param role - 'admin', 'kitchen' ou 'superadmin'
 * @param password - A senha correspondente
 * @returns True se o login foi bem-sucedido, false caso contrário.
 */
export async function login(
  role: "admin" | "kitchen" | "superadmin",
  password: string,
): Promise<boolean> {
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ role, password }),
    });

    if (!response.ok) {
      console.error("Falha no login:", await response.text());
      return false;
    }

    const data = await response.json();
    if (data.success && data.token) {
      // Salva o token no localStorage
      saveToken(data.token);
      console.log(`✅ Login bem-sucedido! Role: ${role}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Erro de rede ao tentar fazer login:", error);
    return false;
  }
}

/**
 * Verifica se o usuário está autenticado (possui token válido).
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Um wrapper para o fetch que adiciona o token de autenticação automaticamente.
 * @param url - A URL da API para chamar.
 * @param options - As opções do fetch (method, body, etc.).
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    // Adiciona o cabeçalho de autorização com o token
    headers["Authorization"] = `Bearer ${token}`;
  }

  // console.log removido: storeId não é mais usado
  const response = await fetch(url, { ...options, headers });

  // Se o token for inválido/expirado (401 ou 403), limpa o token e desconecta
  if (response.status === 401 || response.status === 403) {
    console.error("Acesso negado. Token inválido ou expirado.");
    logout();
    // Redireciona para a página de login (se necessário)
    if (window.location.pathname.includes("/admin")) {
      window.location.href = "/admin/login";
    } else if (window.location.pathname.includes("/kitchen")) {
      window.location.href = "/kitchen/login";
    }
    throw new Error("Acesso não autorizado");
  }

  return response;
}

/**
 * Fetch público para rotas como /api/menu
 */
export async function publicFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // console.log removido: storeId não é mais usado
  return fetch(url, { ...options, headers });
}

/**
 * Funções auxiliares para operações comuns da API com autenticação
 */

// Produtos (Admin)
export async function getProducts() {
  try {
    const response = await publicFetch(`${API_URL}/menu`);

    // ✅ Verifica se a resposta foi bem-sucedida
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ Erro ao buscar produtos (${response.status}):`,
        errorText,
      );
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // ✅ Valida se é array
    if (!Array.isArray(data)) {
      console.error("❌ Backend retornou dados inválidos (não é array):", data);
      return [];
    }

    return data;
  } catch (error) {
    console.error("❌ Erro ao buscar produtos:", error);
    return []; // ✅ Retorna array vazio em caso de erro
  }
}

export async function createProduct(productData: any) {
  const response = await authenticatedFetch(`${API_URL}/products`, {
    method: "POST",
    body: JSON.stringify(productData),
  });
  return response.json();
}

export async function updateProduct(productId: string, productData: any) {
  const response = await authenticatedFetch(
    `${API_URL}/products/${productId}`,
    {
      method: "PUT",
      body: JSON.stringify(productData),
    },
  );
  return response.json();
}

export async function deleteProduct(productId: string) {
  const response = await authenticatedFetch(
    `${API_URL}/products/${productId}`,
    {
      method: "DELETE",
    },
  );
  return response.json();
}

// Pedidos (Kitchen/Admin)
export async function getOrders() {
  const response = await authenticatedFetch(`${API_URL}/orders`);
  return response.json();
}

export async function deleteOrder(orderId: string) {
  const response = await authenticatedFetch(`${API_URL}/orders/${orderId}`, {
    method: "DELETE",
  });
  return response.json();
}

// Usuários (Admin)
export async function getUsers() {
  const response = await authenticatedFetch(`${API_URL}/users`);
  return response.json();
}
