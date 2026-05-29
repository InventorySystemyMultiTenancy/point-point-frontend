import React, { useState, useEffect } from "react";
import SuperAdminReceivablesDetails from "../components/SuperAdminReceivablesDetails";

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

import logo from "../assets/primeplush-logo.png";

const SuperAdminPage: React.FC = () => {
  const [data, setData] = useState<StatsData | null>(null);
  const [receivedOrderIds, setReceivedOrderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  useEffect(() => {
    if (loggedIn) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [loggedIn]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/super-admin/receivables`,
        {
          headers: {
            "x-super-admin-password": password,
          },
        },
      );
      if (!response.ok) throw new Error("Erro ao buscar dados");
      const result = await response.json();
      setData(result);
    } catch (e: any) {
      setError(e.message || "Erro ao buscar dados");
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Testa senha fazendo uma requisição
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/super-admin/receivables`,
        {
          headers: {
            "x-super-admin-password": password,
          },
        },
      );
      if (!response.ok) throw new Error("Senha incorreta ou não autorizado");
      const result = await response.json();
      setData(result);
      setLoggedIn(true);
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
            <img src={logo} alt="PrimePlush Logo" className="w-24 h-24 mb-2" />
            <h2 className="text-3xl font-bold text-purple-600">Super Admin</h2>
            <p className="text-gray-600 text-sm text-center">
              Controle Financeiro PrimePlush
            </p>
          </div>
          <input
            type="password"
            placeholder="Senha Super Admin"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
      // Log para depuração
      console.log(
        "[FRONTEND] Enviando POST para /api/super-admin/receivables/mark-received-by-ids",
        {
          url: `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/super-admin/receivables/mark-received-by-ids`,
          password,
          orderIds: pendingOrderIds,
        },
      );
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/super-admin/receivables/mark-received-by-ids`,
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
            {/* Histórico de repasses */}
            {data.history && data.history.length > 0 && (
              <div className="bg-white shadow-xl rounded-2xl p-2 sm:p-4 md:p-6 border-2 border-green-200 mt-4 sm:mt-8 overflow-x-auto">
                <h2 className="text-lg sm:text-xl font-bold text-green-800 mb-2 sm:mb-4">
                  Histórico de Repasses ao SuperAdmin
                </h2>
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-xs mb-2 min-w-[600px]">
                    <thead>
                      <tr className="bg-green-100">
                        <th className="py-1 px-2 text-left">Pedido</th>
                        <th className="py-1 px-2 text-left">Cliente</th>
                        <th className="py-1 px-2 text-left">Valor Total</th>
                        <th className="py-1 px-2 text-left">Data do Pedido</th>
                        <th className="py-1 px-2 text-left">Data do Repasse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.history.map((h, idx) => (
                        <tr
                          key={h.repasseId + "-" + h.pedidoId + "-" + idx}
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
                            {h.dataRepasse
                              ? new Date(h.dataRepasse).toLocaleString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Exibe valorRecebidoDetalhado se disponível */}
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
