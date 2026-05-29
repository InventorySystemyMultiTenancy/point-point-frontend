import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Instância customizada do Axios para single-tenant
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 segundos
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Interceptor de RESPONSE: Trata erros globalmente
 */
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log para debug (remover em produção se necessário)
    console.log(`[API] ✅ ${response.config.url}`, {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    // Trata erros de forma amigável
    if (error.response) {
      console.error(`[API] ❌ ${error.response.status}:`, error.response.data);

      // ...existing code...
    } else if (error.request) {
      console.error("[API] ❌ Sem resposta do servidor:", error.request);
    } else {
      console.error("[API] ❌ Erro desconhecido:", error.message);
    }

    return Promise.reject(error);
  },
);

/**
 * Helper para requisições GET
 */
export async function get<T = any>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.get<T>(url, config);
  return response.data;
}

/**
 * Helper para requisições POST
 */
export async function post<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.post<T>(url, data, config);
  return response.data;
}

/**
 * Helper para requisições PUT
 */
export async function put<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.put<T>(url, data, config);
  return response.data;
}

/**
 * Helper para requisições DELETE
 */
export async function del<T = any>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.delete<T>(url, config);
  return response.data;
}

export default api;
