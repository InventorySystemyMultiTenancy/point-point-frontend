import { API_BASE_URL } from "./apiBase";
import type { Order, CartItem, Product } from "../types";

const API_URL = API_BASE_URL;

/**
 * Gera uma sugestão de compra personalizada baseada no histórico e carrinho.
 */
export const getMenuSuggestion = async (
  userHistory: Order[],
  cartItems: CartItem[],
  menu: Product[],
  userName?: string,
): Promise<string> => {
  const clientName = userName || "amigo(a)";

  // Analisa o que está no carrinho
  const cartDetails = cartItems
    .map((item) => `${item.quantity}x ${item.name} (${item.category})`)
    .join(", ");

  const categoriesInCart = new Set(cartItems.map((i) => i.category));
  const hasSalgado = categoriesInCart.has("Pastel");
  const hasBebida = categoriesInCart.has("Bebida");
  const hasDoce = categoriesInCart.has("Doce");

  // Monta contexto inteligente
  let contexto = "";
  if (cartItems.length === 0) {
    contexto = "O carrinho está vazio. Sugira um pastel popular para começar.";
  } else if (hasSalgado && !hasBebida) {
    contexto =
      "Tem pastel no carrinho mas falta bebida. Sugira uma bebida gelada para acompanhar, mencione que está calor ou que combina perfeitamente.";
  } else if (hasSalgado && !hasDoce) {
    contexto =
      "Tem pastel salgado mas falta sobremesa. Sugira um pastel doce (Nutella, Romeu e Julieta, etc) para finalizar com chave de ouro.";
  } else if (!hasSalgado && hasBebida) {
    contexto = "Só tem bebida. Sugira um pastel salgado para acompanhar.";
  } else {
    contexto =
      "O carrinho está completo. Elogie a escolha e sugira adicionar mais uma unidade ou experimentar outro sabor.";
  }

  const prompt = `
Você é um atendente de loja de pelúcias online. Fale diretamente com ${clientName} de forma calorosa, simpática e profissional.

Catálogo atual do site: ${menu.map((p) => `${p.name} (R$ ${Number(p.price).toFixed(2)})`).join(", ")}

Carrinho atual: ${cartDetails || "vazio"}

${contexto}

Regras:
- Use o nome ${clientName} na mensagem
- Recomende apenas produtos do catálogo acima, com os valores reais do site
- Não ofereça descontos nem mencione promoções
- Seja específico sobre O QUE recomendar (nome do produto do catálogo)
- Dê um motivo convincente (ex: "é um dos mais procurados", "combina com o que já escolheu", "ótima opção para presentear", etc)
- Máximo 25 palavras
- Tom brasileiro, caloroso, simpático e profissional

Exemplo: "${clientName}, que tal levar o ${menu[0]?.name}? Ele é um dos favoritos da nossa loja! 🧸"
  `;

  try {
    const response = await fetch(`${API_URL}/api/ai/suggestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Erro na API:", response.status, errorData);
      throw new Error("Erro na requisição");
    }

    const data = await response.json();
    return (
      data.text || "Experimente nossos deliciosos pastéis com caldo de cana!"
    );
  } catch (error) {
    console.error("Erro ao obter sugestão:", error);
    return "Que tal um pastel quentinho hoje?";
  }
};

/**
 * Gera sugestões dinâmicas ("Que tal levar também...?") baseadas no que já está no carrinho.
 */
export const getDynamicCartSuggestion = async (
  cartItems: CartItem[],
  menu: Product[],
  userName?: string,
): Promise<string> => {
  if (cartItems.length === 0) return "";

  const clientName = userName || "amigo(a)";
  const cartNames = cartItems
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ");

  // Analisa categorias e produtos específicos
  const categoriesInCart = new Set(cartItems.map((i) => i.category));
  const productNames = cartItems.map((i) => i.name.toLowerCase());

  let sugestao = "";
  let motivo = "";

  if (!categoriesInCart.has("Bebida")) {
    sugestao = "uma Coca-Cola bem gelada ou Suco de Laranja";
    motivo = "para acompanhar e refrescar";
  } else if (!categoriesInCart.has("Doce")) {
    sugestao = "um Pastel de Nutella ou Romeu e Julieta";
    motivo = "para finalizar com uma doçura especial";
  } else if (categoriesInCart.size === 1) {
    sugestao = "mais uma unidade do que você já escolheu";
    motivo = "aproveitar enquanto está quentinho";
  } else {
    sugestao = "outro sabor para experimentar";
    motivo = "variar o sabor";
  }

  const prompt = `
Você é um atendente de loja de pelúcias online falando com ${clientName}.

Catálogo atual do site: ${menu.map((p) => `${p.name} (R$ ${Number(p.price).toFixed(2)})`).join(", ")}

Carrinho: ${cartNames}

Sugira adicionar: ${sugestao} (apenas produtos do catálogo acima)
Motivo: ${motivo}

Crie uma frase curta (máximo 20 palavras), chamando ${clientName} pelo nome, de forma simpática e profissional. Não ofereça descontos nem promoções.

Exemplo: "${clientName}, que tal levar também o ${menu[0]?.name}? É uma ótima escolha para presentear! 🧸"
  `;

  try {
    const response = await fetch(`${API_URL}/api/ai/suggestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    return data.text || "";
  } catch (error) {
    return "";
  }
};

/**
 * Gera uma mensagem de boas-vindas ou agradecimento "do Chef".
 */
export const getChefMessage = async (
  userHistory: Order[],
  userName?: string,
  menu?: Product[],
): Promise<string> => {
  const clientName = userName || "amigo(a)";
  const isNewCustomer = !userHistory || userHistory.length === 0;
  const orderCount = userHistory?.length || 0;

  const prompt = `
Você é um atendente de loja de pelúcias online.

Catálogo atual do site: ${menu?.map((p) => `${p.name} (R$ ${Number(p.price).toFixed(2)})`).join(", ")}

Cliente: ${clientName}
Status: ${
    isNewCustomer
      ? "Cliente novo, primeira visita"
      : `Cliente fiel com ${orderCount} pedidos anteriores`
  }

Crie uma mensagem calorosa e pessoal (máximo 25 palavras):
- Use o nome ${clientName}
- Se for novo: dê boas-vindas entusiasmadas
- Se for recorrente: agradeça a fidelidade e demonstre alegria em vê-lo(a) novamente
- Recomende um produto do catálogo acima, sem oferecer descontos
- Tom brasileiro, caloroso, simpático e profissional

Exemplo novo: "Olá ${clientName}! Seja muito bem-vindo(a)! Temos pelúcias lindas como o ${menu?.[0]?.name} esperando por você! 🧸"
Exemplo recorrente: "${clientName}, que alegria ter você aqui de novo! O ${menu?.[0]?.name} é sempre um sucesso entre nossos clientes! 💛"
  `;

  try {
    const response = await fetch(`${API_URL}/api/ai/suggestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    return (
      data.text ||
      `Olá ${clientName}, o Chef preparou tudo com carinho para você!`
    );
  } catch (error) {
    return `Olá ${clientName}, seja bem-vindo à nossa pastelaria!`;
  }
};

/**
 * Inicia a sessão de chat (neste modelo stateless, é apenas para log/placeholder).
 */
export const startChat = () => {
  console.log("Sessão de chat inicializada (gerenciada pelo backend).");
};

/**
 * Envia mensagem do usuário para o Chatbot e retorna a resposta.
 */
export const sendMessageToChatbot = async (
  message: string,
): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) throw new Error("Erro no chat");

    const data = await response.json();
    return data.text || "Desculpe, não entendi. Pode repetir?";
  } catch (error) {
    console.error("Erro no chatbot:", error);
    return "Estou com dificuldade de conexão no momento. Tente novamente mais tarde.";
  }
};
