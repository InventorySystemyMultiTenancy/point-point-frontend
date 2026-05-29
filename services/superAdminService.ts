import { authenticatedFetch, getToken } from "./apiService";

// Busca stats e histórico para o Super Admin

export async function getSuperAdminStats(password: string) {
  const response = await authenticatedFetch(
    `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/super-admin/receivables`,
    {
      headers: {
        "x-super-admin-password": password,
      },
    },
  );
  if (!response.ok) throw new Error("Erro ao buscar stats do super admin");
  return response.json();
}

// Marca como recebido (reseta contagem e salva histórico)

export async function markSuperAdminReceived(password: string) {
  const response = await authenticatedFetch(
    `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/super-admin/receivables/mark-received`,
    {
      method: "POST",
      headers: {
        "x-super-admin-password": password,
      },
    },
  );
  if (!response.ok) throw new Error("Erro ao marcar como recebido");
  return response.json();
}
