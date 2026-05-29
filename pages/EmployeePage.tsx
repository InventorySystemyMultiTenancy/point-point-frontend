import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminOutsourcedServicesPage from "./AdminOutsourcedServicesPage";
import {
  clearEmployeeToken,
  employeeFetch,
  isEmployeeAuthenticated,
} from "../services/apiService";
import logo from "../assets/pointpointcorrect.jpg";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const API_URL = `${BASE_URL}/api`;

type EmployeeTab = "orders" | "outsourced";

interface EmployeeOrderItem {
  name?: string;
  productName?: string;
  quantity?: number;
  price?: number;
}

interface EmployeeOrder {
  id: string;
  userName?: string;
  customerName?: string;
  cliente?: string;
  timestamp?: string;
  created_at?: string;
  createdAt?: string;
  total?: number;
  status?: string;
  paymentStatus?: string;
  paymentType?: string;
  entregueCliente?: boolean;
  observation?: string;
  items?: EmployeeOrderItem[];
}

const unwrapOrders = (data: unknown): EmployeeOrder[] => {
  if (Array.isArray(data)) return data as EmployeeOrder[];
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  for (const key of ["orders", "history", "data"]) {
    if (Array.isArray(record[key])) return record[key] as EmployeeOrder[];
  }
  return [];
};

const formatMoney = (value?: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
};

const EmployeePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<EmployeeTab>("orders");
  const [orders, setOrders] = useState<EmployeeOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isEmployeeAuthenticated()) {
      navigate("/employee/login", { replace: true });
    }
  }, [navigate]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    setError("");
    try {
      const response = await employeeFetch(`${API_URL}/orders/history`);
      const data = await response.json();
      setOrders(unwrapOrders(data));
    } catch (err) {
      console.error("Erro ao carregar historico do funcionario:", err);
      setError("Nao foi possivel carregar o historico de pedidos.");
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (activeTab === "orders" && isEmployeeAuthenticated()) {
      loadOrders();
    }
  }, [activeTab]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
      const customer =
        order.userName || order.customerName || order.cliente || "";
      return (
        String(order.id).toLowerCase().includes(term) ||
        customer.toLowerCase().includes(term)
      );
    });
  }, [orders, search]);

  const logout = () => {
    clearEmployeeToken();
    navigate("/employee/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#fff6e5] text-stone-900">
      <header className="border-b border-stone-200 bg-[#3b2418] text-white shadow">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Point&Point"
              className="h-12 w-12 rounded-lg object-cover"
            />
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#d2b48c]">
                Point&Point
              </p>
              <h1 className="text-xl font-bold">Painel do funcionario</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                activeTab === "orders"
                  ? "bg-purple-700 text-white"
                  : "bg-white/10 text-stone-100 hover:bg-white/20"
              }`}
            >
              Historico de pedidos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("outsourced")}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                activeTab === "outsourced"
                  ? "bg-purple-700 text-white"
                  : "bg-white/10 text-stone-100 hover:bg-white/20"
              }`}
            >
              Servicos terceirizados
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-[#d2b48c] px-4 py-2 text-sm font-bold text-stone-900 hover:bg-[#c6a477]"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === "outsourced" ? (
          <AdminOutsourcedServicesPage />
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-purple-700">
                  Separacao de pedidos
                </p>
                <h2 className="text-2xl font-bold">Historico de pedidos</h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar pedido ou cliente"
                  className="rounded-lg border border-stone-300 px-3 py-2 focus:border-purple-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={loadOrders}
                  disabled={loadingOrders}
                  className="rounded-lg bg-purple-700 px-4 py-2 font-bold text-white hover:bg-purple-800 disabled:opacity-60"
                >
                  Atualizar
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <div className="overflow-x-auto rounded-lg bg-white shadow">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Pedido</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Itens</th>
                    <th className="px-4 py-3 text-left">Total</th>
                    <th className="px-4 py-3 text-left">Pagamento</th>
                    <th className="px-4 py-3 text-left">Entrega</th>
                    <th className="px-4 py-3 text-left">Observacao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loadingOrders ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-stone-500"
                      >
                        Nenhum pedido encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const customer =
                        order.userName ||
                        order.customerName ||
                        order.cliente ||
                        "-";
                      const date =
                        order.timestamp || order.created_at || order.createdAt;
                      return (
                        <tr key={order.id} className="hover:bg-purple-50/50">
                          <td className="px-4 py-3 font-bold">{order.id}</td>
                          <td className="px-4 py-3">{customer}</td>
                          <td className="px-4 py-3">{formatDate(date)}</td>
                          <td className="px-4 py-3">
                            {(order.items || []).length > 0
                              ? (order.items || [])
                                  .map(
                                    (item) =>
                                      `${item.quantity || 0}x ${
                                        item.name || item.productName || "Item"
                                      }`,
                                  )
                                  .join(", ")
                              : "-"}
                          </td>
                          <td className="px-4 py-3 font-bold">
                            {formatMoney(order.total)}
                          </td>
                          <td className="px-4 py-3">
                            {order.paymentStatus || order.paymentType || "-"}
                          </td>
                          <td className="px-4 py-3">
                            {order.entregueCliente ? "Entregue" : "Pendente"}
                          </td>
                          <td className="px-4 py-3">
                            {order.observation || "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default EmployeePage;
