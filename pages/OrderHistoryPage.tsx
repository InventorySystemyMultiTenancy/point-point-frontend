import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type {
  DeliveryMethod,
  DeliveryMethodValue,
  Order,
  ShippingCarrier,
} from "../types";
import Swal from "sweetalert2";
import {
  authenticatedFetch,
  deleteOrderFromHistory,
  getDeliveryMethods,
  getShippingCarriers,
  getToken,
  updateOrderDelivery,
} from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import { getRemainingQuantity, hasPartialDelivery } from "../utils/orderDelivery";

// Página de Histórico de Pedidos com filtro por data
// (OrderHistoryPage)

type MonthlyAlert = {
  userId: string;
  userName: string;
  month: string;
  orderCount: number;
  total: number;
  orderIds: string[];
  message?: string;
};

const DEFAULT_DELIVERY_METHODS: DeliveryMethod[] = [
  { value: "carrier", label: "Transportadora", requiresCarrier: true },
  { value: "pickup", label: "Retirada no local", requiresCarrier: false },
  { value: "in_person", label: "Presencial", requiresCarrier: false },
  { value: "contact", label: "Entrar em contato", requiresCarrier: false },
];

const DEFAULT_CARRIER: ShippingCarrier = {
  id: "carrier_uniao_express",
  name: "Uniao Express",
  trackingUrl: "https://www.uniaoexpress.com.br/rastreamento",
  active: true,
};

