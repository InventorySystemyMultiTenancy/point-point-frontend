import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Order } from "../types";
import { authenticatedFetch } from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import { getCurrentStoreId } from "../utils/tenantResolver";

// Página de Histórico de Pedidos com filtro por data
// (OrderHistoryPage)

const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const storeId = getCurrentStoreId();
      let url = `${BACKEND_URL}/api/orders/history`;
      const params: string[] = [];
      if (startDate) params.push(`start=${startDate}`);
      if (endDate) params.push(`end=${endDate}`);
      if (params.length > 0) url += `?${params.join("&")}`;
      const resp = await authenticatedFetch(url, {
        headers: {
          "x-store-id": storeId,
        },
      });
      if (!resp.ok) throw new Error("Erro ao buscar histórico de pedidos");
      const data: Order[] = await resp.json();
      setOrders(data);
    } catch (err) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line
  }, [startDate, endDate]);

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen bg-stone-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-amber-800">
          Histórico de Pedidos
        </h1>
        <button
          onClick={async () => {
            if (window.confirm("Deseja realmente sair?")) {
              await logout();
              navigate("/admin/login");
            }
          }}
          className="bg-amber-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-600 transition-colors shadow-md"
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
          }}
          className="bg-stone-300 text-stone-700 font-bold py-2 px-4 rounded-lg hover:bg-stone-400 transition-colors shadow-md"
        >
          Limpar Filtros
        </button>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
          <p className="text-stone-500 font-medium">Carregando histórico...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-stone-200 max-w-2xl mx-auto">
          <span className="text-6xl block mb-4">📭</span>
          <h2 className="text-2xl font-bold text-stone-700">
            Nenhum pedido encontrado
          </h2>
          <p className="text-stone-500 mt-2">
            Não há pedidos para o período selecionado.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl shadow-md p-6 border-l-4 border-amber-500"
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
              <div className="text-right text-stone-500 text-xs">
                Total: R${Number(order.total)?.toFixed(2) ?? "-"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistoryPage;
