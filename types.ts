/**
 * Representa um produto disponível na pastelaria.
 *
 * @interface Product
 *
 * @property {string} id - O identificador único do produto.
 * @property {string} name - O nome do produto.
 * @property {string} description - Uma descrição detalhada do produto.
 * @property {number} price - O preço do produto em moeda local.
 * @property {'Pastel' | 'Bebida' | 'Doce'} category - A categoria do produto, que pode ser um pastel, uma bebida ou um doce.
 * @property {string} imageUrl - A URL principal da imagem do produto.
 * @property {string[]} images - Lista de URLs de imagens do produto.
 * @property {string} videoUrl - A URL do vídeo do produto.
 */
export interface Product {
  id: string;
  name: string;
  price: number;
  priceRaw: number; // Preço bruto
  category: "Pastel" | "Bebida" | "Doce";
  imageUrl?: string;
  images?: string[];
  videoUrl: string;
  popular?: boolean;
  stock?: number;
  minStock?: number; // Estoque mínimo
  quantidadeVenda?: number; // Quantidade mínima de venda
  active?: boolean; // Produto ativo ou inativo
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  /** Nome do usuário que realizou o pedido (duplicado para histórico rápido) */
  userName?: string;
  items: OrderItem[];
  total: number;
  timestamp: string;
  status: "active" | "completed";
  observation?: string;
  // Novos campos para pagamento
  paymentType?: "online" | "presencial";
  paymentMethod?: "credit" | "debit" | "pix";
  installments?: number;
  fee?: number;
  paymentStatus?: "pending" | "paid" | "canceled";
  entregueCliente?: boolean; // Indica se o pedido foi entregue ao cliente
}

export type UserRole =
  | "customer"
  | "kitchen"
  | "admin"
  | "superadmin"
  | "admincustomer";

export interface User {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  historico: Order[];
  pontos?: number;
  role?: UserRole; // Tipo de usuário: customer (padrão), kitchen ou admin
}

export interface CartItem extends Product {
  quantity: number;
}
