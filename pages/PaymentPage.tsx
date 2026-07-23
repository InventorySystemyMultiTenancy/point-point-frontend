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
import { getDeliveryMethods, getUserById } from "../services/apiService";
import type { DeliveryMethod, DeliveryMethodValue, Order } from "../types";
import PaymentOnline from "../components/PaymentOnline";
import {
  BACKORDER_NOTICE,
  BACKORDER_SHORT_NOTICE,
  getBackorderQuantity,
  isCartItemBackorder,
} from "../utils/backorder";
import { formatMoney, toMoneyNumber } from "../utils/money";
import {
  canSeeImportedCatalog,
  isImportedProduct,
} from "../utils/privateCatalog";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const DEFAULT_DELIVERY_METHODS: DeliveryMethod[] = [
  { value: "carrier", label: "Transportadora", requiresCarrier: true },
  { value: "pickup", label: "Retirada no local", requiresCarrier: false },
  { value: "in_person", label: "Presencial", requiresCarrier: false },
  { value: "contact", label: "Entrar em contato", requiresCarrier: false },
];

const DELIVERY_METHOD_VALUES: DeliveryMethodValue[] = [
  "carrier",
  "pickup",
  "in_person",
  "contact",
];

const isDeliveryMethodValue = (value: unknown): value is DeliveryMethodValue =>
  typeof value === "string" &&
  DELIVERY_METHOD_VALUES.includes(value as DeliveryMethodValue);

const getDeliveryMethodValueFromLabel = (
  label: string,
): DeliveryMethodValue | null => {
  const normalizedLabel = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedLabel.includes("transport")) return "carrier";
  if (normalizedLabel.includes("retirada")) return "pickup";
  if (normalizedLabel.includes("presencial")) return "in_person";
  if (normalizedLabel.includes("contato")) return "contact";

  return null;
};

const normalizeDeliveryMethods = (methods: unknown): DeliveryMethod[] => {
  if (!Array.isArray(methods)) return DEFAULT_DELIVERY_METHODS;

  const normalizedMethods = methods
    .map((method): DeliveryMethod | null => {
      if (!method || typeof method !== "object") return null;
      const rawMethod = method as Record<string, unknown>;
      const label = String(rawMethod.label || rawMethod.name || "").trim();
      const value =
        isDeliveryMethodValue(rawMethod.value) ? rawMethod.value
        : isDeliveryMethodValue(rawMethod.id) ? rawMethod.id
        : getDeliveryMethodValueFromLabel(label);

      if (!value) return null;

      return {
        value,
        label:
          label ||
          DEFAULT_DELIVERY_METHODS.find(
            (defaultMethod) => defaultMethod.value === value,
          )?.label ||
          value,
        requiresCarrier:
          Boolean(rawMethod.requiresCarrier ?? rawMethod.requires_carrier) ||
          value === "carrier",
      };
    })
    .filter((method): method is DeliveryMethod => Boolean(method));

  return normalizedMethods.length > 0
    ? normalizedMethods
    : DEFAULT_DELIVERY_METHODS;
};

