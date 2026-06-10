import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Order } from "../types";
import Swal from "sweetalert2";
import {
  authenticatedFetch,
  deleteOrderFromHistory,
  getToken,
} from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";

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

const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showUndeliveredOnly, setShowUndeliveredOnly] = useState(false);
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [monthlyAlerts, setMonthlyAlerts] = useState<MonthlyAlert[]>([]);
  const [closingMonthlyUserId, setClosingMonthlyUserId] = useState<string | null>(
    null,
  );

  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
  const isAdmin = currentUser?.role === "admin";

  const isMonthlyOrder = (order: Order) =>
    Boolean(
      order.canMonthlyClose ||
        order.monthlyBilling ||
        order.userMonthlyPayment ||
        order.paymentMethod === "a_prazo",
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

  const reloadHistory = async () => {
    await Promise.all([fetchOrders(), fetchMonthlyAlerts()]);
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

  const filteredOrders = orders.filter((order) => {
    const isUndelivered = !order.entregueCliente;
    const isUnpaid = !["paid", "authorized"].includes(
      order.paymentStatus ?? "pending",
    );

    if (showUndeliveredOnly && !isUndelivered) {
      return false;
    }

    if (showUnpaidOnly && !isUnpaid) {
      return false;
    }

    return true;
  });

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
            setShowUndeliveredOnly(false);
            setShowUnpaidOnly(false);
          }}
          className="bg-stone-300 text-stone-700 font-bold py-2 px-4 rounded-lg hover:bg-stone-400 transition-colors shadow-md"
        >
          Limpar Filtros
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
                <div className="font-bold text-lg text-stone-800">
                  Pedido #{order.id.slice(-4)}
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
                {order.items.map((item, idx) => (
                  <li key={idx} className="text-stone-800">
                    <span className="font-semibold">{item.quantity}x</span>{" "}
                    {item.name}
                  </li>
                ))}
              </ul>
              {order.observation && (
                <div className="mb-2 text-yellow-800 bg-yellow-100 rounded p-2">
                  <span className="font-semibold">Observação:</span>{" "}
                  {order.observation}
                </div>
              )}
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
                <button
                  className={`px-3 py-1 rounded text-xs font-bold transition ${order.entregueCliente ? "bg-green-500 text-white" : "bg-yellow-400 text-stone-800 hover:bg-yellow-500"}`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const resp = await authenticatedFetch(
                      `${BACKEND_URL}/api/orders/${order.id}/mark-delivered`,
                      { method: "PUT" },
                    );
                    if (resp.ok) {
                      fetchOrders();
                    } else {
                      alert("Erro ao marcar como entregue");
                    }
                  }}
                  disabled={order.entregueCliente}
                  title={
                    order.entregueCliente
                      ? "Já entregue ao cliente"
                      : "Marcar como entregue"
                  }
                >
                  {order.entregueCliente
                    ? "Entregue ao Cliente ✔"
                    : "Entregar ao Cliente"}
                </button>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistoryPage;
