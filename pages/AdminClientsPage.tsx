// Página: /pages/AdminClientsPage.tsx
// Painel para o admin gerenciar clientes comuns: ver dados, editar,
// desativar/ativar, e controlar fechamento mensal e acesso a produtos ocultos.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "../types";
import {
  getUsers,
  updateUser,
  updateUserActive,
  updateUserFullAccess,
  updateUserMonthlyPayment,
} from "../services/apiService";

interface ClientFormState {
  name: string;
  email: string;
  cpf: string;
  telefone: string;
}

const emptyForm: ClientFormState = { name: "", email: "", cpf: "", telefone: "" };

const AdminClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editingClient, setEditingClient] = useState<User | null>(null);
  const [formData, setFormData] = useState<ClientFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const [updatingFullAccessId, setUpdatingFullAccessId] = useState<string | null>(
    null,
  );
  const [updatingMonthlyPaymentId, setUpdatingMonthlyPaymentId] = useState<
    string | null
  >(null);
  const [updatingActiveId, setUpdatingActiveId] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await getUsers();
      const list: User[] = Array.isArray(data)
        ? data
        : Array.isArray(data.users)
          ? data.users
          : Array.isArray(data.data)
            ? data.data
            : [];
      setClients(list.filter((user) => !user.role || user.role === "customer"));
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
      alert("Erro ao carregar clientes.");
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredClients = useMemo(() => {
    if (!normalizedSearch) return clients;
    return clients.filter((client) =>
      [client.name, client.email, client.cpf, client.telefone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    );
  }, [clients, normalizedSearch]);

  const handleOpenEdit = (client: User) => {
    setEditingClient(client);
    setFormData({
      name: client.name || "",
      email: client.email || "",
      cpf: client.cpf || "",
      telefone: client.telefone || "",
    });
  };

  const handleCloseEdit = () => {
    setEditingClient(null);
    setFormData(emptyForm);
  };

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingClient) return;
    setIsSaving(true);
    try {
      const data = await updateUser(editingClient.id, formData);
      const updatedUser = data.user || data;
      setClients((prev) =>
        prev.map((item) =>
          item.id === editingClient.id ? { ...item, ...updatedUser } : item,
        ),
      );
      handleCloseEdit();
    } catch (err) {
      console.error("Erro ao atualizar cliente:", err);
      alert("Erro ao atualizar dados do cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFullAccess = async (client: User) => {
    setUpdatingFullAccessId(client.id);
    try {
      const data = await updateUserFullAccess(client.id, !client.fullAccess);
      const updatedUser = data.user || data;
      setClients((prev) =>
        prev.map((item) =>
          item.id === client.id ? { ...item, ...updatedUser } : item,
        ),
      );
    } catch (err) {
      console.error("Erro ao atualizar acesso a ocultos:", err);
      alert("Erro ao atualizar acesso a produtos ocultos do cliente.");
    } finally {
      setUpdatingFullAccessId(null);
    }
  };

  const handleToggleMonthlyPayment = async (client: User) => {
    setUpdatingMonthlyPaymentId(client.id);
    try {
      const data = await updateUserMonthlyPayment(
        client.id,
        !client.monthlyPayment,
      );
      const updatedUser = data.user || data;
      setClients((prev) =>
        prev.map((item) =>
          item.id === client.id ? { ...item, ...updatedUser } : item,
        ),
      );
    } catch (err) {
      console.error("Erro ao atualizar fechamento mensal:", err);
      alert("Erro ao atualizar fechamento mensal do cliente.");
    } finally {
      setUpdatingMonthlyPaymentId(null);
    }
  };

  const handleToggleActive = async (client: User) => {
    const nextActive = !(client.active ?? true);
    const confirmMessage = nextActive
      ? `Deseja reativar o cliente ${client.name}?`
      : `Deseja desativar o cliente ${client.name}? Ele nao conseguira mais acessar a conta.`;
    if (!window.confirm(confirmMessage)) return;

    setUpdatingActiveId(client.id);
    try {
      const data = await updateUserActive(client.id, nextActive);
      const updatedUser = data.user || data;
      setClients((prev) =>
        prev.map((item) =>
          item.id === client.id ? { ...item, ...updatedUser } : item,
        ),
      );
    } catch (err) {
      console.error("Erro ao atualizar status do cliente:", err);
      alert("Erro ao atualizar status do cliente.");
    } finally {
      setUpdatingActiveId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-transparent">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">🔄</div>
          <p className="text-xl text-blue-100 font-semibold">
            Carregando clientes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-2 sm:p-4 md:p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/admin")}
                className="text-purple-600 hover:bg-purple-100 p-2 rounded-full transition-colors"
              >
                ← Voltar
              </button>
              <div>
                <h1 className="text-3xl font-bold text-purple-800">
                  Clientes
                </h1>
                <p className="text-stone-600 text-sm mt-1">
                  Veja os dados dos clientes, edite, desative e controle
                  fechamento mensal e acesso a produtos ocultos.
                </p>
              </div>
            </div>
            <button
              onClick={loadClients}
              className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-lg"
            >
              Atualizar
            </button>
          </div>
          <div className="mt-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, email, CPF ou telefone"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-purple-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Lista de Clientes */}
        {filteredClients.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <h2 className="text-2xl font-bold text-stone-800 mb-2">
              Nenhum cliente encontrado
            </h2>
            <p className="text-stone-600">
              {clients.length === 0
                ? "Ainda nao ha clientes cadastrados."
                : "Nenhum cliente corresponde a busca."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredClients.map((client) => {
              const isActive = client.active ?? true;
              return (
                <div
                  key={client.id}
                  className={`bg-white rounded-xl shadow-lg p-5 border-2 ${
                    isActive ? "border-transparent" : "border-red-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-stone-800 truncate">
                        {client.name}
                      </h3>
                      <p className="text-sm text-stone-500 truncate">
                        {client.email || "Sem email"}
                      </p>
                      <p className="text-sm text-stone-500">
                        {client.cpf || "Sem CPF"} ·{" "}
                        {client.telefone || "Sem telefone"}
                      </p>
                      {typeof client.pontos === "number" && (
                        <p className="text-xs text-stone-400 mt-1">
                          Pontos: {client.pontos}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                        isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {isActive ? "Ativo" : "Desativado"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(client)}
                      className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleMonthlyPayment(client)}
                      disabled={updatingMonthlyPaymentId === client.id}
                      className={`rounded-full px-4 py-2 text-xs font-black transition disabled:opacity-60 ${
                        client.monthlyPayment
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                      }`}
                    >
                      {updatingMonthlyPaymentId === client.id
                        ? "Salvando..."
                        : client.monthlyPayment
                          ? "Fechamento mensal: Sim"
                          : "Fechamento mensal: Nao"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFullAccess(client)}
                      disabled={updatingFullAccessId === client.id}
                      className={`rounded-full px-4 py-2 text-xs font-black transition disabled:opacity-60 ${
                        client.fullAccess
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                      }`}
                    >
                      {updatingFullAccessId === client.id
                        ? "Salvando..."
                        : client.fullAccess
                          ? "Acesso a ocultos: Sim"
                          : "Acesso a ocultos: Nao"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(client)}
                      disabled={updatingActiveId === client.id}
                      className={`rounded-full px-4 py-2 text-xs font-black transition disabled:opacity-60 ${
                        isActive
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      {updatingActiveId === client.id
                        ? "Salvando..."
                        : isActive
                          ? "Desativar"
                          : "Reativar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de edição */}
      {editingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start sm:items-center z-50 overflow-y-auto p-2 sm:p-4">
          <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-purple-800">
              Editar cliente
            </h2>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, email: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CPF</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.cpf}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, cpf: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Telefone
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.telefone}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      telefone: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="bg-stone-200 px-4 py-2 rounded-lg"
                  onClick={handleCloseEdit}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  disabled={isSaving}
                >
                  {isSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClientsPage;
