import React from "react";

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
  paymentMethod?: string;
}

interface SuperAdminReceivablesDetailsProps {
  orders: OrderDetail[];
  totalToReceive: number;
  totalReceived: number;
  alreadyReceived: number;
  receivedOrderIds?: string[];
  selectedOrderIds?: string[];
  onToggleOrder?: (orderId: string) => void;
}

const SuperAdminReceivablesDetails: React.FC<
  SuperAdminReceivablesDetailsProps
> = ({
  orders,
  totalToReceive,
  totalReceived,
  alreadyReceived,
  receivedOrderIds = [],
  selectedOrderIds = [],
  onToggleOrder,
}) => {
  const safeOrders = Array.isArray(orders) ? orders : [];

  const formatMoney = (value: number) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00";
  };

  const toggleOrder = (orderId: string) => {
    if (onToggleOrder) onToggleOrder(orderId);
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === safeOrders.length) {
      safeOrders.forEach((order) => {
        if (selectedOrderIds.includes(order.id)) toggleOrder(order.id);
      });
      return;
    }

    safeOrders.forEach((order) => {
      if (
        !selectedOrderIds.includes(order.id) &&
        !receivedOrderIds.includes(order.id)
      ) {
        toggleOrder(order.id);
      }
    });
  };

  return (
    <div className="bg-white shadow-xl rounded-2xl p-3 sm:p-6 border-2 border-purple-200 mt-4 sm:mt-8 overflow-hidden">
      <h2 className="text-3xl sm:text-2xl font-bold text-purple-800 mb-4 leading-tight break-words">
        Pedidos detalhados para cálculo do valor a receber
      </h2>

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm sm:text-base">
          <div>
            <span className="font-semibold">Total já recebido:</span> R$
            {formatMoney(alreadyReceived)}
          </div>
          <div>
            <span className="font-semibold">Total recebido (histórico):</span>{" "}
            R$
            {formatMoney(totalReceived)}
          </div>
        </div>

        {safeOrders.length > 0 && (
          <button
            className="w-full sm:w-auto px-3 py-2 bg-purple-600 text-white rounded font-bold text-xs hover:bg-purple-700 transition"
            onClick={toggleSelectAll}
            type="button"
          >
            {selectedOrderIds.length === safeOrders.length
              ? "Desmarcar todos"
              : "Selecionar todos"}
          </button>
        )}
      </div>

      {safeOrders.length === 0 && <div>Nenhum pedido encontrado.</div>}

      {safeOrders.map((order) => (
        <div
          key={order.id}
          className={`order-card border rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 ${receivedOrderIds.includes(order.id) ? "bg-green-100 border-green-400" : "bg-purple-50"}`}
        >
          <div className="mb-2 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <input
                type="checkbox"
                checked={selectedOrderIds?.includes(order.id) || false}
                onChange={() => toggleOrder(order.id)}
                disabled={receivedOrderIds.includes(order.id)}
                className="accent-purple-600 w-5 h-5 mt-1 shrink-0"
              />
              <div className="text-sm sm:text-base break-words">
                <div>
                  <b>Pedido #{order.id}</b>
                </div>
                <div>Cliente: {order.userName || "-"}</div>
                <div>Data: {new Date(order.timestamp).toLocaleString()}</div>
                {order.paymentMethod && (
                  <div>
                    <span className="font-semibold">Tipo de Pagamento:</span>{" "}
                    {order.paymentMethod}
                  </div>
                )}
              </div>
            </div>

            <button
              className="self-start px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition shrink-0"
              onClick={() => {
                const backendUrl =
                  import.meta.env.VITE_API_URL || "http://localhost:3001";
                window.open(
                  `${backendUrl}/api/orders/${order.id}/receipt-pdf`,
                  "_blank",
                );
              }}
            >
              Gerar PDF
            </button>
          </div>

          <div className="mb-2 text-sm sm:text-base break-words">
            Total do pedido: R$ {formatMoney(order.total)} | Valor a receber
            deste pedido: <b>R$ {formatMoney(order.orderValueToReceive)}</b>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs mb-2">
              <thead>
                <tr className="bg-purple-100">
                  <th className="py-1 px-2 text-left">Produto</th>
                  <th className="py-1 px-2 text-left">Preço Venda</th>
                  <th className="py-1 px-2 text-left">Preço Bruto</th>
                  <th className="py-1 px-2 text-left">Qtd</th>
                  <th className="py-1 px-2 text-left">Valor a Receber</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-1 px-2">{item.name}</td>
                    <td className="py-1 px-2">R$ {formatMoney(item.price)}</td>
                    <td className="py-1 px-2">
                      R$ {formatMoney(item.precoBruto)}
                    </td>
                    <td className="py-1 px-2">{item.quantity}</td>
                    <td className="py-1 px-2">
                      R$ {formatMoney(item.valueToReceive)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="text-xs text-gray-500">
        <span>
          O valor a receber é calculado como: <br />
          <span className="font-mono">
            (Preço de venda - Preço bruto) x quantidade para cada item, somando
            todos os pedidos.
          </span>
        </span>
      </div>
    </div>
  );
};

export default SuperAdminReceivablesDetails;
