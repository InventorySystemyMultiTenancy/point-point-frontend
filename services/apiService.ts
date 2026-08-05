// Atualiza os dados do usuÃ¡rio (self-service)
export async function updateUser(userId: string, userData: any) {
  const response = await authenticatedFetch(`${API_URL}/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(userData),
  });
  return response.json();
}
// ServiÃ§o de API com autenticaÃ§Ã£o JWT e Multi-tenant

import api from "./api";
import type { DeliveryMethodValue } from "../types";

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
export function saveToken(token: string): void {
  localStorage.setItem("jwt_token", token);
}

export function getSuperAdminToken(): string | null {
  return localStorage.getItem("superAdminToken");
}

export function saveSuperAdminToken(token: string): void {
  localStorage.setItem("superAdminToken", token);
}

export function clearSuperAdminToken(): void {
  localStorage.removeItem("superAdminToken");
}

export function getEmployeeToken(): string | null {
  return localStorage.getItem("employeeToken");
}

export function saveEmployeeToken(token: string): void {
  localStorage.setItem("employeeToken", token);
}

export function clearEmployeeToken(): void {
  localStorage.removeItem("employeeToken");
}

export function getUserToken(): string | null {
  return localStorage.getItem("userToken");
}

export function saveUserToken(token: string): void {
  localStorage.setItem("userToken", token);
}

export function clearUserToken(): void {
  localStorage.removeItem("userToken");
}

/**
 * Remove o token JWT do localStorage.
 */
export function logout(): void {
  localStorage.removeItem("jwt_token");
  clearUserToken();
  console.log("UsuÃ¡rio deslogado.");
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
 * Remove (soft delete) um pedido do histÃ³rico via rota administrativa.
 * Exige JWT de admin no header Authorization.
 */
export async function deleteOrderFromHistory(
  orderId: string,
  token: string,
): Promise<DeleteOrderFromHistoryResponse> {
  if (!token) {
    const error: ApiHttpError = new Error("SessÃ£o expirada");
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
    message: data.message || "Pedido removido do histÃ³rico com sucesso",
    orderId: data.orderId || orderId,
  };
}

/**
 * Tenta fazer login e salva o token se for bem-sucedido.
 * @param role - 'admin', 'kitchen' ou 'superadmin'
 * @param password - A senha correspondente
 * @returns True se o login foi bem-sucedido, false caso contrÃ¡rio.
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
      if (role === "superadmin") {
        saveSuperAdminToken(data.token);
      } else {
        saveToken(data.token);
      }
      console.log(`âœ… Login bem-sucedido! Role: ${role}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Erro de rede ao tentar fazer login:", error);
    return false;
  }
}

/**
 * Verifica se o usuÃ¡rio estÃ¡ autenticado (possui token vÃ¡lido).
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export function isEmployeeAuthenticated(): boolean {
  return getEmployeeToken() !== null;
}

export async function employeeLogin(
  username: string,
  password: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "employee", username, password }),
    });

    if (!response.ok) {
      console.error("Falha no login do funcionario:", await response.text());
      return false;
    }

    const data = await response.json();
    if (data.success && data.token) {
      saveEmployeeToken(data.token);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Erro de rede ao tentar login do funcionario:", error);
    return false;
  }
}

/**
 * Um wrapper para o fetch que adiciona o token de autenticaÃ§Ã£o automaticamente.
 * @param url - A URL da API para chamar.
 * @param options - As opÃ§Ãµes do fetch (method, body, etc.).
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
    // Adiciona o cabeÃ§alho de autorizaÃ§Ã£o com o token
    headers["Authorization"] = `Bearer ${token}`;
  }

  // console.log removido: storeId nÃ£o Ã© mais usado
  const response = await fetch(url, { ...options, headers });

  // Se o token for invÃ¡lido/expirado (401 ou 403), limpa o token e desconecta
  if (response.status === 401 || response.status === 403) {
    console.error("Acesso negado. Token invÃ¡lido ou expirado.");
    logout();
    // Redireciona para a pÃ¡gina de login (se necessÃ¡rio)
    const route = `${window.location.pathname}${window.location.hash}`;
    if (route.includes("/admin")) {
      window.location.hash = "#/admin/login";
    } else if (route.includes("/kitchen") || route.includes("/cozinha")) {
      window.location.hash = "#/kitchen/login";
    }
    throw new Error("Acesso nÃ£o autorizado");
  }

  return response;
}

export async function employeeFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getEmployeeToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    clearEmployeeToken();
    sessionStorage.setItem(
      "employeeAuthMessage",
      "Sessao expirada ou acesso nao autorizado.",
    );
    window.location.hash = "#/employee/login";
    throw new Error("Sessao expirada ou acesso nao autorizado");
  }

  return response;
}

/**
 * Fetch pÃºblico para rotas como /api/menu
 */
export async function publicFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // console.log removido: storeId nÃ£o Ã© mais usado
  return fetch(url, { ...options, headers });
}

