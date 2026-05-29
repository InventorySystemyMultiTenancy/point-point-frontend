/**
 * ðŸª TENANT RESOLVER - IdentificaÃ§Ã£o da Loja (Multi-tenant)
 *
 * Identifica qual loja estÃ¡ sendo acessada baseada no subdomÃ­nio da URL.
 * Exemplo: pointpoint-joao.kioskpro.com.br -> storeId: "pointpoint-joao"
 *
 * PRIORIDADE:
 * 1. VariÃ¡vel de ambiente (VITE_DEFAULT_STORE_ID) - MÃXIMA PRIORIDADE
 * 2. SubdomÃ­nio (exceto 'www')
 * 3. Fallback padrÃ£o (pointpoint_01)
 */

// SINGLE-TENANT: Defina o ID da loja Ãºnica aqui ou via .env
const DEFAULT_STORE_ID = import.meta.env.VITE_DEFAULT_STORE_ID || "loja_unica";

/**
 * Extrai o storeId do subdomÃ­nio da URL atual
 * @returns storeId ou null se estiver em localhost/ambiente de desenvolvimento
 */
// Sempre retorna o mesmo storeId para single-tenant
export function getStoreIdFromDomain(): string {
  return DEFAULT_STORE_ID;
}

/**
 * ObtÃ©m o storeId atual (com fallback para loja padrÃ£o)
 * @returns storeId (nunca retorna null)
 */
export function getCurrentStoreId(): string {
  // Sempre retorna o mesmo para single-tenant
  return getStoreIdFromDomain();
}

/**
 * Verifica se estÃ¡ rodando em ambiente de desenvolvimento
 */
export function isLocalEnvironment(): boolean {
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.")
  );
}

