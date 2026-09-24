import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import type { Order, OrderItem } from "../types";
import { authenticatedFetch } from "../services/apiService";
import { formatMoney, toMoneyNumber } from "../utils/money";
import { getOrderDeliveryProgress, getRemainingQuantity } from "../utils/orderDelivery";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const looksLikeCents = (value: number) =>
  Number.isInteger(value) && Math.abs(value) >= 1000;

const getDisplayItemPrice = (item: OrderItem) => {
  const price = toMoneyNumber(item.price);
  return looksLikeCents(price) ? price / 100 : price;
};

const getDisplayOrderTotal = (order: Order) => {
  const itemsTotal = order.items.reduce(
    (sum, item) => sum + getDisplayItemPrice(item) * Number(item.quantity || 0),
    0,
  );

  if (itemsTotal > 0) return itemsTotal;
  const total = toMoneyNumber(order.total);
  return looksLikeCents(total) ? total / 100 : total;
};

const getPreparationStatus = (order: Order) => {
  if (order.entregueCliente) return "Entregue";
  const { delivered, total } = getOrderDeliveryProgress(order);
  if (delivered > 0 && delivered < total) {
    return `Entrega parcial (${delivered}/${total})`;
  }
  return "Em montagem";
};

const getDeliveryLabel = (order: Order) =>
  order.deliveryMethodLabel ||
  (order.deliveryMethod === "carrier"
    ? "Transportadora"
    : order.deliveryMethod === "pickup"
      ? "Retirada no local"
      : order.deliveryMethod === "in_person"
        ? "Presencial"
        : "Entrar em contato");

const CustomerOrdersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(
    null,
  );

  const handleConfirmReceipt = async (order: Order) => {
    setConfirmingOrderId(order.id);
    try {
      const resp = await authenticatedFetch(
        `${BACKEND_URL}/api/orders/${order.id}/confirm-receipt`,
        { method: "POST" },
      );
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 401 || /token/i.test(data.error || "")) {
        throw new Error(
          "Sua sessão expirou. Entre novamente para confirmar o recebimento.",
        );
      }
      if (!resp.ok) {
        throw new Error(data.error || "Erro ao confirmar recebimento");
      }
      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
                ...item,
                recebimentoConfirmado: true,
                recebimentoConfirmadoAt:
                  data.order?.recebimentoConfirmadoAt || new Date().toISOString(),
              }
            : item,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao confirmar recebimento");
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const ordersAwaitingConfirmation = orders.filter(
    (order) => order.entregueCliente && !order.recebimentoConfirmado,
  );

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    const fetchOrders = async (isInitialLoad: boolean) => {
      if (isInitialLoad) setLoading(true);
      setError("");
      try {
        const resp = await fetch(
          `${BACKEND_URL}/api/users/${currentUser.id}/orders`,
        );
        if (!resp.ok) throw new Error("Erro ao buscar pedidos");
        const data = await resp.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        if (isInitialLoad) setError("Erro ao buscar pedidos. Tente novamente.");
      } finally {
        if (isInitialLoad) setLoading(false);
      }
    };
    fetchOrders(true);

    // Atualiza o status de entrega periodicamente para refletir marcacoes do
    // admin (entrega parcial ou pedido totalmente entregue) sem precisar recarregar.
    const intervalId = setInterval(() => fetchOrders(false), 15000);
    return () => clearInterval(intervalId);
  }, [currentUser, navigate]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Meus Pedidos</h1>
      {loading ? (
        <p>Carregando...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : orders.length === 0 ? (
        <p>Você ainda não fez nenhum pedido.</p>
      ) : (
        <>
        {ordersAwaitingConfirmation.length > 0 && (
          <div className="mb-4 rounded-xl border border-green-300 bg-green-50 p-4 text-green-900">
            <p className="font-bold">
              📦 {ordersAwaitingConfirmation.length === 1
                ? "1 pedido foi entregue a você"
                : `${ordersAwaitingConfirmation.length} pedidos foram entregues a você`}
            </p>
            <p className="text-sm">
              Confira os itens e confirme o recebimento no pedido abaixo.
            </p>
          </div>
        )}
        <ul className="space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="bg-white rounded-xl shadow p-4 border border-stone-200"
            >
              {order.entregueCliente && (
                <div
                  className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${
                    order.recebimentoConfirmado
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-green-300 bg-green-50 text-green-900"
                  }`}
                >
                  {order.recebimentoConfirmado ? (
                    <span className="text-sm font-bold">
                      ✔ Recebimento confirmado
                      {order.recebimentoConfirmadoAt &&
                        ` em ${new Date(order.recebimentoConfirmadoAt).toLocaleString("pt-BR")}`}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm font-bold">
                        📦 Este pedido já foi entregue a você
                        {order.completedAt &&
                          ` em ${new Date(order.completedAt).toLocaleString("pt-BR")}`}
                        .
                      </span>
                      <button
                        type="button"
                        onClick={() => handleConfirmReceipt(order)}
                        disabled={confirmingOrderId === order.id}
                        className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {confirmingOrderId === order.id
                          ? "Confirmando..."
                          : "Confirmar recebimento"}
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-lg">Pedido #{order.id}</span>
                <span className="text-sm text-stone-500">
                  {new Date(order.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">Total:</span> R${" "}
                {formatMoney(getDisplayOrderTotal(order))}
                {order.paymentStatus === "pending" && (
                  <span className="ml-2 text-red-600 font-bold">A pagar</span>
                )}
              </div>
              <div className="mb-2">
                <span className="font-semibold">Separação:</span>{" "}
                <span
                  className={`font-bold ${
                    order.entregueCliente
                      ? "text-green-700"
                      : getOrderDeliveryProgress(order).delivered > 0
                        ? "text-amber-600"
                        : "text-blue-700"
                  }`}
                >
                  {getPreparationStatus(order)}
                </span>
              </div>
              <div className="mb-2">
                <span className="font-semibold">Entrega:</span>{" "}
                {getDeliveryLabel(order)}
                {order.deliveryMethod === "carrier" && order.shippingCarrier?.name && (
                  <span className="ml-2 text-sm text-stone-500">
                    ({order.shippingCarrier.name})
                  </span>
                )}
              </div>
              <div className="mb-2">
                {order.deliveryMethod === "carrier" && order.trackingUrl ? (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800"
                  >
                    {order.trackingMessage || "Acompanhar entrega"}
                  </a>
                ) : (
                  <span className="text-sm font-semibold text-stone-600">
                    Entrar em contato para rastrear
                  </span>
                )}
              </div>
              <ul className="text-sm text-stone-700">
                {order.items.map((item, idx) => {
                  const remaining = getRemainingQuantity(order, item);
                  const delivered = item.quantity - remaining;
                  return (
                    <li key={item.productId || idx}>
                      {item.name} x {item.quantity} - R${" "}
                      {formatMoney(getDisplayItemPrice(item))}
                      {!order.entregueCliente && delivered > 0 && (
                        <span className="ml-2 text-xs font-bold text-amber-600">
                          (entregue {delivered}/{item.quantity})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  );
};

export default CustomerOrdersPage;
