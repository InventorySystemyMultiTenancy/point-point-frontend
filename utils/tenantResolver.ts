/**
 * 🏪 TENANT RESOLVER - Identificação da Loja (Multi-tenant)
 *
 * Identifica qual loja está sendo acessada baseada no subdomínio da URL.
 * Exemplo: pointpoint-joao.kioskpro.com.br -> storeId: "pointpoint-joao"
 *
 * PRIORIDADE:
 * 1. Variável de ambiente (VITE_DEFAULT_STORE_ID) - MÁXIMA PRIORIDADE
 * 2. Subdomínio (exceto 'www')
 * 3. Fallback padrão (pointpoint_01)
 */

// SINGLE-TENANT: Defina o ID da loja única aqui ou via .env
const DEFAULT_STORE_ID = import.meta.env.VITE_DEFAULT_STORE_ID || "loja_unica";

/**
 * Extrai o storeId do subdomínio da URL atual
 * @returns storeId ou null se estiver em localhost/ambiente de desenvolvimento
 */
// Sempre retorna o mesmo storeId para single-tenant
export function getStoreIdFromDomain(): string {
  return DEFAULT_STORE_ID;
}

/**
 * Obtém o storeId atual (com fallback para loja padrão)
 * @returns storeId (nunca retorna null)
 */
export function getCurrentStoreId(): string {
  // Sempre retorna o mesmo para single-tenant
  return getStoreIdFromDomain();
}

/**
 * Verifica se está rodando em ambiente de desenvolvimento
 */
export function isLocalEnvironment(): boolean {
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.")
  );
}