// Helper para requisiÃ§Ãµes padrÃ£o (single-tenant)
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
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(
    DEFAULT_DELIVERY_METHODS,
  );
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethodValue | null>(null);

  // --- CORREÃ‡ÃƒO: ADICIONADO O ESTADO QUE FALTAVA ---
  const [presencialStep, setPresencialStep] = useState<
    "select-method" | "select-installments" | "finalize" | null
  >(null);

  const [paymentMethod, setPaymentMethod] = useState<
    "credit" | "debit" | "pix" | "a_prazo" | "cheque" | "boleto" | null
  >(null);

  const [status, setStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentStatusMessage, setPaymentStatusMessage] = useState("");

  // Estados para taxa e parcelas (usados em ambos os fluxos)
  const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
  const [taxaSelecionada, setTaxaSelecionada] = useState<number>(0); // Corrigido valor inicial para 0 se nÃ£o tiver taxa padrÃ£o
  const [currentUserMonthlyPayment, setCurrentUserMonthlyPayment] = useState(
    Boolean(currentUser?.monthlyPayment),
  );

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
  const canUseMonthlyPayment = currentUserMonthlyPayment;

  // Estados para PIX
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);

  // Estado que ATIVA o React Query (substitui o loop while)
  const [activePayment, setActivePayment] = useState<ActivePaymentState>(null);

  // Novo estado para orderId do pagamento online
  const [onlineOrderId, setOnlineOrderId] = useState<string | null>(null);
  const [creatingOnlineOrder, setCreatingOnlineOrder] = useState(false);
  const [orderHasBackorder, setOrderHasBackorder] = useState(false);
  const [guestName, setGuestName] = useState("");
  const guestNameRef = useRef("");
  const [showGuestNameModal, setShowGuestNameModal] = useState(false);
  const [pendingGuestAction, setPendingGuestAction] = useState<null | (() => Promise<void>)>(null);
  const [guestNameError, setGuestNameError] = useState("");

  // Ref para limpeza (cleanup) ao desmontar a pÃ¡gina
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
        "Pagamento detectado pelo React Query:",
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
      console.log("Pagamento cancelado/rejeitado:", paymentStatusData);
      handlePaymentFailure(paymentStatusData);
    }
  }, [paymentStatusData, activePayment]);

  // --- EFEITO: Cleanup de SeguranÃ§a ---
  useEffect(() => {
    paymentIdRef.current = activePayment?.id || null;
  }, [activePayment]);

  useEffect(() => {
    const loadDeliveryMethods = async () => {
      try {
        const data = await getDeliveryMethods();
        setDeliveryMethods(normalizeDeliveryMethods(data));
      } catch (err) {
        console.error("Erro ao carregar formas de entrega:", err);
        setDeliveryMethods(DEFAULT_DELIVERY_METHODS);
      }
    };

    loadDeliveryMethods();
  }, []);

  useEffect(() => {
    if (
      deliveryMethod &&
      !deliveryMethods.some((method) => method.value === deliveryMethod)
    ) {
      setDeliveryMethod(null);
    }
  }, [deliveryMethod, deliveryMethods]);

  useEffect(() => {
    let isMounted = true;

    const refreshMonthlyPayment = async () => {
      if (!currentUser?.id) {
        setCurrentUserMonthlyPayment(false);
        return;
      }

      setCurrentUserMonthlyPayment(Boolean(currentUser.monthlyPayment));

      try {
        const data = await getUserById(currentUser.id);
        const updatedUser = data.user || data;
        if (!isMounted || typeof updatedUser?.monthlyPayment !== "boolean") {
          return;
        }

        setCurrentUserMonthlyPayment(updatedUser.monthlyPayment);
        localStorage.setItem(
          "currentUser",
          JSON.stringify({ ...currentUser, ...updatedUser }),
        );
      } catch (err) {
        console.error("Erro ao atualizar pagamento mensal do usuario:", err);
      }
    };

    refreshMonthlyPayment();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.monthlyPayment]);

  useEffect(() => {
    return () => {
      if (paymentIdRef.current) {
        console.log(
          `Cleanup: Cancelando pagamento ${paymentIdRef.current} no backend...`,
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
      canceled_by_user: "Pagamento cancelado na maquininha pelo usuario",
      payment_error: "Erro ao processar pagamento na maquininha",
      canceled_by_system: "Pagamento cancelado pelo sistema",
      rejected_by_terminal: "Pagamento rejeitado pela maquininha",
    };

    const errorMsg =
      data.message ||
      (data.reason ? reasonMessages[data.reason] : null) ||
      "Pagamento nao aprovado. Tente novamente.";

    setErrorMessage(errorMsg);
    setQrCodeBase64(null);
  };

  const backorderItems = cartItems.filter(isCartItemBackorder);

  const confirmBackorderIfNeeded = async () => {
    if (backorderItems.length === 0) return true;

    const itemsHtml = backorderItems
      .map((item) => {
        const quantity = getBackorderQuantity(item);
        const quantityLabel = quantity > 0 ? ` (${quantity} un. sob encomenda)` : "";
        return `<li><strong>${item.name}</strong>${quantityLabel}</li>`;
      })
      .join("");

    const result = await Swal.fire({
      icon: "warning",
      title: "Este pedido contém produto sob encomenda",
      html: `
        <p>Um ou mais produtos têm prazo mínimo de espera de 7 dias úteis.</p>
        <ul style="margin-top:12px;text-align:left">${itemsHtml}</ul>
      `,
      confirmButtonText: "Entendi e quero continuar",
      cancelButtonText: "Voltar ao carrinho",
      showCancelButton: true,
      reverseButtons: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    return result.isConfirmed;
  };

  const buildOrderItems = () =>
    cartItems.map((i) => ({
      id: i.id,
      productId: i.id,
      name: i.name,
      quantity: i.quantity,
      price: toMoneyNumber(i.price),
      isBackorder: isCartItemBackorder(i),
      backorderQuantity: getBackorderQuantity(i),
      backorderNotice: isCartItemBackorder(i)
        ? i.backorderNotice || BACKORDER_NOTICE
        : undefined,
    }));

  const getGuestName = () => guestNameRef.current.trim();

  const updateGuestName = (name: string) => {
    guestNameRef.current = name;
    setGuestName(name);
  };

  const getBuyerName = () => currentUser?.name || getGuestName();

  const ensurePrivateCatalogAllowed = () => {
    if (canSeeImportedCatalog(currentUser?.fullAccess)) return true;
    const privateItem = cartItems.find(isImportedProduct);
    if (!privateItem) return true;
    Swal.fire({
      icon: "warning",
      title: "Acesso completo necessario",
      text: "Produtos importados exigem acesso completo. Remova este item para finalizar.",
      confirmButtonText: "OK",
    });
    return false;
  };

  const runWithGuestName = async (action: () => Promise<void>) => {
    if (!ensurePrivateCatalogAllowed()) return;
    if (!currentUser && !getGuestName()) {
      setGuestNameError("");
      setPendingGuestAction(() => action);
      setShowGuestNameModal(true);
      return;
    }
    await action();
  };

  const buildBuyerPayload = () =>
    currentUser
      ? { userId: currentUser.id, userName: currentUser.name }
      : { userName: getGuestName() };

  const ensureDeliveryMethod = () => {
    if (deliveryMethod) return true;
    Swal.fire({
      icon: "warning",
      title: "Forma de entrega",
      text: "Escolha a forma de entrega para finalizar o pedido.",
      confirmButtonText: "OK",
    });
    return false;
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
        userId: currentUser?.id || "guest",
        userName: getBuyerName(),
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

      if (currentUser) {
        addOrderToHistory(orderData);
      }

      setActivePayment(null);
      setStatus("success");
      clearCart();
      setQrCodeBase64(null);

      // Baixa o PDF automaticamente apÃ³s sucesso
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
      const whatsappNumber = 11989009259; // ajuste conforme seu modelo de usuÃ¡rio
      const whatsappMsg = encodeURIComponent(
        `Ola! Segue o comprovante do seu pedido: ${pdfUrl}`,
      );
      const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMsg}`;
      // Abre WhatsApp em nova aba (opcional: pode exibir botÃ£o/link na tela de sucesso)
      window.open(whatsappLink, "_blank");

      // Redireciona para a pÃ¡gina inicial apÃ³s 5 segundos
      setTimeout(async () => {
        if (currentUser) {
          await logout();
        }
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
    if (!ensureDeliveryMethod()) {
      throw new Error("Forma de entrega obrigatoria");
    }
    const confirmed = await confirmBackorderIfNeeded();
    if (!confirmed) throw new Error("Pedido sob encomenda nao confirmado");

    const orderResp = await fetchStandard(`${BACKEND_URL}/api/orders`, {
      method: "POST",
      body: JSON.stringify({
        ...buildBuyerPayload(),
        items: buildOrderItems(),
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
        deliveryMethod,
      }),
    });
    const data = await orderResp.json().catch(() => ({}));
    if (!orderResp.ok) {
      throw new Error(data.error || data.message || "Erro ao criar pedido");
    }
    setOrderHasBackorder(Boolean(data.hasBackorder || backorderItems.length > 0));
    return data.id;
  };

  const handlePixPayment = async () => {
    setStatus("processing");
    setPaymentStatusMessage("Gerando QR Code...");

    try {
      const orderId = await createOrder();

      const result = await createPixPayment({
        amount: cartTotal,
        description: `Pedido de ${getBuyerName()}`,
        orderId: orderId,
        email: currentUser?.email,
        payerName: getBuyerName(),
        items: buildOrderItems(),
        user: {
          email: currentUser?.email,
          name: getBuyerName(),
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
      if (err.message === "Pedido sob encomenda nao confirmado") {
        setStatus("idle");
        setPaymentStatusMessage("");
        return;
      }
      setStatus("error");
      setErrorMessage(err.message || "Erro no PIX.");
    }
  };

  // FunÃ§Ã£o usada para integraÃ§Ã£o com maquininha (se for usar o fluxo automÃ¡tico)
  const handleCardPayment = async () => {
    setStatus("processing");
    setPaymentStatusMessage("Conectando a maquininha...");

    try {
      const orderId = await createOrder();

      const valorFinal = paymentMethod === "credit" ? totalComTaxa : cartTotal;

      console.log("[Pagamento] Parcelas selecionadas:", selectedInstallments);

      const result = await createCardPayment({
        amount: valorFinal,
        description: `Pedido ${getBuyerName()}`,
        orderId: orderId,
        paymentMethod: paymentMethod as "credit" | "debit",
        installments: paymentMethod === "credit" ? selectedInstallments : 1,
        items: buildOrderItems(),
        user: {
          email: currentUser?.email,
          name: getBuyerName(),
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
      if (err.message === "Pedido sob encomenda nao confirmado") {
        setStatus("idle");
        setPaymentStatusMessage("");
        return;
      }
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
            <span className="text-4xl">OK</span>
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
          {orderHasBackorder && (
            <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-left">
              <h3 className="text-lg font-black text-amber-900">
                Produto sob encomenda
              </h3>
              <p className="mt-1 text-sm font-bold text-amber-800">
                {BACKORDER_NOTICE}
              </p>
            </div>
          )}
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
          className="px-4 py-2 rounded-lg bg-white text-blue-700 text-sm font-bold hover:bg-blue-100 transition-all shadow-lg"
          disabled={status === "processing"}
        >
          Voltar
        </button>
        Finalizar Pagamento
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* COLUNA ESQUERDA - RESUMO */}
        <div className="bg-white p-6 rounded-2xl shadow-lg h-fit">
          <h2 className="text-xl font-bold text-stone-800 mb-4 border-b pb-2">
            Resumo do Pedido
          </h2>
          {backorderItems.length > 0 && (
            <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-500 p-4 text-amber-900">
              <p className="font-black">Este pedido contém produto sob encomenda.</p>
              <p className="mt-1 text-sm font-bold">
                Prazo mínimo de espera: 7 dias úteis para ficar pronto.
              </p>
            </div>
          )}
          <ul className="space-y-3 max-h-64 overflow-y-auto mb-4">
            {cartItems.map((item) => (
              <li key={item.id} className="flex justify-between text-stone-600">
                <span>
                  {item.quantity}x {item.name}
                  {isCartItemBackorder(item) && (
                    <span className="mt-1 block text-xs font-black uppercase tracking-wide text-amber-700">
                      Sob encomenda - {BACKORDER_SHORT_NOTICE}
                    </span>
                  )}
                </span>
                <span className="font-semibold">
                  R$ {formatMoney(toMoneyNumber(item.price) * item.quantity)}
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

        {/* COLUNA DIREITA - AÃ‡Ã•ES */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-bold text-stone-800">
              Forma de entrega
            </h2>
            <div className="grid gap-2">
              {deliveryMethods.map((method) => {
                const isSelected = deliveryMethod === method.value;

                return (
                  <button
                    key={method.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setDeliveryMethod(method.value)}
                    className={`flex items-center justify-between gap-3 rounded-lg border-2 px-4 py-3 text-left font-bold transition-all ${
                      isSelected
                        ? "animate-pulse border-green-700 bg-green-600 text-white shadow-lg ring-4 ring-green-200"
                        : "border-stone-300 bg-white text-stone-700 hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    <span>{method.label}</span>
                    {isSelected && (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-green-700">
                        Selecionado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {!paymentType && (
            <>
              <h2 className="text-xl font-bold text-stone-800 mb-2">
                Como voce quer pagar?
              </h2>
              <button
                className="p-4 rounded-xl border-2 border-green-500 bg-green-50 text-green-900 font-bold text-lg hover:bg-green-100 transition-all"
                onClick={() => setPaymentType("online")}
              >
                Pagamento Online (Mercado Pago)
              </button>
              <button
                className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 text-blue-900 font-bold text-lg hover:bg-blue-100 transition-all"
                onClick={() => setPaymentType("presencial")}
              >
                Pagar na Loja POIT&POIT
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
                    await runWithGuestName(async () => {
                      const confirmed = await confirmBackorderIfNeeded();
                      if (!confirmed) return;
                      if (!ensureDeliveryMethod()) return;
                      setCreatingOnlineOrder(true);
                      try {
                        const orderResp = await fetchStandard(
                          `${BACKEND_URL}/api/orders`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              ...buildBuyerPayload(),
                              items: buildOrderItems(),
                              total: cartTotal,
                              observation,
                              status: "pending",
                              deliveryMethod,
                            }),
                          },
                        );
                        const data = await orderResp.json().catch(() => ({}));
                        if (!orderResp.ok) {
                          throw new Error(
                            data.error || data.message || "Erro ao criar pedido",
                          );
                        }
                        setOrderHasBackorder(
                          Boolean(data.hasBackorder || backorderItems.length > 0),
                        );
                        setOnlineOrderId(data.id);
                      } catch (err: any) {
                        if (
                          !currentUser &&
                          String(err.message || "").includes(
                            "Nome obrigatório para comprar sem cadastro",
                          )
                        ) {
                          setGuestNameError(err.message);
                          setShowGuestNameModal(true);
                          return;
                        }
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
                    });
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
                  items={buildOrderItems()}
                  userEmail={currentUser?.email || ""}
                  userName={getBuyerName()}
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
                Pagamento na Loja POIT&POIT
              </span>

              {/* Step 1: SeleÃ§Ã£o do mÃ©todo */}
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
                    Credito
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
                    Debito
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
                  {canUseMonthlyPayment && (
                    <button
                      className={`px-6 py-3 rounded font-bold text-lg transition-all ${
                        paymentMethod === "a_prazo"
                          ? "bg-slate-700 text-white"
                          : "bg-white text-slate-700 border border-slate-600"
                      }`}
                      onClick={() => {
                        setPaymentMethod("a_prazo");
                        setPresencialStep("finalize");
                      }}
                    >
                      À prazo
                    </button>
                  )}
                  {canUseMonthlyPayment && (
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
                  )}
                  {/* OpÃ§Ãµes extras para admin */}
                  {currentUser?.role === "admincustomer" && (
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
                  )}
                </div>
              ) : null}

              {/* Step 2: SeleÃ§Ã£o de parcelas para crÃ©dito */}
              {presencialStep === "select-installments" &&
                paymentMethod === "credit" && (
                  <div className="mb-2">
                    <span className="font-semibold text-blue-700">
                      Parcelamento disponivel:
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
                    await runWithGuestName(async () => {
                      const confirmed = await confirmBackorderIfNeeded();
                      if (!confirmed) return;
                      if (!ensureDeliveryMethod()) return;
                      setStatus("processing");
                      setErrorMessage("");
                      try {
                        const orderResp = await fetchStandard(
                          `${BACKEND_URL}/api/orders`,
                          {
                            method: "POST",
                            body: JSON.stringify({
                              ...buildBuyerPayload(),
                              items: buildOrderItems(),
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
                              deliveryMethod,
                            }),
                          },
                        );
                        const orderData = await orderResp.json().catch(() => ({}));
                        if (!orderResp.ok) {
                          throw new Error(
                            orderData.error ||
                              orderData.message ||
                              "Erro ao criar pedido",
                          );
                        }
                        setOrderHasBackorder(
                          Boolean(orderData.hasBackorder || backorderItems.length > 0),
                        );
                        setStatus("success");
                        clearCart();
                        setPresencialStep(null);
                        setPaymentType(null);

                        if (orderData && orderData.id) {
                          const pdfUrl = `${BACKEND_URL}/api/orders/${orderData.id}/receipt-pdf`;
                          window.open(pdfUrl, "_blank");
                        }

                        setTimeout(() => {
                          navigate("/");
                        }, 500);
                      } catch (err: any) {
                        if (
                          !currentUser &&
                          String(err.message || "").includes(
                            "Nome obrigatório para comprar sem cadastro",
                          )
                        ) {
                          setStatus("idle");
                          setGuestNameError(err.message);
                          setShowGuestNameModal(true);
                          return;
                        }
                        setStatus("error");
                        setErrorMessage(
                          err.message || "Erro ao salvar pedido presencial.",
                        );
                      }
                    });
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
      {showGuestNameModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-2xl font-black text-stone-900">
              Nome para finalizar
            </h2>
            <p className="mb-4 text-sm font-semibold text-stone-600">
              Informe pelo menos seu nome para comprar sem cadastro.
            </p>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-stone-700">
                Nome
              </span>
              <input
                value={guestName}
                onChange={(event) => {
                  updateGuestName(event.target.value);
                  setGuestNameError("");
                }}
                className="w-full rounded-lg border border-stone-300 px-3 py-3 text-stone-900 focus:border-blue-600 focus:outline-none"
                placeholder="Seu nome"
                autoFocus
              />
            </label>
            {guestNameError && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">
                {guestNameError}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowGuestNameModal(false);
                  setPendingGuestAction(null);
                  setGuestNameError("");
                }}
                className="rounded-lg bg-stone-200 px-4 py-3 font-bold text-stone-800 hover:bg-stone-300"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!getGuestName()) {
                    setGuestNameError("Nome obrigatório para comprar sem cadastro");
                    return;
                  }
                  const action = pendingGuestAction;
                  setShowGuestNameModal(false);
                  setPendingGuestAction(null);
                  setGuestNameError("");
                  if (action) {
                    await action();
                  }
                }}
                className="rounded-lg bg-blue-600 px-4 py-3 font-black text-white hover:bg-blue-700"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentPage;

