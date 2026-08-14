import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";

interface FavoritesContextType {
  favoriteIds: string[];
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(
  undefined,
);

export const FavoritesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("poitpoit_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Erro ao recuperar favoritos:", error);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("poitpoit_favorites", JSON.stringify(favoriteIds));
    } catch (error) {
      console.error("Erro ao salvar favoritos:", error);
    }
  }, [favoriteIds]);

  const isFavorite = (productId: string) => favoriteIds.includes(productId);

  const toggleFavorite = (productId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  };

  return (
    <FavoritesContext.Provider
      value={{ favoriteIds, isFavorite, toggleFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
};
