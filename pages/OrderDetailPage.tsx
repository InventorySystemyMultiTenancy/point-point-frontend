import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Order } from "../types";

const OrderDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Recebe o pedido via state da navegação
  const order: Order | undefined = location.state?.order;

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-6 min-h-screen bg-stone-100">
        <div className="bg-white rounded-xl shadow-md p-6 text-center">
          <h2 className="text-2xl font-bold mb-4 text-red-600">
            Pedido não encontrado
          </h2>
          <button
            className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            onClick={() => navigate(-1)}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen bg-stone-100">
      <div className="bg-white rounded-xl shadow-md p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-800 mb-4">
          Detalhes do Pedido #{order.id.slice(-4)}
        </h1>
        <button
          className="mb-4 bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition-colors shadow-md"
          onClick={() => {
            const backendUrl =
              import.meta.env.VITE_API_URL || "http://localhost:3001";
            window.open(
              `${backendUrl}/api/orders/${order.id}/receipt-pdf`,
              "_blank",
            );
          }}
        >
          Gerar PDF do Pedido
        </button>
        <div className="mb-2 text-stone-700">
          <span className="font-semibold">Cliente:</span>{" "}
          {order.userName || "-"}
        </div>
        <div className="mb-2 text-stone-700">
          <span className="font-semibold">Data/Hora:</span>{" "}
          {new Date(order.timestamp).toLocaleString()}
        </div>
        <div className="mb-2 text-stone-700">
          <span className="font-semibold">Forma de Pagamento:</span>{" "}
          {(() => {
            if (!order.paymentType) return "-";
            if (order.paymentType === "presencial") {
              return "Presencial";
            }
            if (order.paymentType === "online") {
              if (order.paymentMethod === "credit")
                return "Cartão de Crédito (Mercado Pago)";
              if (order.paymentMethod === "debit")
                return "Cartão de Débito (Mercado Pago)";
              if (order.paymentMethod === "pix") return "Pix (Mercado Pago)";
              return "Online (Mercado Pago)";
            }
            return order.paymentType;
          })()}
        </div>
        <div className="mb-2 text-stone-700">
          <span className="font-semibold">Status do Pagamento:</span>{" "}
          {order.paymentStatus || "-"}
        </div>
        <div className="mb-2 text-stone-700">
          <span className="font-semibold">Total:</span> R$
          {Number(order.total).toFixed(2) ?? "-"}
        </div>
        <div className="mb-2 text-stone-700">
          <span className="font-semibold">Itens:</span>
          <ul className="list-disc ml-6">
            {order.items.map((item, idx) => (
              <li key={idx}>
                {item.quantity}x {item.name}
              </li>
            ))}
          </ul>
        </div>
        {order.observation && (
          <div className="mb-2 text-yellow-800 bg-yellow-100 rounded p-2">
            <span className="font-semibold">Observação:</span>{" "}
            {order.observation}
          </div>
        )}
        <button
          className="mt-6 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          onClick={() => navigate(-1)}
        >
          Voltar
        </button>
      </div>
    </div>
  );
};

export default OrderDetailPage;
