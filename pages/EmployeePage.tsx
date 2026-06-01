import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminOutsourcedServicesPage from "./AdminOutsourcedServicesPage";
import {
  clearEmployeeToken,
  employeeFetch,
  isEmployeeAuthenticated,
} from "../services/apiService";
import logo from "../assets/pointpointcorrect-transparent.png";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const API_URL = `${BASE_URL}/api`;

type EmployeeTab = "orders" | "outsourced";

interface EmployeeOrderItem {
  id?: string;
  productId?: string;
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<EmployeeOrder | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      const saved = localStorage.getItem("employee_order_checklist");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

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

  useEffect(() => {
    localStorage.setItem("employee_order_checklist", JSON.stringify(checkedItems));
  }, [checkedItems]);

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
    navigate("/", { replace: true });
  };

  const getItemKey = (item: EmployeeOrderItem, index: number) =>
    item.id || item.productId || `${item.name || item.productName || "item"}-${index}`;

  const getOrderCheckedItems = (orderId: string) => checkedItems[orderId] || {};

  const toggleItemChecked = (
    orderId: string,
    item: EmployeeOrderItem,
    index: number,
  ) => {
    const itemKey = getItemKey(item, index);
    setCheckedItems((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [itemKey]: !prev[orderId]?.[itemKey],
      },
    }));
  };

  const checklistProgress = (order: EmployeeOrder) => {
    const items = order.items || [];
    if (items.length === 0) return { done: 0, total: 0, complete: false };
    const orderChecks = getOrderCheckedItems(order.id);
    const done = items.filter((item, index) => orderChecks[getItemKey(item, index)]).length;
    return { done, total: items.length, complete: done === items.length };
  };

  const markPaid = async (order: EmployeeOrder) => {
    const response = await employeeFetch(`${API_URL}/orders/${order.id}/mark-paid`, {
      method: "PUT",
    });
    if (!response.ok) {
      alert("Erro ao marcar como pago");
      return;
    }
    await loadOrders();
    setSelectedOrder((prev) =>
      prev?.id === order.id ? { ...prev, paymentStatus: "paid" } : prev,
    );
  };

  const markDelivered = async (order: EmployeeOrder) => {
    const response = await employeeFetch(
      `${API_URL}/orders/${order.id}/mark-delivered`,
      { method: "PUT" },
    );
    if (!response.ok) {
      alert("Erro ao marcar como entregue");
      return;
    }
    await loadOrders();
    setSelectedOrder((prev) =>
      prev?.id === order.id ? { ...prev, entregueCliente: true } : prev,
    );
  };

  const openPdf = (order: EmployeeOrder) => {
    window.open(`${API_URL}/orders/${order.id}/receipt-pdf`, "_blank");
  };

  const selectTab = (tab: EmployeeTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen text-stone-900">
      <header className="sticky top-0 z-40 rounded-xl border border-blue-500/20 bg-white text-white shadow-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={logo}
                alt="Point&Point"
                className="h-11 w-11 shrink-0 rounded-lg object-cover sm:h-12 sm:w-12"
              />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-[#d2b48c] sm:text-sm">
                  Point&Point
                </p>
                <h1 className="text-lg font-black leading-tight text-white sm:text-xl">
                  Painel do funcionario
                </h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl bg-white/10 text-white ring-1 ring-white/20 lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="h-0.5 w-6 rounded bg-white" />
              <span className="h-0.5 w-6 rounded bg-white" />
              <span className="h-0.5 w-6 rounded bg-white" />
            </button>
          </div>
          <div
            className={`w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:grid lg:w-auto ${
              isMobileMenuOpen ? "grid" : "hidden"
            }`}
          >
            <button
              type="button"
              onClick={() => selectTab("orders")}
              className={`min-h-12 rounded-xl px-4 py-3 text-sm font-black shadow-sm transition ${
                activeTab === "orders"
                  ? "bg-purple-700 text-white ring-2 ring-white/30"
                  : "bg-white/10 text-stone-100 hover:bg-white/20"
              }`}
            >
              Pedidos
            </button>
            <button
              type="button"
              onClick={() => selectTab("outsourced")}
              className={`min-h-12 rounded-xl px-4 py-3 text-sm font-black shadow-sm transition ${
                activeTab === "outsourced"
                  ? "bg-purple-700 text-white ring-2 ring-white/30"
                  : "bg-[#d2b48c] text-stone-950 hover:bg-[#c6a477]"
              }`}
            >
              Abrir terceirizados
            </button>
            <button
              type="button"
              onClick={logout}
              className="min-h-12 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-stone-100 hover:bg-white/20"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-0 py-4 sm:px-4 sm:py-6">
        {activeTab === "outsourced" ? (
          <AdminOutsourcedServicesPage />
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-wide text-purple-700">
                  Separacao de pedidos
                </p>
                <h2 className="text-xl font-black leading-tight sm:text-2xl">
                  Historico de pedidos
                </h2>
              </div>
              <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(220px,1fr)_auto]">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar pedido ou cliente"
                  className="min-h-11 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-purple-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={loadOrders}
                  disabled={loadingOrders}
                  className="min-h-11 rounded-lg bg-purple-700 px-4 py-2 font-bold text-white hover:bg-purple-800 disabled:opacity-60"
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

            <div className="space-y-3 md:hidden">
              {loadingOrders ? (
                <div className="rounded-xl bg-white p-6 text-center font-semibold text-stone-500 shadow">
                  Carregando...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center font-semibold text-stone-500 shadow">
                  Nenhum pedido encontrado.
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const customer =
                    order.userName || order.customerName || order.cliente || "-";
                  const date =
                    order.timestamp || order.created_at || order.createdAt;
                  const progress = checklistProgress(order);
                  const itemSummary =
                    (order.items || [])
                      .map(
                        (item) =>
                          `${item.quantity || 0}x ${
                            item.name || item.productName || "Item"
                          }`,
                      )
                      .join(", ") || "-";

                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="block w-full rounded-xl bg-white p-4 text-left shadow transition hover:bg-purple-50"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase text-stone-500">
                            Pedido
                          </p>
                          <p className="break-all text-base font-black text-stone-950">
                            {order.id}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                            progress.complete
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-900"
                          }`}
                        >
                          {progress.done}/{progress.total}
                        </span>
                      </div>
                      <div className="grid gap-2 text-sm text-stone-700">
                        <div>
                          <span className="font-black">Cliente:</span>{" "}
                          {customer}
                        </div>
                        <div>
                          <span className="font-black">Itens:</span>{" "}
                          {itemSummary}
                        </div>
                        <div>
                          <span className="font-black">Total:</span>{" "}
                          {formatMoney(order.total)}
                        </div>
                        <div>
                          <span className="font-black">Data:</span>{" "}
                          {formatDate(date)}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
                            {order.paymentStatus || order.paymentType || "Pagamento -"}
                          </span>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
                            {order.entregueCliente ? "Entregue" : "Entrega pendente"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-lg bg-white shadow md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Pedido</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Itens</th>
                    <th className="px-4 py-3 text-left">Total</th>
                    <th className="px-4 py-3 text-left">Separacao</th>
                    <th className="px-4 py-3 text-left">Pagamento</th>
                    <th className="px-4 py-3 text-left">Entrega</th>
                    <th className="px-4 py-3 text-left">Observacao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loadingOrders ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
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
                      const progress = checklistProgress(order);
                      return (
                        <tr
                          key={order.id}
                          className="cursor-pointer hover:bg-purple-50/70"
                          onClick={() => setSelectedOrder(order)}
                        >
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
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ${
                                progress.complete
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-900"
                              }`}
                            >
                              {progress.done}/{progress.total} separado
                            </span>
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

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-purple-700">
                  Separacao do pedido
                </p>
                <h2 className="text-2xl font-black text-stone-900">
                  Pedido #{selectedOrder.id}
                </h2>
                <p className="mt-1 text-sm font-semibold text-stone-600">
                  Cliente:{" "}
                  {selectedOrder.userName ||
                    selectedOrder.customerName ||
                    selectedOrder.cliente ||
                    "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl bg-stone-100 px-4 py-2 font-bold text-stone-700 hover:bg-stone-200"
              >
                Fechar
              </button>
            </div>

            {(() => {
              const progress = checklistProgress(selectedOrder);
              const orderChecks = getOrderCheckedItems(selectedOrder.id);
              return (
                <>
                  <div className="mb-4 rounded-xl border border-purple-100 bg-purple-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="font-black text-purple-900">
                        Checklist de separacao
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-purple-800">
                        {progress.done}/{progress.total}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-purple-700 transition-all"
                        style={{
                          width:
                            progress.total > 0
                              ? `${(progress.done / progress.total) * 100}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(selectedOrder.items || []).map((item, index) => {
                      const itemKey = getItemKey(item, index);
                      const checked = Boolean(orderChecks[itemKey]);
                      return (
                        <label
                          key={itemKey}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                            checked
                              ? "border-green-200 bg-green-50"
                              : "border-stone-200 bg-white hover:bg-stone-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleItemChecked(selectedOrder.id, item, index)
                            }
                            className="mt-1 h-5 w-5 rounded border-stone-300 text-purple-700 focus:ring-purple-600"
                          />
                          <span className="flex-1">
                            <span className="block text-lg font-black text-stone-900">
                              {item.quantity || 0}x{" "}
                              {item.name || item.productName || "Item"}
                            </span>
                            <span className="text-sm font-semibold text-stone-500">
                              {checked ? "Separado" : "Pendente de separacao"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {selectedOrder.observation && (
                    <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-semibold text-yellow-900">
                      <span className="font-black">Observacao:</span>{" "}
                      {selectedOrder.observation}
                    </div>
                  )}

                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => openPdf(selectedOrder)}
                      className="rounded-xl bg-stone-800 px-4 py-3 font-black text-white hover:bg-stone-900"
                    >
                      Gerar PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => markPaid(selectedOrder)}
                      disabled={["paid", "authorized"].includes(
                        selectedOrder.paymentStatus || "",
                      )}
                      className="rounded-xl bg-green-600 px-4 py-3 font-black text-white hover:bg-green-700 disabled:bg-green-200 disabled:text-green-800"
                    >
                      {["paid", "authorized"].includes(
                        selectedOrder.paymentStatus || "",
                      )
                        ? "Pedido pago"
                        : "Marcar como pago"}
                    </button>
                    <button
                      type="button"
                      onClick={() => markDelivered(selectedOrder)}
                      disabled={selectedOrder.entregueCliente}
                      className="rounded-xl bg-purple-700 px-4 py-3 font-black text-white hover:bg-purple-800 disabled:bg-purple-200 disabled:text-purple-900"
                    >
                      {selectedOrder.entregueCliente
                        ? "Entregue ao cliente"
                        : "Entregar ao cliente"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeePage;
