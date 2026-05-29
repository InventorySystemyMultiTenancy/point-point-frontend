import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function PaymentPendingPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("checking");
  const [message, setMessage] = useState<string>("");
  const pdfOpenedRef = useRef(false);

  useEffect(() => {
    // Lê parâmetros da URL
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("payment_id");
    const orderId = params.get("external_reference") || params.get("order_id");

    if (!paymentId && !orderId) {
      setStatus("error");
      setMessage("Parâmetros de pagamento ausentes.");
      return;
    }

    let interval: NodeJS.Timeout;
    let stopped = false;

    const checkStatus = () => {
      fetch(
        `${BACKEND_URL}/api/payment-online/check-status?payment_id=${paymentId || ""}&order_id=${orderId || ""}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "approved") {
            // Redireciona para PaymentSuccessPage com os parâmetros
            const successUrl = `/payment-success?payment_id=${data.paymentId || paymentId}&order_id=${data.orderId || orderId}`;
            window.location.href = successUrl;
            stopped = true;
            clearInterval(interval);
          } else {
            setStatus("not-approved");
            setMessage("Pagamento não confirmado. Aguarde ou tente novamente.");
          }
        })
        .catch(() => {
          setStatus("error");
          setMessage("Erro ao verificar pagamento.");
        });
    };

    checkStatus(); // Checa imediatamente
    interval = setInterval(() => {
      if (!stopped) checkStatus();
    }, 5000); // 5 segundos

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-purple-700">Pagamento Pendente</h1>
        <pre className={status === "approved" ? "text-green-600 text-left whitespace-pre-wrap" : "text-red-600 text-center whitespace-pre-wrap"}>{message}</pre>
        {status === "approved" && (
          <button
            className="mt-6 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700"
            onClick={() => navigate("/")}
          >
            Voltar para o catálogo
          </button>
        )}
      </div>
    </div>
  );
}
