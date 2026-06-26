import React, { useState, useEffect } from "react";
import SuperAdminReceivablesDetails from "../components/SuperAdminReceivablesDetails";
import { login as apiLogin } from "../services/apiService";

interface ItemDetail {
  name: string;
  price: number;
  precoBruto: number;
  quantity: number;
  valueToReceive: number;
}

interface OrderDetail {
  id: string;
  timestamp: string;
  userName?: string;
  total: number;
  orderValueToReceive: number;
  items: ItemDetail[];
  status?: string;
  paymentType?: string;
  paymentStatus?: string;
}

interface StatsData {
  stats: {
    totalToReceive: number;
    totalReceived: number;
    alreadyReceived: number;
  };
  history: Array<{
    id: number;
    amount: number;
    date: string;
  }>;
  orders: OrderDetail[];
}

interface EmployeeAccess {
  id: string | number;
  name: string;
  username: string;
  active: boolean;
  created_at?: string;
  createdAt?: string;
}

interface EmployeeFormState {
  name: string;
  username: string;
  password: string;
  active: boolean;
}

import logo from "../assets/pointpointcorrect-transparent.png";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const EMPLOYEE_FORM_EMPTY: EmployeeFormState = {
  name: "",
  username: "",
  password: "",
  active: true,
};

const SuperAdminPage: React.FC = () => {
  const [data, setData] = useState<StatsData | null>(null);
  const [receivedOrderIds, setReceivedOrderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [employees, setEmployees] = useState<EmployeeAccess[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState("");
  const [employeeForm, setEmployeeForm] =
    useState<EmployeeFormState>(EMPLOYEE_FORM_EMPTY);
  const [editingEmployee, setEditingEmployee] =
    useState<EmployeeAccess | null>(null);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);

  useEffect(() => {
    if (loggedIn) {
      fetchData();
      fetchEmployees();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [loggedIn]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${BASE_URL}/api/super-admin/receivables`,
        {
          headers: {
            "x-super-admin-password": password,
          },
        },
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          response.status === 500
            ? "Login realizado, mas o backend falhou ao carregar recebiveis."
            : errorText || "Erro ao buscar dados",
        );
      }
      const result = await response.json();
      setData(result);
    } catch (e: any) {
      setError(e.message || "Erro ao buscar dados");
    }
    setLoading(false);
  };

  const unwrapEmployees = (payload: unknown): EmployeeAccess[] => {
    if (Array.isArray(payload)) return payload as EmployeeAccess[];
    if (!payload || typeof payload !== "object") return [];
    const record = payload as Record<string, unknown>;
    for (const key of ["employees", "data", "users"]) {
      if (Array.isArray(record[key])) return record[key] as EmployeeAccess[];
    }
    return [];
  };

  const employeeRequest = async (path = "", options: RequestInit = {}) => {
    const response = await fetch(`${BASE_URL}/api/super-admin/employees${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-super-admin-password": password,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Erro na API (${response.status})`);
    }

    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    setEmployeeError("");
    try {
      const payload = await employeeRequest();
      setEmployees(unwrapEmployees(payload));
    } catch (e: any) {
      setEmployeeError(e.message || "Erro ao carregar funcionarios");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const openNewEmployee = () => {
    setEditingEmployee(null);
    setEmployeeForm(EMPLOYEE_FORM_EMPTY);
    setShowEmployeeForm(true);
    setEmployeeError("");
  };

  const openEditEmployee = (employee: EmployeeAccess) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      name: employee.name || "",
      username: employee.username || "",
      password: "",
      active: employee.active !== false,
    });
    setShowEmployeeForm(true);
    setEmployeeError("");
  };

  const saveEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employeeForm.name.trim() || !employeeForm.username.trim()) return;
    if (!editingEmployee && !employeeForm.password.trim()) {
      setEmployeeError("Senha obrigatoria ao criar funcionario.");
      return;
    }

    setEmployeesLoading(true);
    setEmployeeError("");
    try {
      const payload: Record<string, unknown> = {
        name: employeeForm.name.trim(),
        username: employeeForm.username.trim(),
        active: employeeForm.active,
      };
      if (employeeForm.password.trim()) {
        payload.password = employeeForm.password;
      }

      if (editingEmployee) {
        await employeeRequest(`/${editingEmployee.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await employeeRequest("", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowEmployeeForm(false);
      setEditingEmployee(null);
      setEmployeeForm(EMPLOYEE_FORM_EMPTY);
      await fetchEmployees();
    } catch (e: any) {
      setEmployeeError(e.message || "Erro ao salvar funcionario");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const toggleEmployeeActive = async (employee: EmployeeAccess) => {
    setEmployeesLoading(true);
    setEmployeeError("");
    try {
      await employeeRequest(`/${employee.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: employee.name,
          username: employee.username,
          active: employee.active === false,
        }),
      });
      await fetchEmployees();
    } catch (e: any) {
      setEmployeeError(e.message || "Erro ao atualizar funcionario");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const deleteEmployee = async (employee: EmployeeAccess) => {
    if (!window.confirm(`Excluir acesso de ${employee.name}?`)) return;
    setEmployeesLoading(true);
    setEmployeeError("");
    try {
      await employeeRequest(`/${employee.id}`, { method: "DELETE" });
      await fetchEmployees();
    } catch (e: any) {
      setEmployeeError(e.message || "Erro ao excluir funcionario");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const success = await apiLogin("superadmin", password);
      if (!success) throw new Error("Senha incorreta ou nao autorizado");
      setLoggedIn(true);
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Erro ao autenticar");
    }
    setLoading(false);
  };

  const handleToggleOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  };

  if (!loggedIn) {
    return (
      <div className="superadmin-login-shell min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <form
          onSubmit={handleLogin}
          className="superadmin-login-card bg-white shadow-2xl rounded-2xl p-10 w-full max-w-md flex flex-col gap-6 border-2 border-purple-200"
        >
          <div className="flex flex-col items-center gap-3">
            <img src={logo} alt="POIT&POIT Logo" className="w-24 h-24 mb-2" />
            <h2 className="text-3xl font-bold text-purple-600">Super Admin</h2>
            <p className="text-gray-600 text-sm text-center rounded-lg">
              Controle Financeiro POIT&POIT
            </p>
          </div>
          <input
            type="password"
            placeholder="Senha Super Admin"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            autoComplete="current-password"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
        </form>
      </div>
    );
  }

  const handleMarkReceived = async () => {
    if (!data || !data.orders || selectedOrderIds.length === 0) return;
    const pendingOrderIds = selectedOrderIds;
    console.log("[FRONTEND] orderIds enviados ao backend:", pendingOrderIds);
    if (
      !window.confirm(
        `Confirmar recebimento de R$ ${data.stats.totalToReceive.toFixed(2)} de ${pendingOrderIds.length} pedidos?`,
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      // Log para depuraÃ§Ã£o
      console.log(
        "[FRONTEND] Enviando POST para /api/super-admin/receivables/mark-received-by-ids",
        {
          url: `${BASE_URL}/api/super-admin/receivables/mark-received-by-ids`,
          password,
          orderIds: pendingOrderIds,
        },
      );
      const response = await fetch(
        `${BASE_URL}/api/super-admin/receivables/mark-received-by-ids`,
        {
          method: "POST",
          headers: {
            "x-super-admin-password": password,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderIds: pendingOrderIds }),
        },
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[FRONTEND] Erro ao marcar como recebido:", errorText);
        throw new Error(errorText || "Erro ao marcar como recebido");
      }
      const result = await response.json();
      setReceivedOrderIds(result.receivedOrderIds || []);
      // Atualiza os valores recebidos detalhados no frontend
      if (data && result.valorRecebidoDetalhado) {
        // Atualiza os pedidos para incluir valorRecebido
        const ordersAtualizados = data.orders.map((order) => {
          const detalhado = result.valorRecebidoDetalhado.find(
            (v: any) => v.orderId === order.id,
          );
          return {
            ...order,
            valorRecebido: detalhado ? detalhado.valorRecebido : undefined,
          };
        });
        setData({ ...data, orders: ordersAtualizados });
      }
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Erro ao marcar como recebido");
      console.error("[FRONTEND] Erro catch:", e);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-2 sm:p-4 md:p-6">
      <div className="max-w-6xl mx-auto w-full">
        <h1 className="text-2xl sm:text-3xl font-bold text-purple-600 mb-4 sm:mb-6 text-center sm:text-left">
          Dashboard Super Admin
        </h1>
        {loading && <div className="text-center">Carregando...</div>}
        {error && <div className="text-red-600 text-center mb-4">{error}</div>}

        <section className="mb-6 rounded-2xl border-2 border-purple-200 bg-white p-4 shadow-xl sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-purple-700">
                Acessos restritos
              </p>
              <h2 className="text-xl font-bold text-stone-900">
                Funcionarios
              </h2>
            </div>
            <button
              type="button"
              onClick={openNewEmployee}
              className="rounded-lg bg-purple-700 px-4 py-2 font-bold text-white hover:bg-purple-800"
            >
              Novo funcionario
            </button>
          </div>

          {employeeError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {employeeError}
            </div>
          )}

          {showEmployeeForm && (
            <form
              onSubmit={saveEmployee}
              className="mb-5 grid gap-3 rounded-lg bg-purple-50 p-4 sm:grid-cols-2 lg:grid-cols-5"
            >
              <label className="text-sm font-semibold text-stone-700">
                Nome
                <input
                  required
                  value={employeeForm.name}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-purple-700 focus:outline-none"
                />
              </label>
              <label className="text-sm font-semibold text-stone-700">
                Usuario
                <input
                  required
                  value={employeeForm.username}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                  autoComplete="username"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-purple-700 focus:outline-none"
                />
              </label>
              <label className="text-sm font-semibold text-stone-700">
                Senha
                <input
                  type="password"
                  required={!editingEmployee}
                  value={employeeForm.password}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  autoComplete="new-password"
                  placeholder={editingEmployee ? "Manter senha" : "Senha"}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-purple-700 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-stone-700">
                <input
                  type="checkbox"
                  checked={employeeForm.active}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({
                      ...prev,
                      active: event.target.checked,
                    }))
                  }
                />
                Ativo
              </label>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={employeesLoading}
                  className="rounded-lg bg-purple-700 px-4 py-2 font-bold text-white hover:bg-purple-800 disabled:opacity-60"
                >
                  {editingEmployee ? "Salvar" : "Criar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmployeeForm(false);
                    setEditingEmployee(null);
                    setEmployeeForm(EMPLOYEE_FORM_EMPTY);
                  }}
                  className="rounded-lg bg-stone-200 px-4 py-2 font-bold text-stone-700 hover:bg-stone-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-4 py-3 text-left">Nome</th>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Criado em</th>
                  <th className="px-4 py-3 text-left">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {employeesLoading && employees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center">
                      Carregando funcionarios...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-stone-500"
                    >
                      Nenhum funcionario cadastrado.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => {
                    const createdAt = employee.created_at || employee.createdAt;
                    return (
                      <tr key={employee.id}>
                        <td className="px-4 py-3 font-semibold">
                          {employee.name}
                        </td>
                        <td className="px-4 py-3">{employee.username}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              employee.active === false
                                ? "bg-stone-100 text-stone-600"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {employee.active === false ? "Inativo" : "Ativo"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {createdAt
                            ? new Date(createdAt).toLocaleString("pt-BR")
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditEmployee(employee)}
                              className="rounded-lg bg-purple-100 px-3 py-1 font-bold text-purple-700 hover:bg-purple-200"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleEmployeeActive(employee)}
                              className="rounded-lg bg-amber-100 px-3 py-1 font-bold text-amber-800 hover:bg-amber-200"
                            >
                              {employee.active === false
                                ? "Ativar"
                                : "Desativar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEmployee(employee)}
                              className="rounded-lg bg-red-100 px-3 py-1 font-bold text-red-700 hover:bg-red-200"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {data && (
          <>
            <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              <span className="font-semibold text-purple-700 text-base sm:text-lg">
                Valor a receber (total): R$
                {data.stats.totalToReceive.toFixed(2)}
              </span>
              <button
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:px-6 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl w-full sm:w-auto"
                onClick={handleMarkReceived}
                disabled={loading || selectedOrderIds.length === 0}
              >
                Receber selecionados
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl">
              <SuperAdminReceivablesDetails
                orders={data.orders}
                totalToReceive={data.stats.totalToReceive}
                totalReceived={data.stats.totalReceived}
                alreadyReceived={data.stats.alreadyReceived}
                receivedOrderIds={receivedOrderIds}
                selectedOrderIds={selectedOrderIds}
                onToggleOrder={handleToggleOrder}
              />
            </div>
            {/* Historico de recebimentos */}
            {data.history && data.history.length > 0 && (
              <div className="bg-white shadow-xl rounded-2xl p-2 sm:p-4 md:p-6 border-2 border-green-200 mt-4 sm:mt-8 overflow-x-auto">
                <h2 className="text-lg sm:text-xl font-bold text-green-800 mb-2 sm:mb-4">
                  Historico de Recebimentos do SuperAdmin
                </h2>
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-xs mb-2 min-w-[600px]">
                    <thead>
                      <tr className="bg-green-100">
                        <th className="py-1 px-2 text-left">Pedido</th>
                        <th className="py-1 px-2 text-left">Cliente</th>
                        <th className="py-1 px-2 text-left">Valor Total</th>
                        <th className="py-1 px-2 text-left">Data do Pedido</th>
                        <th className="py-1 px-2 text-left">Data do Recebimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.history.map((h, idx) => (
                        <tr
                          key={
                            ((h as any).recebimentoId || h.id || idx) +
                            "-" +
                            ((h as any).pedidoId || idx)
                          }
                          className="border-b"
                        >
                          <td className="py-1 px-2">{h.pedidoId}</td>
                          <td className="py-1 px-2">{h.cliente || "-"}</td>
                          <td className="py-1 px-2">
                            R$ {(Number(h.valorTotal) || 0).toFixed(2)}
                          </td>
                          <td className="py-1 px-2">
                            {h.dataPedido && h.dataPedido !== "-"
                              ? new Date(h.dataPedido).toLocaleString()
                              : "-"}
                          </td>
                          <td className="py-1 px-2">
                            {(h as any).dataRecebimento
                              ? new Date(
                                  (h as any).dataRecebimento,
                                ).toLocaleString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Exibe valorRecebidoDetalhado se disponÃ­vel */}
                {data.valorRecebidoDetalhado && (
                  <div className="mt-4 text-xs text-gray-600">
                    <b>Valores Recebidos Detalhados:</b>
                    <ul>
                      {data.valorRecebidoDetalhado.map(
                        (v: any, idx: number) => (
                          <li key={v.orderId + "-" + idx}>
                            Pedido {v.orderId}: R${" "}
                            {Number(v.valorRecebido).toFixed(2)}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminPage;


