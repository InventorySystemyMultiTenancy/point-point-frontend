import { API_BASE_URL } from "../services/apiBase";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import {
  getMenuSuggestion,
  getDynamicCartSuggestion,
  getChefMessage,
} from "../services/geminiService";
import { getProducts } from "../services/apiService";
import type { Product, CartItem } from "../types";

// URL da API
const BACKEND_URL = API_BASE_URL;

// ==========================================
// 1. COMPONENTE: PRODUCT CARD (Produtos maiores)
// ==========================================
interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  quantityInCart?: number;
  onOpenImage: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  quantityInCart = 0,
  onOpenImage,
}) => {
  // Lógica ajustada: Se for null é ilimitado. Se for 0 é esgotado.
  const isOutOfStock = product.stock === 0;
  const primaryImage = product.images?.[0] || product.imageUrl;

  return (
    <div
      className={`bg-white w-60 rounded-2xl shadow-md overflow-hidden flex flex-col relative h-full transition-transform hover:shadow-xl ${
        isOutOfStock ? "opacity-60 grayscale" : ""
      }`}
    >
      {/* Badges - Apenas ESGOTADO agora */}
      {isOutOfStock && (
        <div className="absolute top-3 right-3 z-10 bg-purple-800 text-white font-bold px-3 py-1 rounded text-sm shadow-sm">
          ESGOTADO
        </div>
      )}

      {/* Mídia (Imagem ou Vídeo) */}
      <div className="relative h-40 md:h-52 bg-gray-100">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-zoom-in"
            loading="lazy"
            onClick={() => onOpenImage(product)}
          />
        ) : null}
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex flex-col flex-grow justify-between">
        <div>
          <h3 className="font-bold text-lg md:text-xl text-gray-800 leading-tight mb-2">
            {product.name}
          </h3>
          <p className="hidden md:block text-sm text-stone-600 line-clamp-2 mb-3">
            {product.description}
          </p>
        </div>

        <div className="mt-2">
          <div className="flex flex-col gap-3">
            <span className="text-xl md:text-2xl font-bold text-stone-800">
              R$ {product.price.toFixed(2)}
            </span>
            {product.quantidadeVenda && product.quantidadeVenda > 1 && (
              <span
                className="text-xs text-black mt-1 block"
                style={{ fontSize: "12px", opacity: 0.7 }}
              >
                Mínimo: {product.quantidadeVenda} por compra
              </span>
            )}
            <button
              onClick={() => onAddToCart(product)}
              disabled={isOutOfStock}
              className={`w-full font-bold py-3 px-4 rounded-xl text-base md:text-lg transition-colors shadow-sm ${
                isOutOfStock
                  ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                  : "bg-purple-700 text-white hover:bg-purple-800 active:bg-purple-900"
              }`}
            >
              {quantityInCart > 0
                ? `Adicionado (${quantityInCart})`
                : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. COMPONENTE: CART SIDEBAR (Letras e Botões Grandes + Observação)
// ==========================================
interface CartSidebarProps {
  cartItems: CartItem[];
  cartTotal: number;
  updateQuantity: (id: string, q: number) => void;
  onCheckout: () => void;
  isPlacingOrder: boolean;
  cartSuggestion?: string;
  isMobile?: boolean;
  onClose?: () => void;
  menu: Product[];
  onAddToCart: (product: Product) => void;
  observation: string; // <--- Recebe a observação
  setObservation: (obs: string) => void; // <--- Recebe a função para alterar
  currentUser?: any; // <--- Recebe o usuário atual
}

const CartSidebar: React.FC<CartSidebarProps> = ({
  cartItems,
  cartTotal,
  updateQuantity,
  onCheckout,
  isPlacingOrder,
  cartSuggestion,
  isMobile = false,
  onClose,
  menu,
  onAddToCart,
  observation,
  setObservation,
  currentUser,
}) => {
  const [showObservationSaved, setShowObservationSaved] = useState(false);
  const observationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const containerClass = isMobile
    ? "fixed inset-x-0 bottom-0 z-[200] bg-white rounded-t-3xl shadow-[0_-10px_60px_rgba(0,0,0,0.4)] flex flex-col max-h-[90vh] transition-transform duration-300 ease-out transform translate-y-0 border-t border-stone-200"
    : "flex flex-col h-full border-l border-stone-200";

  // Lógica para encontrar o produto sugerido
  const suggestedProduct = useMemo(() => {
    if (!cartSuggestion || !menu) return null;

    console.log("🔍 [CART SUGGESTION] Buscando produto:", {
      suggestion: cartSuggestion,
      menuLength: menu.length,
    });

    const found = menu.find(
      (p) =>
        cartSuggestion.toLowerCase().includes(p.name.toLowerCase()) ||
        (p.name.toLowerCase().includes("coca") &&
          cartSuggestion.toLowerCase().includes("coca")),
    );

    if (found) {
      console.log("✅ [CART SUGGESTION] Produto encontrado:", {
        name: found.name,
        id: found.id,
      });
    } else {
      console.warn("⚠️ [CART SUGGESTION] Produto não encontrado no menu local");
    }

    return found;
  }, [cartSuggestion, menu]);

  const handleObservationChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setObservation(e.target.value);
    setShowObservationSaved(true);

    if (observationTimeoutRef.current) {
      clearTimeout(observationTimeoutRef.current);
    }

    observationTimeoutRef.current = setTimeout(() => {
      setShowObservationSaved(false);
    }, 2000); // Oculta a mensagem após 2 segundos
  };
  return (
    <div
      className={containerClass}
      style={isMobile ? undefined : { background: "#e8c88c" }}
    >
      {/* Header do Carrinho */}
      <div
        className={`p-5 flex items-center justify-between ${
          isMobile
            ? "bg-stone-900 text-white rounded-t-3xl"
            : "bg-white border-b border-stone-100"
        }`}
      >
        <h2
          className={`text-xl md:text-2xl font-bold flex items-center gap-2 ${
            isMobile ? "text-white" : "text-gray-800"
          }`}
        >
          <span>🛒</span> Minha Cesta (
          {cartItems.reduce((acc, i) => acc + i.quantity, 0)})
        </h2>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white bg-stone-800 p-2 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {/* Lista de Itens com Scroll */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-4 bg-stone-50 min-h-0"
        style={isMobile ? { paddingBottom: 60 } : {}}
      >
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-stone-400">
            <span className="text-6xl mb-4">🛍️</span>
            <p className="text-xl">Seu carrinho está vazio.</p>
          </div>
        ) : (
          <>
            {/* ITENS DO CARRINHO (BOTÕES GRANDES) */}
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="flex bg-white p-3 rounded-lg shadow-sm border border-stone-200 items-center justify-between"
              >
                <div className="flex-1 pr-3">
                  <p className="font-bold text-stone-800 text-base md:text-lg leading-tight mb-1">
                    {item.name}
                  </p>
                  <p className="text-sm md:text-base font-semibold text-stone-500">
                    R$ {item.price.toFixed(2)}
                  </p>
                </div>

                {/* CONTROLES DE QUANTIDADE GRANDES */}
                <div className="flex items-center bg-stone-100 rounded-lg border border-stone-300 overflow-hidden h-10 md:h-11 shadow-inner">
                  <button
                    onClick={() => {
                      const step = item.quantidadeVenda ?? 1;
                      updateQuantity(item.id, item.quantity - step);
                    }}
                    className="w-9 md:w-10 h-full flex items-center justify-center text-stone-600 font-bold text-xl hover:bg-amber-100 hover:text-purple-800 transition-colors active:bg-amber-200"
                  >
                    -
                  </button>
                  {currentUser?.role === "admincustomer" ? (
                    <input
                      type="number"
                      min={1}
                      max={item.stock ?? 99}
                      value={item.quantity}
                      onChange={(e) => {
                        const q = parseInt(e.target.value);
                        if (!isNaN(q) && q > 0) updateQuantity(item.id, q);
                      }}
                      className="w-12 md:w-14 h-full text-base md:text-lg font-bold text-center bg-white border-x border-stone-200"
                    />
                  ) : (
                    <span className="w-9 md:w-10 h-full flex items-center justify-center text-base md:text-lg font-bold bg-white border-x border-stone-200">
                      {item.quantity}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      const step = item.quantidadeVenda ?? 1;
                      updateQuantity(item.id, item.quantity + step);
                    }}
                    className="w-9 md:w-10 h-full flex items-center justify-center bg-purple-700 text-white font-bold text-xl hover:bg-purple-800 transition-colors active:bg-purple-900"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer / Checkout */}
      {cartItems.length > 0 && (
        <div className="p-4 bg-white border-t border-stone-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          {/* CAMPO DE OBSERVAÇÃO - AGORA CONECTADO AO CONTEXTO */}
          <div className="mb-4">
            <label
              htmlFor="observation"
              className="block text-base font-bold text-stone-700 mb-2"
            >
              📝 Alguma observação?
            </label>
            <textarea
              id="observation"
              value={observation}
              onChange={handleObservationChange}
              placeholder="Ex: Em caixa, em sacos..."
              className="w-full p-2 border-2 border-stone-300 rounded-xl focus:outline-none focus:border-purple-700 focus:ring-2 focus:ring-amber-200 transition-all text-sm"
              rows={2}
            />
            {showObservationSaved && observation && (
              <p className="text-xs text-green-600 font-bold mt-1 animate-pulse">
                ✓ Observação salva!
              </p>
            )}
          </div>

          <div className="flex justify-between items-center mb-4">
            <span className="text-stone-500 font-bold text-lg">Total</span>
            <span className="text-2xl md:text-3xl font-bold text-stone-800">
              R$ {cartTotal.toFixed(2)}
            </span>
          </div>
          <button
            onClick={onCheckout}
            disabled={isPlacingOrder}
            className="w-full bg-green-600 text-white font-bold py-3 md:py-4 text-lg md:text-xl rounded-2xl hover:bg-green-700 transition-colors disabled:bg-stone-300 shadow-lg active:scale-[0.98] flex justify-center items-center gap-2"
          >
            {isPlacingOrder ? (
              "Processando..."
            ) : (
              <>
                <span>Finalizar Compra</span>
                <span className="text-3xl">➜</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. COMPONENTE: CATEGORY SIDEBAR
// ==========================================
interface CategorySidebarProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  dynamicCategories?: Array<{ name: string; icon: string; order: number }>; // 🆕
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  dynamicCategories = [], // 🆕
}) => {
  // 🆕 Helper para pegar ícone dinâmico ou fallback
  const getCategoryIcon = (categoryName: string): string => {
    const dynamicCat = dynamicCategories.find((dc) => dc.name === categoryName);
    if (dynamicCat) return dynamicCat.icon;

    // Fallback para ícones automáticos baseados em nome - Tema Pastelaria
    const lowerCat = categoryName.toLowerCase();
    if (lowerCat.includes("pastel") || lowerCat.includes("frito")) return "🥟";
    if (lowerCat.includes("assado") || lowerCat.includes("forno")) return "🥐";
    if (lowerCat.includes("doce") || lowerCat.includes("sobremesa"))
      return "🍰";
    if (lowerCat.includes("bebida")) return "🥤";
    if (lowerCat.includes("salgado")) return "🥟";
    if (lowerCat.includes("combo")) return "🍽️";
    if (lowerCat.includes("entrada") || lowerCat.includes("appetizer"))
      return "🥙";
    if (lowerCat.includes("especial")) return "⭐";
    return "🥟";
  };

  return (
    <aside className="w-[100px] md:w-40 bg-white z-40 flex flex-col h-full border-r border-stone-200 shadow-xl overflow-hidden shrink-0">
      {/* Logo Area */}
      <div className="h-20 md:h-28 flex items-center justify-center border-b border-stone-100 bg-purple-800 hidden md:flex">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">
          MENU
        </h1>
      </div>

      {/* Menu Items Container */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide gap-4 pb-20">
        <button
          onClick={() => onSelectCategory(null)}
          className={`w-full py-6 px-2 md:px-6 flex flex-col items-center md:justify-start gap-2 transition-all duration-200 border-l-8 ${
            selectedCategory === null
              ? "bg-amber-50 border-purple-700 text-purple-900"
              : "border-transparent bg-white text-stone-400 hover:bg-stone-50 hover:text-stone-600"
          }`}
        >
          <span
            className={`text-3xl ${
              selectedCategory === null ? "scale-110" : "grayscale opacity-70"
            }`}
          >
            🧸
          </span>
          <span className="text-xs md:text-lg p-2 font-bold uppercase">Todos</span>
        </button>

        <div className="my-4 border-t border-stone-100 mx-4"></div>

        {categories.map((category) => {
          const isSelected = selectedCategory === category;
          const icon = getCategoryIcon(category); // 🆕 Usa ícone dinâmico

          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`w-full py-6 px-2 md:px-6 flex flex-col  items-center md:justify-start gap-2 transition-all duration-200 border-l-8 ${
                isSelected
                  ? "bg-amber-50 border-purple-700 text-purple-900"
                  : "border-transparent text-stone-400 hover:bg-stone-50 hover:text-stone-600 bg-white"
              }`}
            >
              <span
                className={`text-3xl transition-transform ${
                  isSelected ? "scale-110" : "grayscale opacity-70"
                }`}
              >
                {icon}
              </span>
              <span
                className={`text-xs md:text-xl font-bold text-center md:text-left leading-tight uppercase`}
              >
                {category}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

// ==========================================
// 4. COMPONENTE PRINCIPAL: PAGE LAYOUT
// ==========================================

const MenuPage: React.FC = () => {
  const [menu, setMenu] = useState<Product[]>([]);
  const [suggestion, setSuggestion] = useState<string>("");
  const [cartSuggestion, setCartSuggestion] = useState<string>("");
  const [chefMessage, setChefMessage] = useState<string>("");
  const [isChefLoading, setIsChefLoading] = useState<boolean>(false);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [imageViewer, setImageViewer] = useState<{
    isOpen: boolean;
    images: string[];
    currentIndex: number;
    productName: string;
  }>({
    isOpen: false,
    images: [],
    currentIndex: 0,
    productName: "",
  });

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // 🆕 Estado para categorias dinâmicas
  const [dynamicCategories, setDynamicCategories] = useState<
    Array<{ name: string; icon: string; order: number }>
  >([]);

  const { currentUser } = useAuth();

  // AQUI ESTÁ A MÁGICA: Extraímos observation e setObservation do contexto
  const {
    cartItems,
    addToCart,
    cartTotal,
    updateQuantity,
    clearCart,
    observation,
    setObservation,
  } = useCart();
  const touchStartXRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  const navigate = useNavigate();

  const getProductImages = (product: Product): string[] => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images.filter((url) => typeof url === "string" && url);
    }
    if (product.imageUrl) {
      return [product.imageUrl];
    }
    return [];
  };

  const openImageViewer = (product: Product) => {
    const images = getProductImages(product);
    if (images.length === 0) return;
    setIsImageZoomed(false);
    setImageViewer({
      isOpen: true,
      images,
      currentIndex: 0,
      productName: product.name,
    });
  };

  const closeImageViewer = () => {
    setIsImageZoomed(false);
    setImageViewer((prev) => ({ ...prev, isOpen: false }));
  };

  const showNextImage = () => {
    setIsImageZoomed(false);
    setImageViewer((prev) => {
      if (prev.images.length <= 1) return prev;
      return {
        ...prev,
        currentIndex: (prev.currentIndex + 1) % prev.images.length,
      };
    });
  };

  const showPreviousImage = () => {
    setIsImageZoomed(false);
    setImageViewer((prev) => {
      if (prev.images.length <= 1) return prev;
      return {
        ...prev,
        currentIndex:
          (prev.currentIndex - 1 + prev.images.length) % prev.images.length,
      };
    });
  };

  const handleImageTouchStart = (e: React.TouchEvent<HTMLImageElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    didSwipeRef.current = false;
  };

  const handleImageTouchEnd = (e: React.TouchEvent<HTMLImageElement>) => {
    if (touchStartXRef.current === null) return;

    const touchEndX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const deltaX = touchEndX - touchStartXRef.current;
    const swipeThreshold = 40;

    if (deltaX <= -swipeThreshold) {
      didSwipeRef.current = true;
      showNextImage();
    } else if (deltaX >= swipeThreshold) {
      didSwipeRef.current = true;
      showPreviousImage();
    }

    touchStartXRef.current = null;
  };

  const handleExpandedImageClick = () => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    setIsImageZoomed((prev) => !prev);
  };

  const fetchMenuData = async () => {
    try {
      const data = await getProducts();
      // ✅ Valida se é array antes de setar
      if (Array.isArray(data)) {
        setMenu(data);
      } else {
        console.error(
          "❌ Backend retornou dados inválidos (não é array):",
          data,
        );
        setMenu([]);
      }
    } catch (error) {
      console.error("❌ Erro ao buscar menu:", error);
      setMenu([]); // ✅ Garante array vazio em caso de erro
    }
  };

  // 🆕 Busca categorias do backend
  const fetchCategories = async () => {
    try {
      console.log("🔄 Carregando categorias do backend...");
      const { getCategories } = await import("../services/categoryService");
      const data = await getCategories();
      console.log("📦 Categorias recebidas:", data);

      if (data.length > 0) {
        setDynamicCategories(data);
        console.log(
          `✅ ${data.length} categorias carregadas e setadas no estado`,
        );
      } else {
        console.warn("⚠️ Nenhuma categoria encontrada no backend");
      }
    } catch (error) {
      console.error("❌ Erro ao buscar categorias:", error);
    }
  };

  useEffect(() => {
    fetchMenuData();
    fetchCategories(); // 🆕 Carrega categorias
  }, []);

  useEffect(() => {
    const fetchSuggestion = async () => {
      if (currentUser && menu.length > 0) {
        setIsSuggestionLoading(true);
        const newSuggestion = await getMenuSuggestion(
          currentUser.historico,
          cartItems,
          menu,
          currentUser.name,
        );
        setSuggestion(newSuggestion);
        setIsSuggestionLoading(false);
      }
    };
    fetchSuggestion();
  }, [cartItems, currentUser, menu]);

  useEffect(() => {
    const fetchChefMessage = async () => {
      if (menu.length === 0) return;
      setIsChefLoading(true);
      try {
        const msg = await getChefMessage(
          currentUser ? currentUser.historico : [],
          currentUser?.name,
          menu,
        );
        setChefMessage(msg);
      } catch (err) {
        setChefMessage("Bem-vindo!");
      } finally {
        setIsChefLoading(false);
      }
    };
    fetchChefMessage();
  }, [menu, currentUser]);

  useEffect(() => {
    const fetchCartSuggestion = async () => {
      if (menu.length > 0 && cartItems.length > 0) {
        const dynamicSuggestion = await getDynamicCartSuggestion(
          cartItems,
          menu,
          currentUser?.name,
        );
        setCartSuggestion(dynamicSuggestion);
      } else {
        setCartSuggestion("");
      }
    };
    fetchCartSuggestion();
  }, [cartItems, menu, currentUser]);

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    if (!currentUser) {
      navigate("/login");
      return;
    }
    navigate("/payment");
  };

  const categorizedMenu = useMemo(() => {
    // ✅ Proteção: garante que menu é array antes de usar .reduce
    if (!Array.isArray(menu) || menu.length === 0) {
      return {} as Record<string, Product[]>;
    }

    return menu.reduce(
      (acc, product) => {
        const categoryKey = product.category as Product["category"];
        if (!acc[categoryKey]) acc[categoryKey] = [];
        acc[categoryKey].push(product);
        return acc;
      },
      {} as Record<string, Product[]>,
    );
  }, [menu]);

  // 🆕 Usa categorias dinâmicas do backend (com ordem), ou fallback para categorias com produtos
  const displayCategories = useMemo(() => {
    if (dynamicCategories.length > 0) {
      // Ordena pelas categorias do backend (usando campo order)
      return dynamicCategories
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map((cat) => cat.name);
    }
    // Fallback: usa categorias dos produtos existentes
    return Object.keys(categorizedMenu).sort();
  }, [dynamicCategories, categorizedMenu]);

  const totalViewerImages = imageViewer.images.length;
  const normalizedViewerIndex =
    totalViewerImages > 0
      ? ((imageViewer.currentIndex % totalViewerImages) + totalViewerImages) %
        totalViewerImages
      : 0;

  return (
    <div
      className="flex h-screen w-full overflow-hidden font-sans"
      style={{ background: "#FFF6E5" }}
    >
      {/* 1. SIDEBAR ESQUERDA */}
      <CategorySidebar
        categories={displayCategories} // 🆕 Usa categorias dinâmicas ordenadas
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        dynamicCategories={dynamicCategories}
      />

      {/* 2. ÁREA CENTRAL */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Scroll Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-48 md:pb-8 scroll-smooth">
          {/* Mensagens IA */}

          {/* Grid de Produtos */}
          <div className="max-w-6xl mx-auto min-h-[101%]">
            {selectedCategory === null ? (
              <div className="flex flex-wrap items-start gap-6 md:gap-8">
                {Object.entries(categorizedMenu).map(([category, products]) => (
                  <div
                    key={category}
                    className="scroll-mt-24 flex-1 min-w-[240px]"
                    id={`cat-${category}`}
                  >
                    <h3 className="text-2xl md:text-3xl font-bold text-stone-700 mb-6 flex items-center gap-3 border-b-2 border-stone-200 pb-3">
                      {category}
                    </h3>
                    <div className="flex flex-wrap gap-4 md:gap-6">
                      {(products as Product[]).map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onAddToCart={addToCart}
                          onOpenImage={openImageViewer}
                          quantityInCart={
                            cartItems.find((i) => i.id === product.id)
                              ?.quantity || 0
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="animate-fadeIn">
                <h3 className="text-2xl md:text-3xl font-bold text-stone-700 mb-6 flex items-center gap-3">
                  {selectedCategory}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-8">
                  {categorizedMenu[selectedCategory]?.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={addToCart}
                      onOpenImage={openImageViewer}
                      quantityInCart={
                        cartItems.find((i) => i.id === product.id)?.quantity ||
                        0
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {cartItems.length > 0 && !isMobileCartOpen && (
          <div className="xl:hidden fixed bottom-0 right-0 z-50 flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.2)] min-[900px]:left-0 min-[900px]:right-0 min-[900px]:w-full">
            <div
              className="bg-stone-900 text-white min-[900px]:px-8 min-[900px]:py-8 px-3 py-3 flex justify-between items-center rounded-tl-2xl min-[900px]:rounded-t-none cursor-pointer active:bg-stone-800 transition-colors"
              onClick={() => setIsMobileCartOpen(true)}
            >
              <span className="font-bold uppercase tracking-wider flex items-center gap-3 min-[900px]:text-2xl">
                <span className="min-[900px]:text-2xl">🛒</span> Minha Cesta
                <p>{cartItems.reduce((acc, i) => acc + i.quantity, 0)}</p>
                <span className="text-sm bg-amber-500 text-white  px-2 py-1 rounded-full m-2 animate-pulse">
                  ▲ Ver
                </span>
              </span>
              <span className=" font-bold text-purple-400 min-[900px]:text-2xl">
                R$ {cartTotal.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* 4. COLUNA DIREITA (Carrinho Desktop) */}
      <div className="hidden xl:block w-[380px] h-full shadow-2xl z-20">
        <CartSidebar
          cartItems={cartItems}
          cartTotal={cartTotal}
          updateQuantity={updateQuantity}
          onCheckout={handleCheckout}
          isPlacingOrder={isPlacingOrder}
          cartSuggestion={cartSuggestion}
          menu={menu}
          onAddToCart={addToCart}
          observation={observation}
          setObservation={setObservation}
          currentUser={currentUser}
        />
      </div>

      {/* 5. DRAWER MOBILE EXPANDIDO */}
      {isMobileCartOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsMobileCartOpen(false)}
          />

          <CartSidebar
            cartItems={cartItems}
            cartTotal={cartTotal}
            updateQuantity={updateQuantity}
            onCheckout={handleCheckout}
            isPlacingOrder={isPlacingOrder}
            cartSuggestion={cartSuggestion}
            isMobile={true}
            onClose={() => setIsMobileCartOpen(false)}
            menu={menu}
            onAddToCart={addToCart}
            observation={observation}
            setObservation={setObservation}
            currentUser={currentUser}
          />
        </>
      )}

      {imageViewer.isOpen && (
        <div
          className="fixed inset-0 z-[300] bg-black/75 flex items-center justify-center p-4"
          onClick={closeImageViewer}
        >
          <div
            className="max-w-4xl max-h-[90vh] w-full flex flex-col items-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            {imageViewer.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showPreviousImage();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    showPreviousImage();
                  }}
                  aria-label="Imagem anterior"
                  className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 md:h-12 md:w-12 rounded-full bg-black/60 text-white text-2xl font-bold hover:bg-black/80 transition"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showNextImage();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    showNextImage();
                  }}
                  aria-label="Próxima imagem"
                  className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 md:h-12 md:w-12 rounded-full bg-black/60 text-white text-2xl font-bold hover:bg-black/80 transition"
                >
                  ›
                </button>
              </>
            )}

            <img
              src={imageViewer.images[normalizedViewerIndex]}
              alt={`${imageViewer.productName} - imagem ${normalizedViewerIndex + 1}`}
              className={`max-h-[78vh] w-auto max-w-full object-contain rounded-xl shadow-2xl cursor-pointer transition-transform duration-200 ${
                isImageZoomed ? "scale-150" : "scale-100"
              }`}
              onClick={handleExpandedImageClick}
              onTouchStart={handleImageTouchStart}
              onTouchEnd={handleImageTouchEnd}
            />
            <p className="mt-3 text-white text-sm md:text-base font-medium">
              Toque para dar zoom ({normalizedViewerIndex + 1}/
              {totalViewerImages})
            </p>
            {imageViewer.images.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                {imageViewer.images.map((_, index) => (
                  <button
                    key={`viewer-dot-${index}`}
                    type="button"
                    onClick={() => {
                      setIsImageZoomed(false);
                      setImageViewer((prev) => ({
                        ...prev,
                        currentIndex: index,
                      }));
                    }}
                    aria-label={`Ver imagem ${index + 1}`}
                    className={`h-2.5 w-2.5 rounded-full transition-opacity ${
                      index === normalizedViewerIndex
                        ? "bg-white opacity-100"
                        : "bg-white opacity-40"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPage;
