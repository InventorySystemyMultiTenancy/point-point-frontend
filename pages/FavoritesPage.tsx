import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useFavorites } from "../contexts/FavoritesContext";
import { getProducts } from "../services/apiService";
import { filterPrivateCatalog } from "../utils/privateCatalog";
import ProductCard from "../components/ProductCard";
import type { Product } from "../types";

const FavoritesPage: React.FC = () => {
  const [menu, setMenu] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    name: string;
  } | null>(null);

  const { currentUser } = useAuth();
  const { cartItems, addToCart } = useCart();
  const { favoriteIds } = useFavorites();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const data = await getProducts(currentUser?.id);
        const products = Array.isArray(data) ? data : [];
        setMenu(filterPrivateCatalog(products, currentUser?.fullAccess));
      } catch (error) {
        console.error("Erro ao buscar produtos favoritos:", error);
        setMenu([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenu();
  }, [currentUser?.id, currentUser?.fullAccess]);

  const favoriteProducts = menu.filter((product) =>
    favoriteIds.includes(product.id),
  );

  const openImage = (product: Product) => {
    const image = product.images?.[0] || product.imageUrl;
    if (!image) return;
    setPreviewImage({ src: image, name: product.name });
  };

  return (
    <div className="favorites-page max-w-6xl mx-auto px-4 py-8 md:py-10">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-stone-800">
          Meus Favoritos
        </h1>
        <button
          type="button"
          onClick={() => navigate("/menu")}
          className="favorites-back-link"
        >
          ← Voltar ao catálogo
        </button>
      </div>

      {isLoading ? (
        <p className="text-stone-500">Carregando favoritos...</p>
      ) : favoriteProducts.length === 0 ? (
        <div className="favorites-empty">
          <span>🤍</span>
          <p>Você ainda não adicionou nenhum favorito.</p>
          <p>
            Toque no coração de um produto no catálogo para salvá-lo aqui.
          </p>
        </div>
      ) : (
        <div className="monster-product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {favoriteProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={addToCart}
              onOpenImage={openImage}
              quantityInCart={
                cartItems.find((i) => i.id === product.id)?.quantity || 0
              }
            />
          ))}
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[300] bg-black/75 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage.src}
            alt={previewImage.name}
            className="max-h-[85vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