export async function catalogFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getUserToken();
  let requestUrl = url;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
      if (currentUser?.id && !requestUrl.includes("userId=")) {
        const separator = requestUrl.includes("?") ? "&" : "?";
        requestUrl = `${requestUrl}${separator}userId=${encodeURIComponent(currentUser.id)}`;
      }
    } catch {
      // visitante sem token segue sem identificacao
    }
  }

  return fetch(requestUrl, { ...options, headers });
}

/**
 * FunÃ§Ãµes auxiliares para operaÃ§Ãµes comuns da API com autenticaÃ§Ã£o
 */

// Produtos (Admin)
export async function getProducts(userId?: string) {
  try {
    const url = userId
      ? `${API_URL}/products?userId=${encodeURIComponent(userId)}`
      : `${API_URL}/products`;
    const response = await catalogFetch(url);

    // âœ… Verifica se a resposta foi bem-sucedida
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `âŒ Erro ao buscar produtos (${response.status}):`,
        errorText,
      );
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const products = Array.isArray(data)
      ? data
      : Array.isArray(data.products)
        ? data.products
        : Array.isArray(data.data)
          ? data.data
          : [];

    // Valida se e array
    if (!Array.isArray(products)) {
      console.error("âŒ Backend retornou dados invÃ¡lidos (nÃ£o Ã© array):", data);
      return [];
    }

    return products;
  } catch (error) {
    console.error("âŒ Erro ao buscar produtos:", error);
    return []; // âœ… Retorna array vazio em caso de erro
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

export async function getBackorderedProducts() {
  const response = await authenticatedFetch(
    `${API_URL}/admin/backordered-products`,
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

// UsuÃ¡rios (Admin)
export async function getUsers() {
  const response = await authenticatedFetch(`${API_URL}/users`);
  return response.json();
}

export async function getUserById(userId: string) {
  const response = await catalogFetch(`${API_URL}/users/${userId}`);
  return response.json();
}

export async function getUserProductPrices(userId: string) {
  const response = await authenticatedFetch(
    `${API_URL}/users/${userId}/product-prices`,
  );
  return response.json();
}

export async function updateUserProductPrices(
  userId: string,
  prices: Array<{ productId: string; price: number | null }>,
) {
  const response = await authenticatedFetch(
    `${API_URL}/users/${userId}/product-prices`,
    {
      method: "PUT",
      body: JSON.stringify({ prices }),
    },
  );
  return response.json();
}

export async function updateUserProductPrice(
  userId: string,
  productId: string,
  price: number | null,
) {
  const response = await authenticatedFetch(
    `${API_URL}/users/${userId}/product-prices/${productId}`,
    {
      method: "PUT",
      body: JSON.stringify({ price }),
    },
  );
  return response.json();
}

export async function deleteUserProductPrice(userId: string, productId: string) {
  const response = await authenticatedFetch(
    `${API_URL}/users/${userId}/product-prices/${productId}`,
    { method: "DELETE" },
  );
  return response.json();
}

export async function getDeliveryMethods() {
  const response = await publicFetch(`${API_URL}/delivery-methods`);
  return response.json();
}

export async function getShippingCarriers() {
  const response = await authenticatedFetch(`${API_URL}/shipping-carriers`);
  return response.json();
}

export async function createShippingCarrier(carrierData: {
  name: string;
  trackingUrl?: string;
  active?: boolean;
}) {
  const response = await authenticatedFetch(`${API_URL}/shipping-carriers`, {
    method: "POST",
    body: JSON.stringify(carrierData),
  });
  return response.json();
}

export async function updateShippingCarrier(
  carrierId: string,
  carrierData: {
    name: string;
    trackingUrl?: string;
    active?: boolean;
  },
) {
  const response = await authenticatedFetch(
    `${API_URL}/shipping-carriers/${carrierId}`,
    {
      method: "PUT",
      body: JSON.stringify(carrierData),
    },
  );
  return response.json();
}

export async function deleteShippingCarrier(carrierId: string) {
  const response = await authenticatedFetch(
    `${API_URL}/shipping-carriers/${carrierId}`,
    { method: "DELETE" },
  );
  return response.json();
}

export async function updateOrderDelivery(
  orderId: string,
  deliveryData: {
    deliveryMethod: DeliveryMethodValue;
    carrierId?: string | null;
  },
) {
  const response = await authenticatedFetch(
    `${API_URL}/orders/${orderId}/delivery`,
    {
      method: "PATCH",
      body: JSON.stringify(deliveryData),
    },
  );
  return response.json();
}

export async function updateUserFullAccess(userId: string, fullAccess: boolean) {
  const response = await authenticatedFetch(
    `${API_URL}/users/${userId}/full-access`,
    {
      method: "PATCH",
      body: JSON.stringify({ fullAccess }),
    },
  );
  return response.json();
}

export async function updateUserChequePayment(
  userId: string,
  chequePayment: boolean,
) {
  const response = await authenticatedFetch(
    `${API_URL}/users/${userId}/cheque-payment`,
    {
      method: "PATCH",
      body: JSON.stringify({ chequePayment }),
    },
  );
  return response.json();
}

export async function updateUserActive(userId: string, active: boolean) {
  const response = await authenticatedFetch(
    `${API_URL}/users/${userId}/active`,
    {
      method: "PATCH",
      body: JSON.stringify({ active }),
    },
  );
  return response.json();
}

