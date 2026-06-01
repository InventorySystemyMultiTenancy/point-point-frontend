// P?gina: /pages/AdminPage.tsx
// Esta p?gina fornece uma interface administrativa simples para listar,
// adicionar, editar e remover produtos do "catalogo".
// Coment?rios em portugu?s explicam cada parte do c?digo.

import React, { useState, useEffect } from "react";
import {
  addStockMovement,
  filterStockMovementsByDate,
  getStockMovements,
  removeStockMovement,
  type StockMovement,
} from "../utils/stockMovements";

// Modal de movimentacao de estoque para multiplos produtos
const StockMovementModal: React.FC<{
  products: Product[];
  onClose: () => void;
  onMovement: (movements: { productId: string; quantity: number }[]) => void;
}> = ({ products, onClose, onMovement }) => {
  const [rows, setRows] = useState([
    { productId: products[0]?.id || "", quantity: 1 },
  ]);

  const handleRowChange = (
    idx: number,
    field: "productId" | "quantity",
    value: string | number,
  ) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? { ...row, [field]: field === "quantity" ? Number(value) : value }
          : row,
      ),
    );
  };

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { productId: products[0]?.id || "", quantity: 1 },
    ]);
  const removeRow = (idx: number) =>
    setRows((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx),
    );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-blue-800">
          Movimentacao de Estoque
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onMovement(rows.filter((r) => r.productId && r.quantity > 0));
          }}
        >
          <div className="space-y-4 mb-6 max-h-60 overflow-y-auto">
            {rows.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-end border-b pb-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">
                    Produto
                  </label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={row.productId}
                    onChange={(e) =>
                      handleRowChange(idx, "productId", e.target.value)
                    }
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium mb-1">Qtd</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={row.quantity}
                    min={1}
                    onChange={(e) =>
                      handleRowChange(idx, "quantity", e.target.value)
                    }
                  />
                </div>
                <button
                  type="button"
                  className="px-3 py-2 rounded bg-red-100 text-red-600 font-bold"
                  onClick={() => removeRow(idx)}
                  disabled={rows.length === 1}
                >
                  X
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="w-full mb-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold"
            onClick={addRow}
          >
            + Adicionar Produto
          </button>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="bg-stone-200 px-4 py-2 rounded-lg"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
import { useNavigate } from "react-router-dom";
import type { Product } from "../types";
import { authenticatedFetch, getBackorderedProducts } from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import {
  getOutsourcedServiceAlerts,
  type OutsourcedAlert,
} from "../services/outsourcedServices";

type BackorderedProduct = {
  id?: string;
  productId?: string;
  name?: string;
  productName?: string;
  category?: string;
  stock?: number;
  backorderQuantity?: number;
  quantityBackordered?: number;
  orderedQuantity?: number;
};

type BackorderedProductsData = {
  totalBackorderedUnits: number;
  products: BackorderedProduct[];
};

// --- Componente de formulario de produto (Modal) ---
// Props esperadas pelo formulario:
interface ProductFormProps {
  product: Product | null; // produto que ser? editado (null para novo)
  onSave: (product: Product) => void; // callback ao salvar
  onCancel: () => void; // callback ao cancelar/fechar
}

const ProductForm: React.FC<ProductFormProps> = ({
  product,
  onSave,
  onCancel,
}) => {
  // Estado local do formulario. Usamos Omit para nao incluir 'id' e 'imageUrl'
  // no tipo inicial, mas permitimos opcionalmente 'id' enquanto editamos.
  const [formData, setFormData] = useState<
    Omit<Product, "id"> & { id?: string }
  >({
    name: "",
    price: 0,
    priceRaw: 0,
    category: "Pelucia",
    imageUrl: "",
    stock: 0,
    minStock: 0,
    quantidadeVenda: 1,
  });
  const [imageUrls, setImageUrls] = useState<string[]>([""]);

  // ðŸ†• Estado para categorias dinÃ¢micas
  const [categories, setCategories] = useState<Array<{ name: string }>>([]);

  // ðŸ†• Carrega categorias ao montar componente
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { getCategories } = await import("../services/categoryService");
        const data = await getCategories();
        if (data.length > 0) {
          setCategories(data);
        } else {
          // Fallback caso nao haja categorias
          setCategories([
            { name: "Pelucia" },
            { name: "Bebida" },
            { name: "Doce" },
          ]);
        }
      } catch (error) {
        console.error("Erro ao carregar categorias:", error);
        // Fallback em caso de erro
        setCategories([
          { name: "Pelucia" },
          { name: "Bebida" },
          { name: "Doce" },
        ]);
        setCategories([
          { name: "Pelucia Ursinho" },
          { name: "Pelucia Coelho" },
          { name: "Pelucia Unicornio" },
          { name: "Acessorios" },
          { name: "Colecionaveis" },
        ]);
        setCategories([
          { name: "Pelucia" },
          { name: "Bebida" },
          { name: "Doce" },
        ]);
      }
    };
    loadCategories();
  }, []);

  // Quando o prop `product` muda (por ex. abrir para editar), preenche o formulario.
  useEffect(() => {
    if (product) {
      const existingImages =
        Array.isArray(product.images) && product.images.length > 0
          ? product.images
          : product.imageUrl
            ? [product.imageUrl]
            : [""];
      setFormData({
        ...product,
        quantidadeVenda: product.quantidadeVenda ?? 1,
      }); // preenche com dados existentes
      setImageUrls(existingImages);
    } else {
      // limpa para novo produto
      setFormData({
        name: "",
        price: 0,
        priceRaw: 0,
        category: categories.length > 0 ? categories[0].name : "Pelucia",
        imageUrl: "",
        stock: 0,
        minStock: 0,
        quantidadeVenda: 1,
      });
      setImageUrls([""]);
    }
  }, [product, categories]);

  // Atualiza campos do formulario. Convertendo price para n?mero quando necess?rio.
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    // Se for o campo 'price' ou 'stock', converte para n?mero; caso contr?rio mant?m string.
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "price" || name === "priceRaw"
          ? parseFloat(value)
          : name === "stock" ||
              name === "minStock" ||
              name === "quantidadeVenda"
            ? parseInt(value)
            : value,
    }));
  };

  // Ao submeter, cria um objeto Product final e chama onSave.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedImages = imageUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
    const primaryImage =
      normalizedImages[0] ||
      formData.imageUrl ||
      "https://picsum.photos/400/300";

    const finalProduct: Product = {
      ...formData,
      id: formData.id || "",
      imageUrl: primaryImage,
      images: normalizedImages.length > 0 ? normalizedImages : [primaryImage],
    };
    onSave(finalProduct); // informa o componente pai sobre o produto salvo
  };

  const updateImageAt = (index: number, value: string) => {
    setImageUrls((prev) => prev.map((url, i) => (i === index ? value : url)));
  };

  const addImageField = () => {
    setImageUrls((prev) => [...prev, ""]);
  };

  const removeImageField = (index: number) => {
    setImageUrls((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [""];
    });
  };

  return (
    // Modal em tela cheia com fundo escuro semitransparente
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start sm:items-center z-50 overflow-y-auto p-2 sm:p-4">
      <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Titulo muda conforme edicao ou criacao */}
        <h2 className="text-2xl font-bold mb-6 text-blue-800">
          {product ? "Editar Produto" : "Adicionar Produto"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-stone-700"
            >
              Nome
            </label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-blue-600 focus:ring-blue-200"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label
                htmlFor="price"
                className="block text-sm font-medium text-stone-700"
              >
                Preco de Venda
              </label>
              <input
                type="number"
                name="price"
                id="price"
                value={formData.price}
                onChange={handleChange}
                required
                step="0.01"
                className="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-blue-600 focus:ring-blue-200"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="priceRaw"
                className="block text-sm font-medium text-stone-700"
              >
                Preco Bruto
              </label>
              <input
                type="number"
                name="priceRaw"
                id="priceRaw"
                value={formData.priceRaw}
                onChange={handleChange}
                required
                step="0.01"
                className="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-blue-600 focus:ring-blue-200"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label
                htmlFor="category"
                className="block text-sm font-medium text-stone-700"
              >
                Categoria
              </label>
              <select
                name="category"
                id="category"
                value={formData.category}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-blue-600 focus:ring-blue-200"
              >
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option>Pelucia Ursinho</option>
                    <option>Pelucia Coelho</option>
                    <option>Pelucia Unicornio</option>
                    <option>Acessorios</option>
                    <option>Colecionaveis</option>
                  </>
                )}
              </select>
            </div>
            <div className="flex-1">
              <label
                htmlFor="minStock"
                className="block text-sm font-medium text-stone-700"
              >
                Estoque Minimo
              </label>
              <input
                type="number"
                name="minStock"
                id="minStock"
                value={formData.minStock}
                onChange={handleChange}
                required
                min="0"
                className="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-blue-600 focus:ring-blue-200"
              />
              <p className="mt-1 text-xs text-stone-500">
                Alerta de estoque baixo quando atingir esse valor
              </p>
            </div>
          </div>
          <div>
            <label
              htmlFor="imageUrl-0"
              className="block text-sm font-medium text-stone-700"
            >
              URLs das Imagens
            </label>
            <div className="mt-1 space-y-2">
              {imageUrls.map((url, index) => (
                <div key={`image-${index}`} className="flex items-center gap-2">
                  <input
                    type="url"
                    id={`imageUrl-${index}`}
                    value={url}
                    onChange={(e) => updateImageAt(index, e.target.value)}
                    placeholder="https://exemplo.com/imagem.jpg"
                    className="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
                  />
                  {imageUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeImageField(index)}
                      className="px-3 py-2 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addImageField}
              className="mt-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              + Adicionar outra imagem
            </button>
            <p className="mt-1 text-xs text-stone-500">
              A primeira URL sera a imagem principal do produto.
            </p>
          </div>
          <div>
            <label
              htmlFor="stock"
              className="block text-sm font-medium text-stone-700"
            >
              Estoque
            </label>
            <input
              type="number"
              name="stock"
              id="stock"
              value={formData.stock || 0}
              onChange={handleChange}
              required
              min="0"
              className="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
            />
            <p className="mt-1 text-xs text-stone-500">
              Quantidade disponivel em estoque
            </p>
          </div>
          <div>
            <label
              htmlFor="quantidadeVenda"
              className="block text-sm font-medium text-stone-700"
            >
              Quantidade de Venda
            </label>
            <input
              type="number"
              name="quantidadeVenda"
              id="quantidadeVenda"
              value={formData.quantidadeVenda || 1}
              onChange={handleChange}
              required
              min="1"
              className="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-blue-600 focus:ring-blue-200"
            />
            <p className="mt-1 text-xs text-stone-500">
              Exemplo: venda de 30 em 30, 15 em 15, etc. O cliente so pode
              comprar multiplos dessa quantidade.
            </p>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            {/* Botao cancelar fecha o modal sem salvar */}
            <button
              type="button"
              onClick={onCancel}
              className="bg-stone-200 text-stone-800 font-semibold py-2 px-4 rounded-lg hover:bg-stone-300"
            >
              Cancelar
            </button>
            {/* Botao salvar submete o formulario */}
            <button
              type="submit"
              className="bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-700"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Componente principal da p?gina administrativa ---
const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Estado que cont?m a lista de produtos exibida na tabela
  const [menu, setMenu] = useState<Product[]>([]);
  // Modal de movimentacao de estoque
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  // Historico de movimentacoes (backend)
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  // Filtro de datas para hist?rico
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  // Busca hist?rico do backend
  const loadStockMovements = async (start?: string, end?: string) => {
    setStockMovements(
      start && end ? filterStockMovementsByDate(start, end) : getStockMovements(),
    );
  };

  // Atualiza hist?rico ao abrir p?gina ou movimentar
  useEffect(() => {
    loadStockMovements();
  }, [isStockModalOpen]);

  // Lida com movimentacao de estoque
  const handleStockMovement = async (
    movements: { productId: string; quantity: number }[],
  ) => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

    try {
      for (const move of movements) {
        const product = menu.find((p) => p.id === move.productId);
        if (!product) continue;

        await authenticatedFetch(`${API_URL}/api/products/${move.productId}`, {
          method: "PUT",
          body: JSON.stringify({
            stock: (product.stock || 0) + move.quantity,
          }),
        });
        addStockMovement({
          id: `${move.productId}-${Date.now()}-${Math.random()}`,
          productId: move.productId,
          productName: product.name,
          quantity: move.quantity,
          date: new Date().toISOString(),
        });
      }
      await loadProducts();
      await loadStockMovements();
      setIsStockModalOpen(false);
    } catch (err) {
      alert("Erro ao processar movimentacoes");
    }
  };
  // Controla se o modal de formulario est? aberto
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Produto atual sendo editado (ou null para criar novo)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  // Estados para analise de IA
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  // Estados para estatisticas
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    lowStock: 0,
    outOfStock: 0,
  });
  const [outsourcedAlerts, setOutsourcedAlerts] = useState<OutsourcedAlert[]>(
    [],
  );
  const [backorderedData, setBackorderedData] =
    useState<BackorderedProductsData>({
      totalBackorderedUnits: 0,
      products: [],
    });

  // Carrega os dados iniciais do backend

  useEffect(() => {
    loadProducts();
    loadOrdersCount();
    loadOutsourcedAlerts();
    loadBackorderedProducts();
  }, []);

  // Busca o total de pedidos dos ultimos 30 dias
  const loadOutsourcedAlerts = async () => {
    try {
      const data = await getOutsourcedServiceAlerts();
      setOutsourcedAlerts(data.count > 0 ? data.alerts : []);
    } catch (err) {
      console.error("Erro ao buscar alertas de terceirizados:", err);
      setOutsourcedAlerts([]);
    }
  };

  const loadOrdersCount = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const res = await fetch(`${API_URL}/api/orders/last30days-count`);
      if (!res.ok) throw new Error("Erro ao buscar total de pedidos");
      const data = await res.json();
      setStats((prev) => ({ ...prev, totalOrders: data.totalOrders || 0 }));
    } catch (err) {
      console.error("Erro ao buscar total de pedidos:", err);
    }
  };

  const loadBackorderedProducts = async () => {
    try {
      const data = await getBackorderedProducts();
      const payload = data.data || data;
      setBackorderedData({
        totalBackorderedUnits: Number(payload.totalBackorderedUnits || 0),
        products: Array.isArray(payload.products) ? payload.products : [],
      });
    } catch (err) {
      console.error("Erro ao buscar produtos sob encomenda:", err);
      setBackorderedData({ totalBackorderedUnits: 0, products: [] });
    }
  };

  const loadProducts = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const res = await authenticatedFetch(`${API_URL}/api/products`);
      if (!res.ok) {
        throw new Error(`Erro ao carregar produtos: ${res.status}`);
      }
      const data = await res.json();
      setMenu(data);

      // Calcula estatisticas
      setStats({
        totalProducts: data.length,
        totalOrders: 0, // Sera atualizado pela analise de IA
        lowStock: data.filter(
          (p: Product) => p.stock !== null && p.stock > 0 && p.stock <= 5,
        ).length,
        outOfStock: data.filter((p: Product) => p.stock === 0).length,
      });
    } catch (err) {
      console.error("Erro ao carregar catalogo:", err);
    }
  };

  // Gerar analise de IA
  const handleGenerateAnalysis = async () => {
    setIsLoadingAnalysis(true);
    setShowAnalysis(true);
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

    try {
      const response = await fetch(`${API_URL}/api/ai/inventory-analysis`);
      const data = await response.json();

      if (data.success) {
        setAiAnalysis(data.analysis);
        // Atualiza estatisticas com dados do backend
        if (data.summary) {
          setStats((prev) => ({
            ...prev,
            totalOrders: data.summary.totalOrders || 0,
          }));
        }
      } else {
        setAiAnalysis(
          "Erro ao gerar analise: " + (data.error || "Erro desconhecido"),
        );
      }
    } catch (error) {
      console.error("Erro ao gerar analise:", error);
      setAiAnalysis(
        "Erro ao comunicar com o servidor. Verifique se a API esta disponivel.",
      );
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // Trata salvar (tanto criacao quanto edicao)
  const handleSaveProduct = async (product: Product) => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

    try {
      if (editingProduct) {
        // PUT para edicao
        const response = await authenticatedFetch(
          `${API_URL}/api/products/${product.id}`,
          {
            method: "PUT",
            body: JSON.stringify(product),
          },
        );

        if (response.ok) {
          console.log("Produto atualizado");
          await loadProducts(); // Recarrega lista
        } else {
          alert("Erro ao atualizar produto");
          return;
        }
      } else {
        // POST para criacao
        const response = await authenticatedFetch(`${API_URL}/api/products`, {
          method: "POST",
          body: JSON.stringify(product),
        });

        if (response.ok) {
          console.log("Produto criado");
          await loadProducts(); // Recarrega lista
        } else {
          alert("Erro ao criar produto");
          return;
        }
      }

      // Fecha o modal e reseta o estado de edicao
      setIsFormOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      alert("Erro ao salvar produto");
    }
  };

  // Remove um produto pela id via API
  const handleDeleteProduct = async (productId: string) => {
    // Confirmacao simples antes de remover
    if (window.confirm("Tem certeza que deseja remover este produto?")) {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

      try {
        const response = await authenticatedFetch(
          `${API_URL}/api/products/${productId}`,
          {
            method: "DELETE",
          },
        );

        if (response.ok) {
          console.log("Produto deletado:", productId);
          await loadProducts(); // Recarrega lista
        } else {
          alert("Erro ao deletar produto");
        }
      } catch (error) {
        console.error("Erro ao deletar produto:", error);
        alert("Erro ao deletar produto");
      }
    }
  };

  // Deleta movimentacao e reverte estoque (apenas ajustes manuais)
  const handleDeleteMovement = async (movement: StockMovement) => {
    const movType = (movement as StockMovement & { type?: string }).type;
    if (movType === "sale") {
      alert(
        "Nao e possivel excluir movimentacoes de venda. Cancele o pedido correspondente.",
      );
      return;
    }
    if (
      !window.confirm("Deseja remover esta movimentacao e reverter o estoque?")
    )
      return;
    const product = menu.find((p) => p.id === movement.productId);
    if (!product) return alert("Produto nao encontrado.");
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
    const response = await authenticatedFetch(
      `${API_URL}/api/products/${movement.productId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          stock: (product.stock || 0) - movement.quantity,
        }),
      },
    );
    if (response.ok) {
      removeStockMovement(movement.id);
      await loadProducts();
      await loadBackorderedProducts();
      await loadStockMovements();
    } else {
      alert("Erro ao atualizar estoque");
    }
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6">
      {/* Cabe?alho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-4xl font-bold text-blue-800">
          Painel Administrativo
        </h1>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsStockModalOpen(true)}
            className="bg-amber-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-600 transition-colors shadow-md"
          >
            Movimentacao Estoque
          </button>
          {/* Modal de movimentacao de estoque */}
          {isStockModalOpen && (
            <StockMovementModal
              products={menu}
              onClose={() => setIsStockModalOpen(false)}
              onMovement={handleStockMovement}
            />
          )}
          {/* Historico de movimentacoes de estoque */}
          <div className="mt-12"></div>
          <button
            onClick={() => navigate("/admin/categories")}
            className="bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-700 transition-colors shadow-md"
          >
            Categorias
          </button>
          <button
            onClick={() => navigate("/admin/outsourced-services")}
            className="bg-stone-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-stone-800 transition-colors shadow-md"
          >
            Servicos Terceirizados
          </button>
          <button
            onClick={() => navigate("/historico")}
            className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors shadow-md"
          >
            Historico de Pedidos
          </button>
          <button
            onClick={handleGenerateAnalysis}
            disabled={isLoadingAnalysis}
            className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors shadow-md disabled:bg-indigo-300 flex items-center gap-2"
          >
            {isLoadingAnalysis ? " Analisando..." : "Analise com IA"}
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setIsFormOpen(true);
            }}
            className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            + Adicionar Produto
          </button>
          <button
            onClick={async () => {
              if (window.confirm("Deseja realmente sair?")) {
                await logout();
                navigate("/admin/login");
              }
            }}
            className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Cards de Estatisticas */}
      {outsourcedAlerts.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 shadow">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-red-800">
                Servicos terceirizados atrasados
              </h2>
              <p className="text-sm text-red-700">
                Existem entregas fora do prazo aguardando retorno.
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/outsourced-services")}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              Ver servicos
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {outsourcedAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border border-red-100 bg-white p-4"
              >
                <div className="font-bold text-stone-900">
                  {alert.company_name}
                </div>
                <div className="text-sm text-stone-600">
                  {alert.service_type_label || alert.service_type || "Servico"}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <span className="font-semibold text-red-700">
                    Prazo vencido:{" "}
                    {new Date(alert.due_date).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="font-semibold text-stone-700">
                    Faltante: {alert.remaining_quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-lg">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">
              Produtos encomendados
            </h2>
            <p className="text-sm font-semibold text-blue-100">
              Estoque negativo significa unidades ja vendidas sob encomenda.
            </p>
          </div>
          <div className="rounded-lg bg-amber-600 px-4 py-3 text-center text-white">
            <div className="text-xs font-bold uppercase">Unidades</div>
            <div className="text-3xl font-black">
              {backorderedData.totalBackorderedUnits}
            </div>
          </div>
        </div>
        {backorderedData.products.length === 0 ? (
          <p className="rounded-lg bg-white p-4 text-sm font-semibold text-blue-100">
            Nenhum produto com estoque negativo no momento.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white">
            <table className="min-w-full divide-y divide-amber-100 text-sm">
              <thead className="bg-amber-100">
                <tr>
                  <th className="px-4 py-3 text-left font-black text-amber-950">
                    Produto
                  </th>
                  <th className="px-4 py-3 text-left font-black text-amber-950">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-right font-black text-amber-950">
                    Estoque
                  </th>
                  <th className="px-4 py-3 text-right font-black text-amber-950">
                    Encomendado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {backorderedData.products.map((product) => {
                  const stock = Number(product.stock || 0);
                  const orderedQuantity = Number(
                    product.backorderQuantity ||
                      product.quantityBackordered ||
                      product.orderedQuantity ||
                      Math.abs(Math.min(stock, 0)),
                  );
                  return (
                    <tr key={product.id || product.productId || product.name}>
                      <td className="px-4 py-3 font-bold text-stone-900">
                        {product.name || product.productName || "Produto"}
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {product.category || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-red-700">
                        {stock} un.
                      </td>
                      <td className="px-4 py-3 text-right font-black text-amber-800">
                        {orderedQuantity} un.
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="text-sm text-stone-500 mb-1">Total de Produtos</div>
          <div className="text-3xl font-bold text-blue-600">
            {stats.totalProducts}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <div className="text-sm text-stone-500 mb-1">Pedidos (30 dias)</div>
          <div className="text-3xl font-bold text-green-600">
            {stats.totalOrders}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
          <div className="text-sm text-stone-500 mb-1">Estoque Baixo</div>
          <div className="text-3xl font-bold text-yellow-600">
            {stats.lowStock}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-600">
          <div className="text-sm text-stone-500 mb-1">Esgotados</div>
          <div className="text-3xl font-bold text-blue-700">
            {stats.outOfStock}
          </div>
        </div>
      </div>

      {/* Area de Analise da IA */}
      {showAnalysis && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl shadow-lg mb-6 border border-purple-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-purple-800 flex items-center gap-2">
              Analise Inteligente de Estoque
            </h2>
            <button
              onClick={() => setShowAnalysis(false)}
              className="text-stone-500 hover:text-stone-700"
            >
              X
            </button>
          </div>
          {isLoadingAnalysis ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-stone-700 leading-relaxed">
                {aiAnalysis}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Renderiza o formulario/modal condicionalmente */}
      {isFormOpen && (
        <ProductForm
          product={editingProduct}
          onSave={handleSaveProduct}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingProduct(null);
          }}
        />
      )}

      {/* Secao de Gerenciamento de Produtos */}
      <h2 className="text-2xl font-bold text-stone-800 mb-4">
        Gerenciar Produtos
      </h2>

      {/* Tabela que lista os produtos */}
      <div className="bg-white shadow-xl rounded-2xl overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200 text-xs sm:text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th
                scope="col"
                className="px-2 sm:px-4 py-2 text-left font-medium text-stone-500 uppercase tracking-wider"
              >
                Produto
              </th>
              <th
                scope="col"
                className="px-2 sm:px-4 py-2 text-left font-medium text-stone-500 uppercase tracking-wider"
              >
                Categoria
              </th>
              <th
                scope="col"
                className="px-2 sm:px-4 py-2 text-left font-medium text-stone-500 uppercase tracking-wider"
              >
                Preco
              </th>
              <th
                scope="col"
                className="px-2 sm:px-4 py-2 text-left font-medium text-stone-500 uppercase tracking-wider"
              >
                Estoque
              </th>
              <th scope="col" className="relative px-2 sm:px-4 py-2">
                <span className="sr-only">Acoes</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-stone-200">
            {menu.map((product) => (
              <tr
                key={product.id}
                className={`hover:bg-stone-50 ${product.active === false ? "opacity-60" : ""}`}
              >
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <img
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover border border-stone-200"
                      src={product.images?.[0] || product.imageUrl}
                      alt={product.name}
                    />
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-stone-900">
                        {product.name}
                        {product.active === false && (
                          <span className="ml-2 text-xs text-yellow-700 font-bold">
                            (Inativo)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <span className="text-xs sm:text-sm text-stone-700">
                    {product.category}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <div className="text-xs sm:text-sm text-stone-900">
                    R${Number(product.price)?.toFixed(2) ?? "-"}
                  </div>
                  <div className="text-[10px] sm:text-xs text-stone-500">
                    Bruto: R${Number(product.priceRaw)?.toFixed(2) ?? "-"}
                  </div>
                </td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      (product.stock || 0) <= 0
                        ? "bg-amber-100 text-amber-900"
                        : product.minStock !== undefined &&
                            product.stock !== undefined &&
                            product.stock < product.minStock
                          ? "bg-yellow-100 text-yellow-800 animate-pulse"
                          : "bg-green-100 text-green-800"
                    }`}
                  >
                    {product.stock || 0} un.
                  </span>
                  {(product.stock || 0) <= 0 && (
                    <span className="ml-1 text-[10px] sm:text-xs text-amber-700 font-bold">
                      Sob encomenda
                    </span>
                  )}
                  {product.minStock !== undefined &&
                    product.stock !== undefined &&
                    product.stock < product.minStock && (
                      <span className="ml-1 text-[10px] sm:text-xs text-blue-600 font-bold animate-pulse">
                        Estoque baixo!
                      </span>
                    )}
                </td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      setIsFormOpen(true);
                    }}
                    className="text-blue-600 hover:text-blue-900 mr-2 sm:mr-4"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="text-blue-700 hover:text-blue-900 mr-2 sm:mr-4"
                  >
                    Remover
                  </button>
                  <button
                    onClick={async () => {
                      const API_URL =
                        import.meta.env.VITE_API_URL || "http://localhost:3001";
                      const resp = await authenticatedFetch(
                        `${API_URL}/api/products/${product.id}`,
                        {
                          method: "PUT",
                          body: JSON.stringify({ active: !product.active }),
                        },
                      );
                      if (resp.ok) {
                        await loadProducts();
                      } else {
                        alert("Erro ao atualizar status do produto");
                      }
                    }}
                    className={
                      product.active
                        ? "text-yellow-700 hover:text-yellow-900"
                        : "text-green-700 hover:text-green-900"
                    }
                  >
                    {product.active ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-16 bg-white rounded-2xl shadow-lg px-6 py-8 mb-8">
        <h2 className="text-2xl font-bold text-stone-800 mb-6">
          Historico de Movimentacoes de Estoque
        </h2>
        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">De</label>
            <input
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
              className="border rounded px-3 py-2 min-w-[140px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Ate</label>
            <input
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
              className="border rounded px-3 py-2 min-w-[140px]"
            />
          </div>
          <button
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 font-semibold"
            onClick={() =>
              loadStockMovements(
                filterStart || undefined,
                filterEnd || undefined,
              )
            }
          >
            Filtrar
          </button>
          <button
            className="bg-stone-200 px-5 py-2 rounded-lg font-semibold"
            onClick={() => {
              setFilterStart("");
              setFilterEnd("");
              loadStockMovements();
            }}
          >
            Limpar Filtro
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[560px] w-full bg-white rounded-xl shadow divide-y">
            <thead>
              <tr className="bg-stone-100">
                <th className="p-3 text-left text-xs font-bold">Data/Hora</th>
                <th className="p-3 text-left text-xs font-bold">Produto</th>
                <th className="p-3 text-left text-xs font-bold">Tipo</th>
                <th className="p-3 text-right text-xs font-bold">Quantidade</th>
                <th className="p-3 text-right text-xs font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {stockMovements.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-stone-500 text-base"
                  >
                    Nenhuma movimentacao registrada.
                  </td>
                </tr>
              ) : (
                stockMovements.map((m) => {
                  const qty = Number(m.quantity);
                  const isEntry = qty > 0;
                  const movType = (m as StockMovement & { type?: string }).type;
                  const typeLabel =
                    movType === "sale"
                      ? "Venda"
                      : movType === "cancel"
                        ? "Cancelamento"
                        : movType === "return"
                          ? "Devolucao"
                          : "Ajuste manual";
                  return (
                    <tr key={m.id}>
                      <td className="p-3 text-xs">
                        {new Date(m.date).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 text-xs">{m.productName}</td>
                      <td className="p-3 text-xs text-stone-500">
                        {typeLabel}
                      </td>
                      <td
                        className={`p-3 text-xs text-right font-bold ${isEntry ? "text-emerald-700" : "text-red-600"}`}
                      >
                        {isEntry ? `+${qty}` : qty}
                      </td>
                      <td className="p-3 text-xs text-right">
                        {movType === "manual" && (
                          <button
                            className="text-red-500 hover:underline text-xs"
                            onClick={() => handleDeleteMovement(m)}
                          >
                            Desfazer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

