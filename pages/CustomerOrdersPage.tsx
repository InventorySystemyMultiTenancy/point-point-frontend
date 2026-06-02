import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import type { Order, OrderItem } from "../types";
import { formatMoney, toMoneyNumber } from "../utils/money";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const looksLikeCents = (value: number) =>
  Number.isInteger(value) && Math.abs(value) >= 1000;

const shouldDisplayOrderAsCents = (order: Order) => {
  const total = toMoneyNumber(order.total);
  const itemsTotal = order.items.reduce(
    (sum, item) => sum + toMoneyNumber(item.price) * Number(item.quantity || 0),
    0,
  );

  if (!looksLikeCents(total)) return false;
  if (itemsTotal > 0 && Math.abs(total / 100 - itemsTotal) < 0.01) {
    return true;
  }

  return (
    itemsTotal > 0 &&
    Math.abs(total - itemsTotal) < 0.01 &&
    order.items.every((item) => looksLikeCents(toMoneyNumber(item.price)))
  );
};

const getDisplayItemPrice = (item: OrderItem, useCents: boolean) => {
  const price = toMoneyNumber(item.price);
  return useCents ? price / 100 : price;
};

const getDisplayOrderTotal = (order: Order) => {
  const useCents = shouldDisplayOrderAsCents(order);
  const itemsTotal = order.items.reduce(
    (sum, item) =>
      sum +
      getDisplayItemPrice(item, useCents) * Number(item.quantity || 0),
    0,
  );

  if (itemsTotal > 0) return itemsTotal;
  const total = toMoneyNumber(order.total);
  return useCents ? total / 100 : total;
};

const getPreparationStatus = (order: Order) =>
  order.entregueCliente ? "Pronto para retirada" : "Em montagem";

const CustomerOrdersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    const fetchOrders = async () => {
      setLoading(true);
      setError("");
      try {
        const resp = await fetch(
          `${BACKEND_URL}/api/users/${currentUser.id}/orders`,
        );
        if (!resp.ok) throw new Error("Erro ao buscar pedidos");
        const data = await resp.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        setError("Erro ao buscar pedidos. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
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
        <ul className="space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="bg-white rounded-xl shadow p-4 border border-stone-200"
            >
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
                    order.entregueCliente ? "text-green-700" : "text-blue-700"
                  }`}
                >
                  {getPreparationStatus(order)}
                </span>
              </div>
              <ul className="text-sm text-stone-700">
                {order.items.map((item, idx) => {
                  const useCents = shouldDisplayOrderAsCents(order);
                  return (
                    <li key={item.productId || idx}>
                      {item.name} x {item.quantity} - R${" "}
                      {formatMoney(getDisplayItemPrice(item, useCents))}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomerOrdersPage;
