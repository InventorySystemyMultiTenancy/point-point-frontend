import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import {
  getMenuSuggestion,
  getDynamicCartSuggestion,
  getChefMessage,
} from "../services/geminiService";
import { getProducts } from "../services/apiService";
import ProductCard from "../components/ProductCard";
import type { Product, CartItem } from "../types";
import {
  BACKORDER_SHORT_NOTICE,
  isCartItemBackorder,
  isProductBackorder,
} from "../utils/backorder";
import { formatMoney } from "../utils/money";
import {
  canSeeImportedCatalog,
  filterPrivateCatalog,
  isImportedProduct,
} from "../utils/privateCatalog";

// URL da API
const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Quantidade de produtos exibidos por vez antes do botão "Ver mais".
const PRODUCTS_PAGE_SIZE = 20;

// Banners promocionais do hero (imagens de placeholder já existentes no
// projeto — troque `image` pela arte final de cada campanha quando estiver
// pronta). O botão navega para a categoria real (?cat=) se ela existir no
// backend, senão cai no fallback de busca por texto (?q=).
interface PromoBanner {
  image: string;
  alt: string;
  buttonLabel: string;
  category?: string;
  query?: string;
}

const PROMO_BANNERS: PromoBanner[] = [
  {
    image: "/banner1.png",
    alt: "O cantinho perfeito para o seu melhor amigo",
    buttonLabel: "Veja todos os modelos",
  },
  {
    image: "/banner2.png",
    alt: "Eu te amo - um abraço em forma de capivara",
    buttonLabel: "Garanta já a sua!",
  },
  {
    image: "/banner3.png",
    alt: "Cavalinhos de time - para ver, torcer e abraçar",
    buttonLabel: "Escolha o seu favorito!",
  },
  {
    image: "/banner4.png",
    alt: "Puzzle Game Machine - diversão que estimula",
    buttonLabel: "Garanta a diversão do seu pequeno!",
  },
  {
    image: "/banner5.png",
    alt: "Ursinho que Respira - um abraço que acalma de verdade",
    buttonLabel: "Garanta o seu!",
  },
];

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
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState("");

  const startEditingQty = (item: CartItem) => {
    setEditingQtyId(item.id);
    setEditingQtyValue(String(item.quantity));
  };

  const commitEditingQty = (item: CartItem) => {
    const q = parseInt(editingQtyValue, 10);
    if (!isNaN(q) && q > 0) {
      updateQuantity(item.id, q);
    }
    setEditingQtyId(null);
  };

  const containerClass = isMobile
    ? "monster-cart fixed inset-x-0 bottom-0 z-[200] bg-white rounded-t-3xl shadow-[0_-10px_60px_rgba(0,0,0,0.4)] flex flex-col max-h-[90vh] transition-transform duration-300 ease-out transform translate-y-0 border-t border-stone-200"
    : "monster-cart flex flex-col h-full border-l border-stone-200";

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
      style={isMobile ? undefined : { background: "#050604" }}
    >
      {/* Header do Carrinho */}
      <div
        className={`monster-cart-header p-5 flex items-center justify-between ${
          isMobile
            ? "bg-stone-900 text-white rounded-t-3xl"
            : "bg-white border-b border-stone-100"
        }`}
      >
        <h2
          className={`text-xl md:text-2xl font-black uppercase flex items-center gap-2 ${
            isMobile ? "text-white" : "text-gray-800"
          }`}
        >
          <span>Carrinho</span> (
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
        className="monster-cart-scroll flex-1 overflow-y-auto p-3 space-y-4 bg-stone-50 min-h-0"
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
                className="monster-cart-item flex bg-white p-3 rounded-lg shadow-sm border border-stone-200 items-center justify-between"
              >
                <div className="flex-1 pr-3">
                  <p className="font-bold text-stone-800 text-base md:text-lg leading-tight mb-1">
                    {item.name}
                  </p>
                  <p className="text-sm md:text-base font-semibold text-blue-600">
                    R$ {formatMoney(item.price)}
                  </p>
                  {isCartItemBackorder(item) && (
                    <div className="mt-2 rounded border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-black uppercase tracking-wide text-amber-900">
                      Sob encomenda
                      <span className="block text-[11px] font-bold normal-case tracking-normal">
                        {BACKORDER_SHORT_NOTICE}
                      </span>
                    </div>
                  )}
                </div>

                {/* CONTROLES DE QUANTIDADE GRANDES */}
                <div className="monster-qty flex items-center bg-stone-100 rounded-lg border border-stone-300 overflow-hidden h-10 md:h-11 shadow-inner">
                  <button
                    onClick={() => {
                      const step = item.quantidadeVenda ?? 1;
                      updateQuantity(item.id, item.quantity - step);
                    }}
                    className="w-9 md:w-10 h-full flex items-center justify-center text-stone-800 font-bold text-xl hover:bg-blue-600 hover:text-white transition-colors active:bg-blue-700"
                  >
                    -
                  </button>
                  {currentUser?.role === "admincustomer" ? (
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={item.quantity}
                      onChange={(e) => {
                        const q = parseInt(e.target.value);
                        if (!isNaN(q) && q > 0) updateQuantity(item.id, q);
                      }}
                      className="w-12 md:w-14 h-full text-base md:text-lg font-bold text-center bg-black text-white border-x border-blue-500/20"
                    />
                  ) : editingQtyId === item.id ? (
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      autoFocus
                      value={editingQtyValue}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setEditingQtyValue(e.target.value)}
                      onBlur={() => commitEditingQty(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitEditingQty(item);
                        } else if (e.key === "Escape") {
                          setEditingQtyId(null);
                        }
                      }}
                      className="w-12 md:w-14 h-full text-base md:text-lg font-bold text-center bg-black text-white border-x border-blue-500/20 focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditingQty(item)}
                      title="Clique para digitar a quantidade"
                      className="w-9 md:w-10 h-full flex items-center justify-center text-base md:text-lg font-bold bg-black text-white border-x border-blue-500/20"
                    >
                      {item.quantity}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const step = item.quantidadeVenda ?? 1;
                      updateQuantity(item.id, item.quantity + step);
                    }}
                    className="w-9 md:w-10 h-full flex items-center justify-center bg-blue-600 text-white font-bold text-xl hover:bg-blue-700 transition-colors active:bg-blue-800"
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
        <div className="monster-cart-footer p-4 bg-white border-t border-stone-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          {/* CAMPO DE OBSERVAÇÃO - AGORA CONECTADO AO CONTEXTO */}
          <div className="mb-4">
            <label
              htmlFor="observation"
              className="block text-base font-bold text-stone-800 mb-2"
            >
              📝 Alguma observação?
            </label>
            <textarea
              id="observation"
              value={observation}
              onChange={handleObservationChange}
              placeholder="Ex: Em caixa, em sacos..."
              className="w-full p-2 border-2 border-blue-500/30 bg-black text-white rounded-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300/20 transition-all text-sm"
              rows={2}
            />
            {showObservationSaved && observation && (
              <p className="text-xs text-green-600 font-bold mt-1 animate-pulse">
                ✓ Observação salva!
              </p>
            )}
          </div>

          <div className="flex justify-between items-center mb-4">
            <span className="text-stone-800 font-bold text-lg">Total</span>
            <span className="text-2xl md:text-3xl font-bold text-blue-600">
              R$ {cartTotal.toFixed(2)}
            </span>
          </div>
          <button
            onClick={onCheckout}
            disabled={isPlacingOrder}
            className="monster-checkout w-full bg-blue-600 text-white font-bold py-3 md:py-4 text-lg md:text-xl rounded-2xl hover:bg-blue-700 transition-colors disabled:bg-stone-300 shadow-lg active:scale-[0.98] flex justify-center items-center gap-2"
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
    <aside className="monster-category w-[100px] md:w-40 bg-white z-40 flex flex-col h-full border-r border-stone-200 shadow-xl overflow-hidden shrink-0">
      {/* Logo Area */}
      <div className="monster-category-logo h-20 md:h-28 flex items-center justify-center border-b border-stone-100 bg-blue-700 hidden md:flex">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">
          MENU
        </h1>
      </div>

      {/* Menu Items Container */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide gap-4 pb-20">
        <button
          onClick={() => onSelectCategory(null)}
          className={`monster-category-button w-full py-6 px-2 md:px-6 flex flex-col items-center md:justify-start gap-2 transition-all duration-200 border-l-8 ${
            selectedCategory === null
              ? "is-active bg-blue-50 border-blue-600 text-blue-800"
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
          <span className="text-xs md:text-lg p-2 font-bold uppercase">
            Todos
          </span>
        </button>

        <div className="my-4 border-t border-stone-100 mx-4"></div>

        {categories.map((category) => {
          const isSelected = selectedCategory === category;
          const icon = getCategoryIcon(category); // 🆕 Usa ícone dinâmico

          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`monster-category-button w-full py-6 px-2 md:px-6 flex flex-col  items-center md:justify-start gap-2 transition-all duration-200 border-l-8 ${
                isSelected
                  ? "is-active bg-blue-50 border-blue-600 text-blue-800"
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
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PAGE_SIZE);
  const categorySubnavRef = useRef<HTMLDivElement>(null);

  const scrollCategorySubnav = (direction: 1 | -1) => {
    categorySubnavRef.current?.scrollBy({
      left: direction * 220,
      behavior: "smooth",
    });
  };
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
    refreshCartItemProducts,
    removeFromCart,
    clearCart,
    observation,
    setObservation,
    isCartOpen,
    openCart,
    closeCart,
  } = useCart();
  const touchStartXRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const searchTerm = useMemo(
    () => new URLSearchParams(location.search).get("q")?.trim() || "",
    [location.search],
  );

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
      const data = await getProducts(currentUser?.id);
      // ✅ Valida se é array antes de setar
      if (Array.isArray(data)) {
        setMenu(filterPrivateCatalog(data, currentUser?.fullAccess));
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
      const data = await getCategories({ catalog: true });
      console.log("📦 Categorias recebidas:", data);

      if (data.length > 0) {
        setDynamicCategories(
          filterPrivateCatalog(data, currentUser?.fullAccess),
        );
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
  }, [currentUser?.id, currentUser?.fullAccess]);

  useEffect(() => {
    refreshCartItemProducts(menu);
  }, [menu, refreshCartItemProducts]);

  useEffect(() => {
    if (canSeeImportedCatalog(currentUser?.fullAccess)) return;
    cartItems.forEach((item) => {
      if (isImportedProduct(item)) {
        removeFromCart(item.id);
      }
    });
  }, [cartItems, currentUser?.fullAccess, removeFromCart]);

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

  useEffect(() => {
    if (PROMO_BANNERS.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentBannerIndex((current) => (current + 1) % PROMO_BANNERS.length);
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  // Reinicia a paginação sempre que o filtro (busca ou categoria) muda.
  useEffect(() => {
    setVisibleCount(PRODUCTS_PAGE_SIZE);
  }, [selectedCategory, searchTerm]);

  const showNextBanner = () => {
    setCurrentBannerIndex((current) => (current + 1) % PROMO_BANNERS.length);
  };

  const showPreviousBanner = () => {
    setCurrentBannerIndex(
      (current) =>
        (current - 1 + PROMO_BANNERS.length) % PROMO_BANNERS.length,
    );
  };

  const handleBannerClick = (banner: PromoBanner) => {
    if (banner.category) {
      navigate(`/menu?cat=${encodeURIComponent(banner.category)}`);
    } else if (banner.query) {
      navigate(`/menu?q=${encodeURIComponent(banner.query)}`);
    } else {
      setSelectedCategory(null);
      navigate("/menu");
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    if (!canSeeImportedCatalog(currentUser?.fullAccess)) {
      const privateItem = cartItems.find(isImportedProduct);
      if (privateItem) {
        alert(
          "Produtos importados exigem acesso completo. Remova este item para finalizar.",
        );
        return;
      }
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

  // Seleciona a categoria vinda de um link externo (?cat=Nome), assim que a
  // lista real de categorias estiver disponível.
  useEffect(() => {
    const catParam = new URLSearchParams(location.search).get("cat");
    if (!catParam) return;
    const normalized = catParam.trim().toLowerCase();
    const match = displayCategories.find(
      (category) => category.toLowerCase() === normalized,
    );
    if (match) setSelectedCategory(match);
  }, [location.search, displayCategories]);

  const searchResults = useMemo(() => {
    if (!searchTerm) return null;
    const normalized = searchTerm.toLowerCase();
    return menu.filter((product) => {
      const description = (product as { description?: string }).description;
      return (
        product.name.toLowerCase().includes(normalized) ||
        (description && description.toLowerCase().includes(normalized))
      );
    });
  }, [menu, searchTerm]);

  // Produtos em destaque, ordenados (sob encomenda por último). Dividido em
  // duas partes para encaixar o banner de quebra de linha no meio da
  // grade, como um intervalo promocional entre os produtos.
  const featuredProducts = useMemo(() => {
    return [...menu].sort((a, b) => {
      const aBackorder = isProductBackorder(a) ? 1 : 0;
      const bBackorder = isProductBackorder(b) ? 1 : 0;
      if (aBackorder !== bBackorder) return aBackorder - bBackorder;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [menu]);

  const sortedCategoryProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return [...(categorizedMenu[selectedCategory] || [])].sort((a, b) => {
      const aOOS = isProductBackorder(a) ? 1 : 0;
      const bOOS = isProductBackorder(b) ? 1 : 0;
      return aOOS - bOOS;
    });
  }, [categorizedMenu, selectedCategory]);

  // Lista atualmente em exibição (busca > categoria > destaques), usada para
  // a paginação "Ver mais" (20 produtos por vez).
  const activeProductList =
    searchResults !== null
      ? searchResults
      : selectedCategory !== null
        ? sortedCategoryProducts
        : featuredProducts;
  const visibleProducts = activeProductList.slice(0, visibleCount);
  const hasMoreProducts = activeProductList.length > visibleProducts.length;

  const showFeaturedDivider = visibleProducts.length > 3;
  const featuredBreakIndex = Math.min(
    8,
    Math.ceil(visibleProducts.length / 2),
  );
  const featuredFirstHalf = showFeaturedDivider
    ? visibleProducts.slice(0, featuredBreakIndex)
    : visibleProducts;
  const featuredSecondHalf = showFeaturedDivider
    ? visibleProducts.slice(featuredBreakIndex)
    : [];

  const totalViewerImages = imageViewer.images.length;
  const normalizedViewerIndex =
    totalViewerImages > 0
      ? ((imageViewer.currentIndex % totalViewerImages) + totalViewerImages) %
        totalViewerImages
      : 0;
  const currentBanner = PROMO_BANNERS[currentBannerIndex % PROMO_BANNERS.length];

  return (
    <div className="monster-shell flex w-full font-sans">
      {/* 1. SIDEBAR ESQUERDA (desativada, mantida no código por compatibilidade) */}
      {false && (
        <CategorySidebar
          categories={displayCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          dynamicCategories={dynamicCategories}
        />
      )}

      {/* 2. ÁREA CENTRAL */}
      <main className="monster-content flex-1 flex flex-col relative">
        <div className="catalog-subnav-wrap">
          <button
            type="button"
            className="catalog-subnav-arrow catalog-subnav-arrow-prev"
            onClick={() => scrollCategorySubnav(-1)}
            aria-label="Categorias anteriores"
          >
            ‹
          </button>
          <div className="catalog-subnav" ref={categorySubnavRef}>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`catalog-subnav-item ${
                selectedCategory === null ? "is-active" : ""
              }`}
            >
              Todos
            </button>

            {displayCategories.map((category) => (
              <button
                type="button"
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`catalog-subnav-item ${
                  selectedCategory === category ? "is-active" : ""
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="catalog-subnav-arrow catalog-subnav-arrow-next"
            onClick={() => scrollCategorySubnav(1)}
            aria-label="Próximas categorias"
          >
            ›
          </button>
        </div>

        {/* Conteúdo (flui normalmente com o restante da página, sem scroll próprio) */}
        <div className="pb-48 md:pb-8">
          {searchResults === null && selectedCategory === null && (
            <section className="latest-banner" aria-label="Destaques">
              {PROMO_BANNERS.length > 1 && (
                <button
                  type="button"
                  className="latest-banner-arrow latest-banner-arrow-prev"
                  onClick={showPreviousBanner}
                  aria-label="Destaque anterior"
                >
                  ‹
                </button>
              )}
              <div className="latest-banner-slide">
                <img src={currentBanner.image} alt={currentBanner.alt} loading="eager" />
                <button
                  type="button"
                  className="latest-banner-cta"
                  onClick={() => handleBannerClick(currentBanner)}
                >
                  {currentBanner.buttonLabel}
                  <span aria-hidden="true">›</span>
                </button>
              </div>
              {PROMO_BANNERS.length > 1 && (
                <button
                  type="button"
                  className="latest-banner-arrow latest-banner-arrow-next"
                  onClick={showNextBanner}
                  aria-label="Próximo destaque"
                >
                  ›
                </button>
              )}
              {PROMO_BANNERS.length > 1 && (
                <div className="latest-banner-dots">
                  {PROMO_BANNERS.map((banner, index) => (
                    <button
                      type="button"
                      key={`banner-dot-${banner.image}`}
                      aria-label={`Ver destaque ${index + 1}`}
                      className={index === currentBannerIndex ? "is-active" : ""}
                      onClick={() => setCurrentBannerIndex(index)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="max-w-7xl mx-auto p-4 md:p-8 pt-6">
            {searchResults !== null ? (
              <div className="animate-fadeIn">
                <h3 className="monster-section-title text-2xl md:text-3xl font-bold text-stone-700 mb-6">
                  {searchResults.length > 0
                    ? `Resultados para "${searchTerm}"`
                    : `Nenhum resultado para "${searchTerm}"`}
                </h3>
                <div className="monster-product-grid flex flex-wrap gap-4 md:gap-6">
                  {visibleProducts.map((product) => (
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
            ) : selectedCategory === null ? (
              <>
                <h2 className="monster-section-title">Produtos em destaque</h2>
                <div className="monster-product-grid flex flex-wrap gap-4 md:gap-6">
                  {featuredFirstHalf.map((product) => (
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

                {showFeaturedDivider && (
                  <>
                    <div className="section-divider-banner">
                      <img
                        src="/bannerquebradelinhoebannerprincipal.png"
                        alt="Pequenos detalhes, grandes momentos - POIT&POIT"
                        loading="lazy"
                      />
                    </div>
                    <div className="monster-product-grid flex flex-wrap gap-4 md:gap-6">
                      {featuredSecondHalf.map((product) => (
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
                  </>
                )}
              </>
            ) : (
              <div className="animate-fadeIn">
                <h3 className="monster-section-title text-2xl md:text-3xl font-bold text-stone-700 mb-6 flex items-center gap-3">
                  {selectedCategory}
                </h3>
                <div className="monster-product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-8">
                  {visibleProducts.map((product) => (
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
            )}

            {hasMoreProducts && (
              <div className="flex justify-center mt-8">
                <button
                  type="button"
                  className="monster-load-more"
                  onClick={() =>
                    setVisibleCount((count) => count + PRODUCTS_PAGE_SIZE)
                  }
                >
                  Ver mais
                </button>
              </div>
            )}
          </div>
        </div>
        {cartItems.length > 0 && !isCartOpen && (
          <button
            type="button"
            className="plush-cart-orbit"
            onClick={() => openCart()}
            aria-label="Abrir carrinho"
          >
            <span className="plush-cart-orbit-icon">🛒</span>
            <span className="plush-orbit plush-orbit-one">🧸</span>
            <span className="plush-orbit plush-orbit-two">🐻</span>
            <span className="plush-orbit plush-orbit-three">🐰</span>
            <strong>{cartItems.reduce((acc, i) => acc + i.quantity, 0)}</strong>
            <small>R$ {cartTotal.toFixed(2)}</small>
          </button>
        )}
      </main>

      {isCartOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
            onClick={() => closeCart()}
          />
          <div className="cart-drawer-shell">
            <button
              type="button"
              className="cart-drawer-close"
              onClick={() => closeCart()}
              aria-label="Fechar carrinho"
            >
              ×
            </button>
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
