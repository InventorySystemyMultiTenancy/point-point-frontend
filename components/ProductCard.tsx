import React from "react";
import { useFavorites } from "../contexts/FavoritesContext";
import type { Product } from "../types";
import { BACKORDER_SHORT_NOTICE, isProductBackorder } from "../utils/backorder";
import { formatMoney } from "../utils/money";

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
  const { isFavorite, toggleFavorite } = useFavorites();
  const isBackorder = isProductBackorder(product);
  const primaryImage = product.images?.[0] || product.imageUrl;
  const favorited = isFavorite(product.id);

  return (
    <div
      className={`monster-product-card bg-white w-60 rounded-2xl shadow-md overflow-hidden flex flex-col relative h-full transition-transform hover:shadow-xl ${
        isBackorder ? "ring-2 ring-amber-500" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => toggleFavorite(product.id)}
        className="product-favorite-btn"
        aria-label={
          favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"
        }
        title={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill={favorited ? "#ef4444" : "none"}
          stroke={favorited ? "#ef4444" : "currentColor"}
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 20.727c-.39 0-.78-.146-1.076-.438L4.318 13.72C2.83 12.25 2.83 9.868 4.318 8.4c1.487-1.47 3.898-1.47 5.385 0L12 10.667l2.297-2.267c1.487-1.47 3.898-1.47 5.385 0 1.487 1.469 1.487 3.85 0 5.319l-6.606 6.57c-.296.292-.686.438-1.076.438z"
          />
        </svg>
      </button>

      {/* Mídia (Imagem) */}
      <div className="monster-product-media relative h-40 md:h-52 bg-gray-100">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-zoom-in"
            loading="lazy"
            onClick={() => onOpenImage(product)}
          />
        ) : null}
        {isBackorder && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full border-2 border-amber-300 bg-amber-500/95 px-3 py-4 text-center shadow-xl">
              <div className="text-2xl md:text-3xl font-black tracking-wide text-black">
                SOB ENCOMENDA
              </div>
              <div className="mt-1 text-sm md:text-base font-bold text-black">
                {BACKORDER_SHORT_NOTICE}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="monster-product-body p-4 flex flex-col flex-grow justify-between">
        <div>
          <h3 className="monster-product-title font-bold text-lg md:text-xl text-gray-800 leading-tight mb-2">
            {product.name}
          </h3>
          <p className="monster-product-description hidden md:block text-sm text-stone-600 line-clamp-2 mb-3">
            {product.description}
          </p>
        </div>

        <div className="mt-2">
          <div className="flex flex-col gap-3">
            <span className="monster-product-price text-xl md:text-2xl font-bold text-stone-800">
              R$ {formatMoney(product.price)}
            </span>
            {product.quantidadeVenda && product.quantidadeVenda > 1 && (
              <span
                className="text-xs text-stone-500 mt-1 block"
                style={{ fontSize: "12px" }}
              >
                Mínimo: {product.quantidadeVenda} por compra
              </span>
            )}
            <button
              onClick={() => onAddToCart(product)}
              className="monster-buy-button w-full font-bold py-3 px-4 rounded-xl text-base md:text-lg transition-colors shadow-sm"
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

export default ProductCard;
