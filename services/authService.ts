import type { User } from "../types";

// Configuração da URL da API via variável de ambiente
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const API_URL = `${BASE_URL}/api`;

/**
 * Validar Documento (CPF ou CNPJ)
 * Verifica se tem 11 ou 14 dígitos após limpar caracteres não numéricos.
 */
export const validateDocument = (doc: string): boolean => {
  const cleanDoc = doc.replace(/\D/g, "");
  return cleanDoc.length === 11 || cleanDoc.length === 14;
};

// Mantendo o alias para não quebrar outras partes do código que chamam validateCPF
export const validateCPF = validateDocument;

/**
 * Buscar usuário por Documento (CPF/CNPJ) via API
 */
export const findUserByDocument = async (doc: string): Promise<User | null> => {
  try {
    // Buscamos todos os usuários e filtramos pelo documento (CPF ou CNPJ)
    const resp = await fetch(`${API_URL}/users`);
    if (!resp.ok) return null;
    
    const users: User[] = await resp.json();
    const clean = String(doc).replace(/\D/g, "");

    const match = users.find((u) => {
      if (!u.cpf) return false;
      // Comparamos o documento limpo (removendo pontos, traços, etc do banco se houver)
      return String(u.cpf).replace(/\D/g, "") === clean;
    });

    return match || null;
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return null;
  }
};

// Mantendo o alias para compatibilidade
export const findUserByCPF = findUserByDocument;

/**
 * Registrar novo usuário via API
 */
export const registerUser = async (userData: {
  name: string;
  cpf: string; // O campo continua sendo 'cpf' no seu banco/API
  email: string;
  telefone: string;
}): Promise<User | null> => {
  try {
    const response = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      console.error("Erro ao registrar:", data.error || data);
      return null;
    }
  } catch (error) {
    console.error("Erro ao registrar usuário:", error);
    return null;
  }
};

/**
 * Salvar pedido via API
 */
// Salvar pedido via API - Atualizado para suportar CPF/CNPJ
export const saveOrder = async (
  userId: string,
  items: any[],
  total: number,
  userDoc?: string, // Adicionado parâmetro opcional para o documento
  userName?: string // Adicionado parâmetro opcional para o nome
) => {
  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        userName, // Enviando para o backend salvar no histórico
        userDoc: userDoc ? userDoc.replace(/\D/g, "") : null, // Envia apenas números
        items,
        total,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Retorna o pedido criado (o seu backend retorna o objeto order)
      return data; 
    } else {
      console.error("Erro ao salvar pedido:", data.error);
      return null;
    }
  } catch (error) {
    console.error("Erro ao salvar pedido:", error);
    return null;
  }
};

/**
 * Obter histórico do usuário via API
 */
export const getUserHistory = async (userId: string) => {
  try {
    const response = await fetch(`${API_URL}/users/${userId}/historico`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Erro ao obter histórico:", error);
    return [];
  }
};