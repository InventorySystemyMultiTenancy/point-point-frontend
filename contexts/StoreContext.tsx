/**
 * 🏪 STORE CONTEXT - Contexto Global da Loja (Multi-tenant)
 *
 * Gerencia as configurações da loja atual (nome, logo, cores)
 * Carrega automaticamente ao iniciar a aplicação
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
// import { getCurrentStoreId } from "../utils/tenantResolver";
import { applyStoreTheme } from "../utils/themeColors"; // 🎨 Tema dinâmico

// Configuração padrão da loja
export interface StoreConfig {
  id?: string;
  name: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

interface StoreContextType {
  store: StoreConfig | null;
  loading: boolean;
  error: string | null;
  refetchStore: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Configuração padrão (fallback) - Tema Point&Point
const DEFAULT_STORE_CONFIG: Omit<StoreConfig, "id"> = {
  name: "Point&Point",
  logo: null,
  primaryColor: "#6d28d9", // roxo escuro
  secondaryColor: "#1f2937", // gray-800 - preto profundo
  accentColor: "#d6b48c", // marrom claro
};

interface StoreProviderProps {
  children: ReactNode;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  const [store, setStore] = useState<StoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStoreConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      // Single-tenant: não há mais storeId
      console.log(`🏪 Carregando configuração da loja (single-tenant)`);

      const BACKEND_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3001";

      // Single-tenant: Usa configuração fixa
      const config: StoreConfig = {
        ...DEFAULT_STORE_CONFIG,
      };

      console.log("✅ Configuração da loja carregada:", config);
      setStore(config);

      // 🎨 Aplica o tema da loja (cores dinâmicas)
      applyStoreTheme({
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        accentColor: config.accentColor,
      });

      setLoading(false);
    } catch (err: any) {
      console.error("❌ Erro ao carregar loja:", err);
      setError(err.message || "Erro ao carregar loja");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreConfig();
  }, []);

  return (
    <StoreContext.Provider
      value={{
        store,
        loading,
        error,
        refetchStore: fetchStoreConfig,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

/**
 * Hook para acessar o contexto da loja
 */
export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore deve ser usado dentro de um StoreProvider");
  }
  return context;
};
