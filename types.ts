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
  costBreakdownEnabled?: boolean;
  hasCostBreakdown?: boolean;
  costSteps?: CostStep[];
  basePrice?: number;
  customPrice?: number | null;
  hasCustomPrice?: boolean;
  category: "Pastel" | "Bebida" | "Doce";
  imageUrl?: string;
  images?: string[];
  videoUrl: string;
  popular?: boolean;
  stock?: number;
  stock_reserved?: number | null;
  stock_available?: number | null;
  isAvailable?: boolean;
  isBackorder?: boolean;
  backorderQuantity?: number;
  backorderNotice?: string;
  minStock?: number; // Estoque mínimo
  quantidadeVenda?: number; // Quantidade mínima de venda
  active?: boolean; // Produto ativo ou inativo
  hidden?: boolean;
  visibleUserIds?: string[];
}

export interface CostStep {
  step: string;
  cost: number;
}

export type DeliveryMethodValue =
  | "carrier"
  | "pickup"
  | "in_person"
  | "contact";

export interface DeliveryMethod {
  value: DeliveryMethodValue;
  label: string;
  requiresCarrier: boolean;
}

export interface ShippingCarrier {
  id: string;
  name: string;
  trackingUrl?: string;
  active?: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  isBackorder?: boolean;
  backorderQuantity?: number;
  backorderNotice?: string;
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
  paymentMethod?: "credit" | "debit" | "pix" | "a_prazo" | "cheque" | "boleto";
  installments?: number;
  fee?: number;
  paymentStatus?: "pending" | "paid" | "authorized" | "canceled";
  entregueCliente?: boolean; // Indica se o pedido foi entregue ao cliente
  hasBackorder?: boolean;
  backorderNotice?: string;
  userMonthlyPayment?: boolean;
  monthlyBilling?: boolean;
  canMonthlyClose?: boolean;
  monthlyBillingMonth?: string;
  monthlyClosedAt?: string;
  monthlyClosedBy?: string;
  deliveryMethod?: DeliveryMethodValue;
  deliveryMethodLabel?: string;
  deliveryRequiresCarrier?: boolean;
  carrierId?: string | null;
  shippingCarrier?: ShippingCarrier | null;
  trackingUrl?: string | null;
  trackingMessage?: string;
}

export type UserRole =
  | "customer"
  | "kitchen"
  | "admin"
  | "superadmin"
  | "employee"
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
  fullAccess?: boolean;
  monthlyPayment?: boolean;
  active?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}