const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [showUndeliveredOnly, setShowUndeliveredOnly] = useState(false);
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [monthlyAlerts, setMonthlyAlerts] = useState<MonthlyAlert[]>([]);
  const [closingMonthlyUserId, setClosingMonthlyUserId] = useState<string | null>(
    null,
  );
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(
    DEFAULT_DELIVERY_METHODS,
  );
  const [shippingCarriers, setShippingCarriers] = useState<ShippingCarrier[]>([
    DEFAULT_CARRIER,
  ]);
  const [deliveryDrafts, setDeliveryDrafts] = useState<
    Record<string, { deliveryMethod: DeliveryMethodValue; carrierId: string }>
  >({});
  const [savingDeliveryOrderId, setSavingDeliveryOrderId] = useState<
    string | null
  >(null);
  const [deliveringOrderId, setDeliveringOrderId] = useState<string | null>(
    null,
  );
  const [partialDeliveryOrderId, setPartialDeliveryOrderId] = useState<
    string | null
  >(null);
  const [partialDeliveryQuantities, setPartialDeliveryQuantities] = useState<
    Record<string, string>
  >({});
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkMarkingPaid, setBulkMarkingPaid] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
  const isAdmin = currentUser?.role === "admin";

  const isMonthlyOrder = (order: Order) =>
    Boolean(
      order.canMonthlyClose ||
        order.monthlyBilling ||
        order.userMonthlyPayment ||
      order.paymentMethod === "a_prazo",
    );

  const isPayable = (order: Order) =>
    order.paymentType === "presencial" &&
    order.paymentStatus === "pending" &&
    !isMonthlyOrder(order);

  const formatMoney = (value: number) =>
    Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const escapeHtml = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char] || char,
    );

  const getErrorMessageByStatus = (status?: number) => {
    if (status === 401 || status === 403) {
      return "Permissão negada ou sessão expirada. Faça login novamente.";
    }
    if (status === 404) {
      return "Este pedido já não existe no histórico.";
    }
    if (status === 500) {
      return "Erro interno do servidor. Tente novamente em instantes.";
    }
    return "Não foi possível excluir o pedido agora. Tente novamente.";
  };

  const handleDeleteFromHistory = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAdmin || deletingOrderId === order.id) return;

    const confirm = await Swal.fire({
      title: "Excluir pedido do histórico?",
      text: "Esta ação é irreversível na interface e o pedido deixará de aparecer no histórico.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirm.isConfirmed) return;

    setDeletingOrderId(order.id);

    try {
      const token = getToken() || "";
      const result = await deleteOrderFromHistory(order.id, token);

      if (result.ok) {
        setOrders((prev) => prev.filter((item) => item.id !== order.id));
        await Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: result.message || "Pedido excluído do histórico",
          showConfirmButton: false,
          timer: 2200,
          timerProgressBar: true,
        });
      }
    } catch (error: any) {
      const status = error?.status as number | undefined;
      await Swal.fire({
        icon: "error",
        title: "Falha ao excluir pedido",
        text: getErrorMessageByStatus(status),
        confirmButtonText: "Tentar novamente",
      });
    } finally {
      setDeletingOrderId(null);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let url = `${BACKEND_URL}/api/orders/history`;
      const params: string[] = [];
      if (startDate) params.push(`start=${startDate}`);
      if (endDate) params.push(`end=${endDate}`);
      if (params.length > 0) url += `?${params.join("&")}`;
      const resp = await authenticatedFetch(url);
      if (!resp.ok) throw new Error("Erro ao buscar histórico de pedidos");
      const data: Order[] = await resp.json();
      setOrders(data);
    } catch (err) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyAlerts = async () => {
    try {
      const resp = await authenticatedFetch(
        `${BACKEND_URL}/api/orders/history/monthly-alerts`,
      );
      if (!resp.ok) throw new Error("Erro ao buscar alertas mensais");
      const data = await resp.json();
      setMonthlyAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (err) {
      console.error("Erro ao buscar alertas mensais:", err);
      setMonthlyAlerts([]);
    }
  };

  const normalizeCarriers = (data: any): ShippingCarrier[] => {
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.carriers)
        ? data.carriers
        : Array.isArray(data.data)
          ? data.data
          : [];
    const hasDefault = list.some(
      (carrier: ShippingCarrier) => carrier.id === DEFAULT_CARRIER.id,
    );
    return hasDefault ? list : [DEFAULT_CARRIER, ...list];
  };

  const fetchDeliveryOptions = async () => {
    try {
      const [methodsData, carriersData] = await Promise.all([
        getDeliveryMethods().catch(() => DEFAULT_DELIVERY_METHODS),
        getShippingCarriers().catch(() => [DEFAULT_CARRIER]),
      ]);
      if (Array.isArray(methodsData) && methodsData.length > 0) {
        setDeliveryMethods(methodsData);
      }
      setShippingCarriers(normalizeCarriers(carriersData));
    } catch (err) {
      console.error("Erro ao buscar opcoes de entrega:", err);
      setDeliveryMethods(DEFAULT_DELIVERY_METHODS);
      setShippingCarriers([DEFAULT_CARRIER]);
    }
  };

  const reloadHistory = async () => {
    await Promise.all([fetchOrders(), fetchMonthlyAlerts()]);
  };

  const getDeliveryDraft = (order: Order) =>
    deliveryDrafts[order.id] || {
      deliveryMethod: order.deliveryMethod || "contact",
      carrierId: order.carrierId || order.shippingCarrier?.id || "",
    };

  const setDeliveryDraft = (
    order: Order,
    draft: Partial<{ deliveryMethod: DeliveryMethodValue; carrierId: string }>,
  ) => {
    const current = getDeliveryDraft(order);
    const next = {
      ...current,
      ...draft,
    };
    if (next.deliveryMethod !== "carrier") {
      next.carrierId = "";
    }
    setDeliveryDrafts((prev) => ({ ...prev, [order.id]: next }));
  };

  const handleSaveDelivery = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    const draft = getDeliveryDraft(order);
    setSavingDeliveryOrderId(order.id);
    try {
      const data = await updateOrderDelivery(order.id, {
        deliveryMethod: draft.deliveryMethod,
        carrierId: draft.deliveryMethod === "carrier" ? draft.carrierId || null : null,
      });
      const updatedOrder = data.order || data;
      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id ? { ...item, ...updatedOrder } : item,
        ),
      );
      setDeliveryDrafts((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    } catch (err) {
      console.error("Erro ao atualizar entrega:", err);
      alert("Erro ao atualizar entrega do pedido.");
    } finally {
      setSavingDeliveryOrderId(null);
    }
  };

  const submitOrderDelivery = async (
    order: Order,
    body: { mode: "all" } | { items: { productId: string; quantity: number }[] },
  ) => {
    setDeliveringOrderId(order.id);
    try {
      const resp = await authenticatedFetch(
        `${BACKEND_URL}/api/orders/${order.id}/deliveries`,
        { method: "POST", body: JSON.stringify(body) },
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || "Erro ao registrar entrega");
      }
      localStorage.setItem("backorderedProductsUpdatedAt", String(Date.now()));
      setPartialDeliveryOrderId(null);
      await reloadHistory();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao registrar entrega");
    } finally {
      setDeliveringOrderId(null);
    }
  };

  const handleDeliverAll = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    submitOrderDelivery(order, { mode: "all" });
  };

  const togglePartialDelivery = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    if (partialDeliveryOrderId === order.id) {
      setPartialDeliveryOrderId(null);
      return;
    }
    const defaults: Record<string, string> = {};
    order.items.forEach((item) => {
      const remaining = getRemainingQuantity(order, item);
      if (remaining > 0) defaults[item.productId] = String(remaining);
    });
    setPartialDeliveryQuantities(defaults);
    setPartialDeliveryOrderId(order.id);
  };

  const submitPartialDelivery = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    const items = order.items
      .map((item) => ({
        productId: item.productId,
        quantity: Number(partialDeliveryQuantities[item.productId] || 0),
      }))
      .filter((item) => item.quantity > 0);
    if (items.length === 0) {
      alert("Informe ao menos uma quantidade a entregar.");
      return;
    }
    submitOrderDelivery(order, { items });
  };

  const handleMonthlyClosing = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!order.userId || closingMonthlyUserId === order.userId) return;

    setClosingMonthlyUserId(order.userId);
    try {
      const resp = await authenticatedFetch(
        `${BACKEND_URL}/api/users/${order.userId}/monthly-closing`,
        {
          method: "POST",
          body: JSON.stringify({
            closedBy: currentUser?.name || currentUser?.email || "Admin",
          }),
        },
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || data.message || "Erro ao fazer fechamento");
      }

      await reloadHistory();
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `Fechamento mensal feito: ${data.updatedCount ?? 0} pedido(s) atualizado(s).`,
        showConfirmButton: false,
        timer: 2600,
        timerProgressBar: true,
      });
    } catch (err: any) {
      await Swal.fire({
        icon: "error",
        title: "Falha no fechamento mensal",
        text: err.message || "Não foi possível fazer o fechamento mensal.",
        confirmButtonText: "Tentar novamente",
      });
    } finally {
      setClosingMonthlyUserId(null);
    }
  };

  useEffect(() => {
    reloadHistory();
    // eslint-disable-next-line
  }, [startDate, endDate]);

  useEffect(() => {
    fetchDeliveryOptions();
  }, []);

  const filteredOrders = orders.filter((order) => {
    const isUndelivered = !order.entregueCliente;
    const isUnpaid = !["paid", "authorized"].includes(
      order.paymentStatus ?? "pending",
    );
    const clientName = (order.userName || "").toLowerCase();
    const clientSearch = clientFilter.trim().toLowerCase();

    if (clientSearch && !clientName.includes(clientSearch)) {
      return false;
    }

    if (showUndeliveredOnly && !isUndelivered) {
      return false;
    }

    if (showUnpaidOnly && !isUnpaid) {
      return false;
    }

    return true;
  });

  const payableFilteredOrders = filteredOrders.filter(isPayable);
  const allPayableSelected =
    payableFilteredOrders.length > 0 &&
    payableFilteredOrders.every((order) => selectedOrderIds.has(order.id));

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allPayableSelected) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(payableFilteredOrders.map((order) => order.id)));
    }
  };

  const handleBulkMarkPaid = async () => {
    const idsToMark = payableFilteredOrders
      .filter((order) => selectedOrderIds.has(order.id))
      .map((order) => order.id);

    if (idsToMark.length === 0) return;

    const confirm = await Swal.fire({
      title: `Marcar ${idsToMark.length} pedido(s) como pago?`,
      text: "Todos os pedidos selecionados serão marcados como totalmente pagos.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, marcar como pago",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirm.isConfirmed) return;

    setBulkMarkingPaid(true);
    try {
      const results = await Promise.all(
        idsToMark.map((id) =>
          authenticatedFetch(`${BACKEND_URL}/api/orders/${id}/mark-paid`, {
            method: "PUT",
          })
            .then((resp) => ({ id, ok: resp.ok }))
            .catch(() => ({ id, ok: false })),
        ),
      );
      const failedCount = results.filter((result) => !result.ok).length;

      setSelectedOrderIds(new Set());
      await reloadHistory();

      if (failedCount > 0) {
        await Swal.fire({
          icon: "warning",
          title: "Alguns pedidos não foram marcados",
          text: `${failedCount} de ${idsToMark.length} pedido(s) falharam. Tente novamente.`,
        });
      } else {
        await Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: `${idsToMark.length} pedido(s) marcado(s) como pago`,
          showConfirmButton: false,
          timer: 2200,
          timerProgressBar: true,
        });
      }
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Erro ao marcar pedidos como pago",
        text: "Não foi possível concluir a operação. Tente novamente.",
      });
    } finally {
      setBulkMarkingPaid(false);
    }
  };

  const clientOptions = Array.from(
    new Set(
      orders
        .map((order) => order.userName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const generateClientOrdersPdf = () => {
    const clientName = clientFilter.trim();
    if (!clientName) {
      alert("Filtre por cliente antes de gerar o PDF.");
      return;
    }
    if (filteredOrders.length === 0) {
      alert("Nenhum pedido encontrado para gerar PDF.");
      return;
    }

    const rows = filteredOrders
      .map(
        (order) => `
          <tr>
            <td>${escapeHtml(order.userName || "-")}</td>
            <td>#${escapeHtml(order.id.slice(-4))}</td>
            <td>${escapeHtml(new Date(order.timestamp).toLocaleDateString("pt-BR"))}</td>
            <td class="right">${escapeHtml(formatMoney(Number(order.total) || 0))}</td>
          </tr>
        `,
      )
      .join("");
    const total = filteredOrders.reduce(
      (sum, order) => sum + (Number(order.total) || 0),
      0,
    );
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      alert("Permita pop-ups para gerar o PDF.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Pedidos de ${escapeHtml(clientName)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1c1917; padding: 32px; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            p { margin: 0 0 24px; color: #57534e; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #d6d3d1; padding: 10px 8px; text-align: left; font-size: 13px; }
            th { background: #f5f5f4; font-size: 12px; text-transform: uppercase; }
            .right { text-align: right; }
            tfoot td { font-weight: 700; border-top: 2px solid #1c1917; }
          </style>
        </head>
        <body>
          <h1>Pedidos de ${escapeHtml(clientName)}</h1>
          <p>${filteredOrders.length} pedido(s) filtrado(s)</p>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Pedido</th>
                <th>Data</th>
                <th class="right">Valor</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total</td>
                <td class="right">${escapeHtml(formatMoney(total))}</td>
              </tr>
            </tfoot>
          </table>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen bg-stone-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-blue-800">
          Histórico de Pedidos
        </h1>
        <button
          onClick={async () => {
            if (window.confirm("Deseja realmente sair?")) {
              await logout();
              navigate("/admin/login");
            }
          }}
          className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          🚪 Sair
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Data Inicial
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Data Final
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Cliente
          </label>
          <input
            list="order-client-options"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            placeholder="Nome do cliente"
            className="border rounded px-2 py-1"
          />
          <datalist id="order-client-options">
            {clientOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700 pb-2">
          <input
            type="checkbox"
            checked={showUndeliveredOnly}
            onChange={(e) => setShowUndeliveredOnly(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
          />
          Não entregues
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700 pb-2">
          <input
            type="checkbox"
            checked={showUnpaidOnly}
            onChange={(e) => setShowUnpaidOnly(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
          />
          Não pagos
        </label>
        <button
          onClick={fetchOrders}
          className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          Filtrar
        </button>
        <button
          onClick={() => {
            setStartDate("");
            setEndDate("");
            setClientFilter("");
            setShowUndeliveredOnly(false);
            setShowUnpaidOnly(false);
          }}
          className="bg-stone-300 text-stone-700 font-bold py-2 px-4 rounded-lg hover:bg-stone-400 transition-colors shadow-md"
        >
          Limpar Filtros
        </button>
        <button
          onClick={generateClientOrdersPdf}
          disabled={!clientFilter.trim() || filteredOrders.length === 0}
          className="bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors shadow-md disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed"
        >
          PDF do Cliente
        </button>
      </div>
      {monthlyAlerts.length > 0 && (
        <div className="mb-6 rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-amber-900">
            Alertas de débito mensal
          </h2>
          <div className="space-y-3">
            {monthlyAlerts.map((alert) => (
              <div
                key={`${alert.userId}-${alert.month}`}
                className="rounded-lg border border-amber-200 bg-white p-3"
              >
                <div className="font-semibold text-amber-950">
                  {alert.userName} está devendo todos os pedidos do mês passado.
                </div>
                <div className="mt-1 text-sm text-amber-800">
                  {alert.orderCount} pedido(s) em aberto · Total: R${" "}
                  {Number(alert.total || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
          <p className="text-stone-500 font-medium">Carregando histórico...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-stone-200 max-w-2xl mx-auto">
          <span className="text-6xl block mb-4">📭</span>
          <h2 className="text-2xl font-bold text-stone-700">
            Nenhum pedido encontrado
          </h2>
          <p className="text-stone-500 mt-2">
            Não há pedidos para os filtros selecionados.
          </p>
        </div>
      ) : (
        <>
          {payableFilteredOrders.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 bg-white rounded-xl shadow-sm p-3 border border-stone-200">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-4 py-2 rounded-lg bg-stone-700 text-white text-sm font-bold hover:bg-stone-800 transition"
              >
                {allPayableSelected
                  ? "Desmarcar todos"
                  : `Selecionar todos (${payableFilteredOrders.length})`}
              </button>
              <button
                type="button"
                onClick={handleBulkMarkPaid}
                disabled={selectedOrderIds.size === 0 || bulkMarkingPaid}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition disabled:bg-stone-300 disabled:cursor-not-allowed"
              >
                {bulkMarkingPaid
                  ? "Marcando..."
                  : `Marcar selecionados como pago (${selectedOrderIds.size})`}
              </button>
            </div>
          )}
          <div className="space-y-6">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-600 cursor-pointer hover:shadow-lg transition"
              onClick={() =>
                navigate("/historico/detalhes", { state: { order } })
              }
            >
              <div className="flex flex-wrap justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  {isPayable(order) && (
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.has(order.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleOrderSelection(order.id)}
                      title="Selecionar para marcar como pago"
                      className="h-5 w-5 rounded border-stone-300 text-green-600 focus:ring-green-500"
                    />
                  )}
                  <div className="font-bold text-lg text-stone-800">
                    Pedido #{order.id.slice(-4)}
                  </div>
                </div>
                <div className="text-sm text-stone-500">
                  {new Date(order.timestamp).toLocaleString()}
                </div>
              </div>
              <div className="mb-2 text-stone-700">
                <span className="font-semibold">Cliente:</span>{" "}
                {order.userName || "-"}
              </div>
              <ul className="mb-2">
                {order.items.map((item, idx) => {
                  const remaining = getRemainingQuantity(order, item);
                  const delivered = item.quantity - remaining;
                  return (
                    <li key={idx} className="text-stone-800">
                      <span className="font-semibold">{item.quantity}x</span>{" "}
                      {item.name}
                      {!order.entregueCliente && delivered > 0 && (
                        <span className="ml-2 text-xs font-bold text-emerald-700">
                          (entregue {delivered}/{item.quantity})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {order.observation && (
                <div className="mb-2 text-yellow-800 bg-yellow-100 rounded p-2">
                  <span className="font-semibold">Observação:</span>{" "}
                  {order.observation}
                </div>
              )}
              <div
                className="mb-3 rounded-lg border border-stone-200 bg-stone-50 p-3"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-2 text-sm text-stone-700">
                  <span className="font-semibold">Entrega:</span>{" "}
                  {order.deliveryMethodLabel ||
                    deliveryMethods.find(
                      (method) => method.value === order.deliveryMethod,
                    )?.label ||
                    "Entrar em contato"}
                  {order.deliveryMethod === "carrier" && (
                    <span className="ml-3">
                      <span className="font-semibold">Transportadora:</span>{" "}
                      {order.shippingCarrier?.name || "Nao definida"}
                    </span>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <select
                    value={getDeliveryDraft(order).deliveryMethod}
                    onChange={(event) =>
                      setDeliveryDraft(order, {
                        deliveryMethod: event.target.value as DeliveryMethodValue,
                      })
                    }
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-800 focus:border-blue-600 focus:outline-none"
                  >
                    {deliveryMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                  {getDeliveryDraft(order).deliveryMethod === "carrier" ? (
                    <select
                      value={getDeliveryDraft(order).carrierId}
                      onChange={(event) =>
                        setDeliveryDraft(order, {
                          carrierId: event.target.value,
                        })
                      }
                      className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-800 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="">Transportadora nao definida</option>
                      {shippingCarriers
                        .filter((carrier) => carrier.active !== false)
                        .map((carrier) => (
                          <option key={carrier.id} value={carrier.id}>
                            {carrier.name}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <div className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-stone-500">
                      Sem transportadora
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(event) => handleSaveDelivery(order, event)}
                    disabled={savingDeliveryOrderId === order.id}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {savingDeliveryOrderId === order.id
                      ? "Salvando..."
                      : "Salvar entrega"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap justify-between items-end mt-2 gap-2">
                <div className="text-stone-500 text-xs">
                  Total: R${Number(order.total)?.toFixed(2) ?? "-"}
                </div>
                {/* Exibe status do pagamento */}
                {order.paymentType === "presencial" &&
                  order.paymentStatus === "pending" && (
                    <>
                      <span className="text-blue-600 font-bold">
                        {isMonthlyOrder(order) ? "A PRAZO" : "A PAGAR"}
                      </span>
                      {isMonthlyOrder(order) ? (
                        <button
                          className="px-3 py-1 rounded bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 transition disabled:bg-blue-300 disabled:cursor-not-allowed"
                          onClick={(e) => handleMonthlyClosing(order, e)}
                          disabled={closingMonthlyUserId === order.userId}
                        >
                          {closingMonthlyUserId === order.userId
                            ? "Baixando..."
                            : "Dar baixa mensal"}
                        </button>
                      ) : (
                        <button
                          className="px-3 py-1 rounded bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition"
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Chama endpoint para marcar como pago
                            const resp = await authenticatedFetch(
                              `${BACKEND_URL}/api/orders/${order.id}/mark-paid`,
                              { method: "PUT" },
                            );
                            if (resp.ok) {
                              reloadHistory();
                            } else {
                              alert("Erro ao marcar como pago");
                            }
                          }}
                        >
                          Marcar como pago
                        </button>
                      )}
                    </>
                  )}
                {order.canMonthlyClose && order.paymentStatus !== "pending" && (
                  <button
                    className="px-3 py-1 rounded bg-blue-700 text-white text-xs font-bold hover:bg-blue-800 transition disabled:bg-blue-300 disabled:cursor-not-allowed"
                    onClick={(e) => handleMonthlyClosing(order, e)}
                    disabled={closingMonthlyUserId === order.userId}
                  >
                    {closingMonthlyUserId === order.userId
                      ? "Fechando..."
                      : "Dar baixa mensal"}
                  </button>
                )}
                {/* Botão entregar ao cliente */}
                {order.entregueCliente ? (
                  <button
                    className="px-3 py-1 rounded text-xs font-bold bg-green-500 text-white"
                    disabled
                    title="Já entregue ao cliente"
                  >
                    Entregue ao Cliente ✔
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {hasPartialDelivery(order) && (
                      <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-bold">
                        Entrega parcial
                      </span>
                    )}
                    <button
                      className="px-3 py-1 rounded text-xs font-bold transition bg-yellow-400 text-stone-800 hover:bg-yellow-500 disabled:opacity-60"
                      onClick={(e) => handleDeliverAll(order, e)}
                      disabled={deliveringOrderId === order.id}
                      title="Marcar como totalmente entregue"
                    >
                      {deliveringOrderId === order.id
                        ? "Entregando..."
                        : "Entregar tudo"}
                    </button>
                    <button
                      className="px-3 py-1 rounded text-xs font-bold transition bg-stone-200 text-stone-800 hover:bg-stone-300"
                      onClick={(e) => togglePartialDelivery(order, e)}
                      title="Entregar apenas parte do pedido"
                    >
                      {partialDeliveryOrderId === order.id
                        ? "Cancelar entrega parcial"
                        : "Entrega parcial"}
                    </button>
                  </div>
                )}
                {isAdmin && (
                  <button
                    className="px-3 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition disabled:bg-red-300 disabled:cursor-not-allowed"
                    onClick={(e) => handleDeleteFromHistory(order, e)}
                    disabled={deletingOrderId === order.id}
                    title="Excluir pedido do histórico"
                  >
                    {deletingOrderId === order.id ? "Excluindo..." : "Excluir"}
                  </button>
                )}
              </div>
              {partialDeliveryOrderId === order.id && (
                <div
                  className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <p className="mb-2 text-sm font-bold text-amber-900">
                    Informe a quantidade entregue de cada produto
                  </p>
                  <div className="space-y-2">
                    {order.items.map((item, idx) => {
                      const remaining = getRemainingQuantity(order, item);
                      if (remaining <= 0) return null;
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[1fr_100px] items-center gap-2"
                        >
                          <span className="text-sm text-stone-700">
                            {item.name}{" "}
                            <span className="text-xs text-stone-500">
                              (restam {remaining})
                            </span>
                          </span>
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            step="1"
                            value={partialDeliveryQuantities[item.productId] ?? ""}
                            onChange={(event) =>
                              setPartialDeliveryQuantities((prev) => ({
                                ...prev,
                                [item.productId]: event.target.value,
                              }))
                            }
                            className="rounded-lg border border-stone-300 px-2 py-1 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-60"
                    onClick={(e) => submitPartialDelivery(order, e)}
                    disabled={deliveringOrderId === order.id}
                  >
                    {deliveringOrderId === order.id
                      ? "Salvando..."
                      : "Salvar entrega parcial"}
                  </button>
                </div>
              )}
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OrderHistoryPage;
