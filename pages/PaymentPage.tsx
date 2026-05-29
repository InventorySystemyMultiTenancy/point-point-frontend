import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import {
  createPixPayment,
  createCardPayment,
  checkPaymentStatus,
  cancelPayment,
  clearPaymentQueue,
} from "../services/paymentService";
import type { Order, CartItem } from "../types";
import PaymentOnline from "../components/PaymentOnline";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Helper para requisições padrão (single-tenant)
const fetchStandard = async (url: string, options: RequestInit = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
};

const getCreditFeeByInstallments = (installments: number): number => {
  if (installments === 1) return 2.97;
  if (installments === 2) return 3.1;
  if (installments === 3) return 3.79;
  if (installments === 4) return 4.53;
  if (installments === 5) return 5.4;
  if (installments === 6) return 6.39;
  return 0;
};

// Tipo para controlar o pagamento ativo
type ActivePaymentState = {
  id: string;
  type: "pix" | "card";
  orderId: string;
} | null;

const PaymentPage: React.FC = () => {
  const { cartItems, cartTotal, clearCart, observation } = useCart();
  const { currentUser, addOrderToHistory, logout } = useAuth();
  const navigate = useNavigate();

  // Estados de UI
  const [paymentType, setPaymentType] = useState<
    "online" | "presencial" | null
  >(null);

  // --- CORREÇÃO: ADICIONADO O ESTADO QUE FALTAVA ---
  const [presencialStep, setPresencialStep] = useState<
    "select-method" | "select-installments" | "finalize" | null
  >(null);

  const [paymentMethod, setPaymentMethod] = useState<
    "credit" | "debit" | "pix" | null
  >(null);

  const [status, setStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentStatusMessage, setPaymentStatusMessage] = useState("");

  // Estados para taxa e parcelas (usados em ambos os fluxos)
  const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
  const [taxaSelecionada, setTaxaSelecionada] = useState<number>(0); // Corrigido valor inicial para 0 se não tiver taxa padrão

  useEffect(() => {
    if (paymentType === "presencial" && paymentMethod === "credit") {
      setTaxaSelecionada(getCreditFeeByInstallments(selectedInstallments));
      return;
    }
    setTaxaSelecionada(0);
  }, [paymentType, paymentMethod, selectedInstallments]);

  const totalComTaxa = Number(
    (cartTotal * (1 + (taxaSelecionada || 0) / 100)).toFixed(2),
  );

  // Estados para PIX
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);

  // Estado que ATIVA o React Query (substitui o loop while)
  const [activePayment, setActivePayment] = useState<ActivePaymentState>(null);

  // Novo estado para orderId do pagamento online
  const [onlineOrderId, setOnlineOrderId] = useState<string | null>(null);
  const [creatingOnlineOrder, setCreatingOnlineOrder] = useState(false);

  // Ref para limpeza (cleanup) ao desmontar a página
  const paymentIdRef = useRef<string | null>(null);

  // --- REACT QUERY: POLLING INTELIGENTE ---
  const { data: paymentStatusData } = useQuery({
    queryKey: ["paymentStatus", activePayment?.id, activePayment?.type],
    queryFn: async () => {
      if (!activePayment) return null;
      const result = await checkPaymentStatus(activePayment.id);
      if (!result.success)
        throw new Error(result.error || "Erro ao verificar status");
      return result;
    },
    enabled: !!activePayment && status === "processing",
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        data?.status === "approved" ||
        data?.status === "FINISHED" ||
        data?.status === "canceled" ||
        data?.status === "rejected"
      )
        return false;
      return 3000;
    },
    refetchOnWindowFocus: false,
  });

  // --- EFEITO: Monitora o status vindo do React Query ---
  useEffect(() => {
    if (paymentStatusData?.status === "approved" && activePayment) {
      console.log(
        "✅ Pagamento detectado pelo React Query:",
        paymentStatusData,
      );
      finalizeOrder(
        activePayment.orderId,
        activePayment.id,
        activePayment.type,
      );
    }

    if (
      (paymentStatusData?.status === "canceled" ||
        paymentStatusData?.status === "rejected") &&
      activePayment
    ) {
      console.log("❌ Pagamento cancelado/rejeitado:", paymentStatusData);
      handlePaymentFailure(paymentStatusData);
    }
  }, [paymentStatusData, activePayment]);

  // --- EFEITO: Cleanup de Segurança ---
  useEffect(() => {
    paymentIdRef.current = activePayment?.id || null;
  }, [activePayment]);

  useEffect(() => {
    return () => {
      if (paymentIdRef.current) {
        console.log(
          `🧹 Cleanup: Cancelando pagamento ${paymentIdRef.current} no backend...`,
        );
        fetchStandard(
          `${BACKEND_URL}/api/payment/cancel/${paymentIdRef.current}`,
          {
            method: "DELETE",
            keepalive: true,
          },
        ).catch((err) => console.error("Erro no cleanup:", err));
      }
    };
  }, []);

  const handlePaymentFailure = (data: any) => {
    setActivePayment(null);
    setStatus("error");

    const reasonMessages: Record<string, string> = {
      canceled_by_user: "Pagamento cancelado na maquininha pelo usuário",
      payment_error: "Erro ao processar pagamento na maquininha",
      canceled_by_system: "Pagamento cancelado pelo sistema",
      rejected_by_terminal: "Pagamento rejeitado pela maquininha",
    };

    const errorMsg =
      data.message ||
      (data.reason ? reasonMessages[data.reason] : null) ||
      "Pagamento não aprovado. Tente novamente.";

    setErrorMessage(errorMsg);
    setQrCodeBase64(null);
  };

  const finalizeOrder = async (
    orderId: string,
    paymentId: string,
    type: "pix" | "card",
  ) => {
    try {
      let safePaymentId: string | null = paymentId;
      if (safePaymentId !== undefined && safePaymentId !== null) {
        if (typeof safePaymentId !== "string") {
          safePaymentId = String(safePaymentId);
        }
        if (
          typeof safePaymentId !== "string" ||
          safePaymentId === "[object Object]" ||
          Array.isArray(safePaymentId)
        ) {
          safePaymentId = null;
        }
      }
      await fetchStandard(`${BACKEND_URL}/api/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify({
          paymentId: safePaymentId,
          paymentStatus: "paid",
        }),
      });

      if (type === "card") {
        setPaymentStatusMessage("Liberando maquininha...");
        await clearPaymentQueue();
      }

      const orderData: Order = {
        id: orderId,
        userId: currentUser!.id,
        userName: currentUser!.name,
        items: cartItems.map((i) => ({
          productId: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
        total: cartTotal,
        timestamp: new Date().toISOString(),
        observation: observation,
        status: "active",
      };

      addOrderToHistory(orderData);

      setActivePayment(null);
      setStatus("success");
      clearCart();
      setQrCodeBase64(null);

      // Baixa o PDF automaticamente após sucesso
      const pdfUrl = `${BACKEND_URL}/api/orders/${orderId}/receipt-pdf`;
      fetch(pdfUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `pedido-${orderId}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        });

      // Gera link do WhatsApp com o PDF
      const whatsappNumber = 11989009259; // ajuste conforme seu modelo de usuário
      const whatsappMsg = encodeURIComponent(
        `Olá! Segue o comprovante do seu pedido: ${pdfUrl}`,
      );
      const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMsg}`;
      // Abre WhatsApp em nova aba (opcional: pode exibir botão/link na tela de sucesso)
      window.open(whatsappLink, "_blank");

      // Redireciona para a página inicial após 5 segundos
      setTimeout(async () => {
        await logout();
        navigate("/", { replace: true });
      }, 5000);
    } catch (error) {
      console.error("Erro ao finalizar:", error);
      setErrorMessage(
        "Pagamento aprovado, mas erro ao salvar. Contate o caixa.",
      );
      setStatus("error");
    }
  };

  const createOrder = async () => {
    const orderResp = await fetchStandard(`${BACKEND_URL}/api/orders`, {
      method: "POST",
      body: JSON.stringify({
        userId: currentUser!.id,
        userName: currentUser!.name,
        items: cartItems.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        total:
          paymentType === "presencial" &&
          paymentMethod === "credit" &&
          taxaSelecionada
            ? totalComTaxa
            : cartTotal,
        paymentId: null,
        observation: observation,
        paymentType: paymentType,
        paymentMethod: paymentMethod,
        installments: paymentMethod === "credit" ? selectedInstallments : 1,
        fee: paymentMethod === "credit" ? taxaSelecionada : 0,
      }),
    });
    if (!orderResp.ok) throw new Error("Erro ao criar pedido");
    const data = await orderResp.json();
    return data.id;
  };

  const handlePixPayment = async () => {
    setStatus("processing");
    setPaymentStatusMessage("Gerando QR Code...");

    try {
      const orderId = await createOrder();

      const result = await createPixPayment({
        amount: cartTotal,
        description: `Pedido de ${currentUser!.name}`,
        orderId: orderId,
        email: currentUser?.email,
        payerName: currentUser?.name,
        items: cartItems.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        user: {
          email: currentUser?.email,
          name: currentUser?.name,
        },
      });

      if (!result.success || !result.paymentId || !result.qrCode) {
        throw new Error(result.error || "Erro ao gerar PIX");
      }

      setQrCodeBase64(result.qrCode);
      setPaymentStatusMessage("Escaneie o QR Code...");
      setActivePayment({ id: result.paymentId, type: "pix", orderId });
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Erro no PIX.");
    }
  };

  // Função usada para integração com maquininha (se for usar o fluxo automático)
  const handleCardPayment = async () => {
    setStatus("processing");
    setPaymentStatusMessage("Conectando à maquininha...");

    try {
      const orderId = await createOrder();

      const valorFinal = paymentMethod === "credit" ? totalComTaxa : cartTotal;

      console.log("[Pagamento] Parcelas selecionadas:", selectedInstallments);

      const result = await createCardPayment({
        amount: valorFinal,
        description: `Pedido ${currentUser!.name}`,
        orderId: orderId,
        paymentMethod: paymentMethod as "credit" | "debit",
        installments: paymentMethod === "credit" ? selectedInstallments : 1,
        items: cartItems.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        user: {
          email: currentUser?.email,
          name: currentUser?.name,
        },
      });

      console.log("[API] Resposta completa do pagamento presencial:", result);

      if (!result.success || !result.paymentId) {
        throw new Error(result.error || "Erro na maquininha");
      }

      setPaymentStatusMessage("Aguardando pagamento na maquininha...");
      setActivePayment({ id: result.paymentId, type: "card", orderId });
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Erro ao conectar maquininha.");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-50 p-4 animate-fade-in-down">
        <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-md w-full">
          <img
            src="/selfMachine.jpg"
            alt="Self Machine"
            className="w-32 h-auto mx-auto mb-4 rounded-lg"
          />
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-3xl font-bold text-green-800 mb-2">
            Pagamento Aprovado!
          </h2>
          <p className="text-stone-600 text-lg mb-6">
            Pedido enviado.
            <br />
            <span className="block mt-2 text-green-700 font-semibold">
              Comprovante enviado para seu e-mail!
            </span>
          </p>
          <p className="text-sm text-stone-400">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold text-blue-800 mb-8 flex items-center gap-2">
        <button
          onClick={() => navigate("/menu")}
          className="text-blue-600 hover:bg-blue-100 p-2 rounded-full transition-all duration-300 ease-in-out transform hover:scale-110 shadow-lg"
          disabled={status === "processing"}
        >
          ←
        </button>
        Finalizar Pagamento
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* COLUNA ESQUERDA - RESUMO */}
        <div className="bg-white p-6 rounded-2xl shadow-lg h-fit">
          <h2 className="text-xl font-bold text-stone-800 mb-4 border-b pb-2">
            Resumo do Pedido
          </h2>
          <ul className="space-y-3 max-h-64 overflow-y-auto mb-4">
            {cartItems.map((item) => (
              <li key={item.id} className="flex justify-between text-stone-600">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span className="font-semibold">
                  R$ {(item.price * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t pt-4 flex justify-between items-center">
            <span className="text-lg text-stone-500">Total a pagar:</span>
            <span className="text-3xl font-bold text-blue-600">
              {(paymentType === "presencial" || paymentType === "online") &&
              paymentMethod === "credit" &&
              taxaSelecionada
                ? `R$ ${totalComTaxa.toFixed(2)}`
                : `R$ ${cartTotal.toFixed(2)}`}
            </span>
          </div>
          {paymentType === "presencial" && paymentMethod === "credit" && (
            <div className="mt-2 text-sm text-blue-700 text-right">
              Taxa: {taxaSelecionada.toFixed(2)}% ({selectedInstallments}
              x)
            </div>
          )}
        </div>

        {/* COLUNA DIREITA - AÇÕES */}
        <div className="flex flex-col gap-4">
          {!paymentType && (
            <>
              <h2 className="text-xl font-bold text-stone-800 mb-2">
                Como você quer pagar?
              </h2>
              <button
                className="p-4 rounded-xl border-2 border-green-500 bg-green-50 text-green-900 font-bold text-lg hover:bg-green-100 transition-all"
                onClick={() => setPaymentType("online")}
              >
                💻 Pagamento Online (Mercado Pago)
              </button>
              <button
                className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 text-blue-900 font-bold text-lg hover:bg-blue-100 transition-all"
                onClick={() => setPaymentType("presencial")}
              >
                🏪 Pagar na Loja Girakids
              </button>
            </>
          )}

          {/* Pagamento Online com Mercado Pago */}
          {paymentType === "online" && (
            <>
              {/* Cria o pedido antes de exibir o PaymentOnline */}
              {!onlineOrderId && !creatingOnlineOrder && (
                <button
                  className="w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-xl mb-4"
                  onClick={async () => {
                    setCreatingOnlineOrder(true);
                    try {
                      const orderResp = await fetchStandard(
                        `${BACKEND_URL}/api/orders`,
                        {
                          method: "POST",
                          body: JSON.stringify({
                            userId: currentUser!.id,
                            userName: currentUser!.name,
                            items: cartItems.map((i) => ({
                              id: i.id,
                              name: i.name,
                              quantity: i.quantity,
                              price: i.price,
                            })),
                            total: cartTotal,
                            observation,
                            status: "pending",
                          }),
                        },
                      );
                      if (!orderResp.ok)
                        throw new Error("Erro ao criar pedido");
                      const data = await orderResp.json();
                      setOnlineOrderId(data.id);
                    } catch (err: any) {
                      Swal.fire({
                        icon: "error",
                        title: "Erro ao criar pedido",
                        text: err.message || "Erro desconhecido",
                        confirmButtonText: "OK",
                      });
                      setPaymentType(null);
                    } finally {
                      setCreatingOnlineOrder(false);
                    }
                  }}
                  disabled={creatingOnlineOrder}
                >
                  {creatingOnlineOrder
                    ? "Criando pedido..."
                    : "Gerar Pedido e Pagar"}
                </button>
              )}
              {onlineOrderId && (
                <PaymentOnline
                  orderId={onlineOrderId}
                  total={cartTotal}
                  items={cartItems.map((i) => ({
                    id: i.id,
                    name: i.name,
                    quantity: i.quantity,
                    price: i.price,
                  }))}
                  userEmail={currentUser?.email || ""}
                  userName={currentUser?.name || ""}
                  onSuccess={(paymentId) => {
                    Swal.fire({
                      icon: "success",
                      title: "Pagamento Aprovado!",
                      text: `Seu pedido foi pago com sucesso!`,
                      confirmButtonText: "OK",
                    }).then(() => {
                      clearCart();
                      setOnlineOrderId(null);
                      setPaymentType(null);
                      navigate("/menu");
                    });
                  }}
                  onError={(error) => {
                    Swal.fire({
                      icon: "error",
                      title: "Erro no Pagamento",
                      text: error,
                      confirmButtonText: "Tentar Novamente",
                    });
                  }}
                />
              )}
            </>
          )}

          {/* Pagamento Presencial (Modo Manual/A Pagar) */}
          {paymentType === "presencial" && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-center text-blue-800 font-semibold">
              <span className="block text-2xl mb-2">
                🏪 Pagamento na Loja Girakids
              </span>

              {/* Step 1: Seleção do método */}
              {presencialStep === null || presencialStep === "select-method" ? (
                <div className="flex flex-col gap-4 items-center justify-center">
                  <span className="mb-2">Escolha a forma de pagamento:</span>
                  <button
                    className={`px-6 py-3 rounded font-bold text-lg transition-all ${
                      paymentMethod === "credit"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-blue-700 border border-blue-600"
                    }`}
                    onClick={() => {
                      setPaymentMethod("credit");
                      setSelectedInstallments(1);
                      setPresencialStep("select-installments");
                    }}
                  >
                    Crédito
                  </button>
                  <button
                    className={`px-6 py-3 rounded font-bold text-lg transition-all ${
                      paymentMethod === "debit"
                        ? "bg-green-600 text-white"
                        : "bg-white text-green-700 border border-green-600"
                    }`}
                    onClick={() => {
                      setPaymentMethod("debit");
                      setPresencialStep("finalize");
                    }}
                  >
                    Débito
                  </button>
                  <button
                    className={`px-6 py-3 rounded font-bold text-lg transition-all ${
                      paymentMethod === "pix"
                        ? "bg-purple-600 text-white"
                        : "bg-white text-purple-700 border border-purple-600"
                    }`}
                    onClick={() => {
                      setPaymentMethod("pix");
                      setPresencialStep("finalize");
                    }}
                  >
                    PIX
                  </button>
                  {/* Opções extras para admin */}
                  {currentUser?.role === "admincustomer" && (
                    <>
                      <button
                        className={`px-6 py-3 rounded font-bold text-lg transition-all ${
                          paymentMethod === "cheque"
                            ? "bg-yellow-600 text-white"
                            : "bg-white text-yellow-700 border border-yellow-600"
                        }`}
                        onClick={() => {
                          setPaymentMethod("cheque");
                          setPresencialStep("finalize");
                        }}
                      >
                        Cheque
                      </button>
                      <button
                        className={`px-6 py-3 rounded font-bold text-lg transition-all ${
                          paymentMethod === "boleto"
                            ? "bg-pink-600 text-white"
                            : "bg-white text-pink-700 border border-pink-600"
                        }`}
                        onClick={() => {
                          setPaymentMethod("boleto");
                          setPresencialStep("finalize");
                        }}
                      >
                        Boleto
                      </button>
                    </>
                  )}
                </div>
              ) : null}

              {/* Step 2: Seleção de parcelas para crédito */}
              {presencialStep === "select-installments" &&
                paymentMethod === "credit" && (
                  <div className="mb-2">
                    <span className="font-semibold text-blue-700">
                      Parcelamento disponível:
                    </span>
                    <ul className="text-sm text-blue-800 mt-1 flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6].map((parcelas) => (
                        <li key={parcelas}>
                          <button
                            className={`px-2 py-1 rounded ${
                              selectedInstallments === parcelas
                                ? "bg-blue-600 text-white"
                                : "bg-white text-blue-700 border border-blue-600"
                            }`}
                            onClick={() => {
                              setSelectedInstallments(parcelas);
                              setPresencialStep("finalize");
                            }}
                          >
                            {parcelas}x (
                            {getCreditFeeByInstallments(parcelas).toFixed(2)}% )
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Step 3: Finalizar pedido */}
              {presencialStep === "finalize" && (
                <button
                  className="mt-4 px-6 py-3 rounded bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-all"
                  onClick={async () => {
                    setStatus("processing");
                    setErrorMessage("");
                    try {
                      const orderResp = await fetchStandard(
                        `${BACKEND_URL}/api/orders`,
                        {
                          method: "POST",
                          body: JSON.stringify({
                            userId: currentUser!.id,
                            userName: currentUser!.name,
                            items: cartItems.map((i) => ({
                              id: i.id,
                              name: i.name,
                              quantity: i.quantity,
                              price: i.price,
                            })),
                            paymentType: "presencial",
                            paymentMethod,
                            installments:
                              paymentMethod === "credit"
                                ? selectedInstallments
                                : 1,
                            fee:
                              paymentMethod === "credit" ? taxaSelecionada : 0,
                            total:
                              paymentMethod === "credit"
                                ? totalComTaxa
                                : cartTotal,
                            paymentStatus: "pending",
                            observation,
                          }),
                        },
                      );
                      if (!orderResp.ok)
                        throw new Error("Erro ao criar pedido");
                      const orderData = await orderResp.json();
                      setStatus("success");
                      clearCart();
                      setPresencialStep(null);
                      setPaymentType(null);

                      // Abrir PDF em nova aba se o pedido foi criado com sucesso
                      if (orderData && orderData.id) {
                        const pdfUrl = `${BACKEND_URL}/api/orders/${orderData.id}/receipt-pdf`;
                        window.open(pdfUrl, "_blank");
                      }

                      // Redirecionar para o catálogo após um pequeno delay
                      setTimeout(() => {
                        navigate("/");
                      }, 500);
                    } catch (err: any) {
                      setStatus("error");
                      setErrorMessage(
                        err.message || "Erro ao salvar pedido presencial.",
                      );
                    }
                  }}
                >
                  Finalizar Pedido
                </button>
              )}

              <button
                className="mt-4 px-4 py-2 rounded bg-stone-200 text-stone-700 hover:bg-stone-300"
                onClick={() => {
                  setPaymentType(null);
                  setPresencialStep(null);
                  setPaymentMethod(null);
                }}
              >
                Voltar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
