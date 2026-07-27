import { authenticatedFetch, employeeFetch } from "./apiService";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const API_URL = `${BASE_URL}/api`;

const isEmployeeArea = () => {
  const route = `${window.location.pathname}${window.location.hash}`;
  return route.includes("/employee");
};

const outsourcedFetch = (url: string, options: RequestInit = {}) =>
  isEmployeeArea() ? employeeFetch(url, options) : authenticatedFetch(url, options);

export interface OutsourcedCompany {
  id: string;
  name: string;
  document?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  active?: boolean;
}

export interface OutsourcedDelivery {
  id: string;
  quantity?: number;
  items?: OutsourcedProductQuantity[];
  delivered_at: string;
  observation?: string | null;
}

export interface OutsourcedProduct {
  id: string;
  name: string;
  category?: string | null;
  stock?: number | null;
  imageUrl?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  fabricUsageItems?: OutsourcedFabricUsageItem[];
  fabric_usage_items?: OutsourcedFabricUsageItem[];
}

export interface OutsourcedFabricUsageItem {
  color: string;
  centimeters: number;
}

export interface OutsourcedProductQuantity {
  productId: string;
  product_id?: string;
  quantity: number;
  productName?: string;
  name?: string;
  category?: string | null;
  stock?: number | null;
  imageUrl?: string | null;
  image_url?: string | null;
}

export interface OutsourcedServiceCostItem {
  productId: string;
  product_id?: string;
  amount: number;
  productName?: string;
  name?: string;
}

export interface FabricCuttingSummaryItem {
  productId: string;
  productName: string;
  color: string;
  pieces: number;
  centimeters_per_piece: number;
  total_centimeters: number;
  total_meters: number;
}

export interface FabricCuttingSummaryTotal {
  color: string;
  pieces: number;
  total_centimeters: number;
  total_meters: number;
}

export interface FabricCuttingSummary {
  items: FabricCuttingSummaryItem[];
  totals_by_color: FabricCuttingSummaryTotal[];
}

export interface OutsourcedService {
  id: string;
  company_id: string;
  company_name: string;
  service_type: string;
  service_type_label?: string;
  status: "pendente" | "concluido" | string;
  input_quantity: number;
  input_unit: string;
  input_items?: OutsourcedProductQuantity[];
  fabric_paid_amount?: number | null;
  service_cost_amount?: number | null;
  service_cost_items?: OutsourcedServiceCostItem[];
  fabric_cutting_summary?: FabricCuttingSummary | null;
  expected_return_quantity?: number;
  expected_return_unit?: string;
  expected_return_items?: OutsourcedProductQuantity[];
  total_delivered_quantity: number;
  remaining_quantity: number;
  due_date: string;
  started_at?: string | null;
  is_overdue?: boolean;
  notes?: string | null;
  deliveries?: OutsourcedDelivery[];
  paid?: boolean;
  paid_at?: string | null;
  paid_amount?: number;
  remaining_amount?: number | null;
  payments?: OutsourcedServicePayment[];
}

export interface OutsourcedServicePayment {
  id: string;
  amount: number;
  paid_at: string;
  observation?: string | null;
}

export interface OutsourcedAlert {
  id: string;
  company_name: string;
  service_type?: string;
  service_type_label?: string;
  due_date: string;
  remaining_quantity: number;
}

export interface OutsourcedServiceType {
  value?: string;
  key?: string;
  id?: string;
  label: string;
  input_unit?: string;
  expected_return_unit?: string;
  inputUnit?: string;
  outputUnit?: string;
  inputMode?: "products" | "measure";
  outputMode?: "products" | "measure";
  active?: boolean;
  builtIn?: boolean;
}

export interface OutsourcedServiceTypePayload {
  label?: string;
  inputUnit?: string;
  outputUnit?: string;
  inputMode?: "products" | "measure";
  outputMode?: "products" | "measure";
  active?: boolean;
}

export interface OutsourcedCompanyPayload {
  name: string;
  document?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active: boolean;
}

export interface OutsourcedServicePayload {
  company_id: string;
  service_type: string;
  input_quantity?: number;
  fabric_paid_amount?: number;
  service_cost_amount?: number;
  service_cost_items?: OutsourcedServiceCostItem[];
  input_items?: OutsourcedProductQuantity[];
  expected_return_items: OutsourcedProductQuantity[];
  due_date: string;
  started_at?: string;
  notes?: string;
}

export interface OutsourcedServiceUpdatePayload {
  company_id?: string;
  service_type?: string;
  input_quantity?: number;
  fabric_paid_amount?: number;
  service_cost_amount?: number;
  service_cost_items?: OutsourcedServiceCostItem[];
  input_items?: OutsourcedProductQuantity[];
  expected_return_items?: OutsourcedProductQuantity[];
  due_date?: string;
  started_at?: string;
  notes?: string;
}

export interface OutsourcedDeliveryPayload {
  items: OutsourcedProductQuantity[];
  delivered_at: string;
  observation?: string;
}

export interface OutsourcedServicePaymentPayload {
  amount: number;
  paid_at: string;
  observation?: string;
}

const readJson = async <T>(response: Response): Promise<T> => {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Erro na API (${response.status})`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return data as T;
};

const unwrapArray = <T>(data: unknown, keys: string[]): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== "object") return [];

  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value as T[];
  }

  return [];
};

const unwrapObject = <T>(data: unknown, keys: string[]): T => {
  if (!data || typeof data !== "object") return data as T;
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key];
    if (value && typeof value === "object") return value as T;
  }
  return data as T;
};

export async function getOutsourcedServiceTypes() {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/types`,
  );
  const data = await readJson<unknown>(response);
  return unwrapArray<OutsourcedServiceType>(data, ["types", "data"]);
}

export async function createOutsourcedServiceType(
  payload: Required<OutsourcedServiceTypePayload>,
) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/types`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return unwrapObject<OutsourcedServiceType>(
    await readJson<unknown>(response),
    ["type", "data"],
  );
}

export async function updateOutsourcedServiceType(
  id: string,
  payload: OutsourcedServiceTypePayload,
) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/types/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return unwrapObject<OutsourcedServiceType>(
    await readJson<unknown>(response),
    ["type", "data"],
  );
}

export async function deleteOutsourcedServiceType(id: string) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/types/${id}`,
    {
      method: "DELETE",
    },
  );
  return readJson<unknown>(response);
}

export async function getOutsourcedProducts() {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/products`,
  );
  const data = await readJson<unknown>(response);
  const products = unwrapArray<OutsourcedProduct>(data, ["products", "data"]);

  // O endpoint de produtos terceirizados nem sempre retorna o consumo de
  // tecido cadastrado no cadastro principal do produto. Buscamos o catalogo
  // completo e completamos os itens que vierem sem essa informacao.
  try {
    const catalogResponse = await outsourcedFetch(`${API_URL}/products`);
    const catalogData = await readJson<unknown>(catalogResponse);
    const catalogProducts = unwrapArray<OutsourcedProduct>(catalogData, [
      "products",
      "data",
    ]);
    const fabricUsageById = new Map(
      catalogProducts.map((product) => [
        product.id,
        product.fabricUsageItems?.length
          ? product.fabricUsageItems
          : product.fabric_usage_items || [],
      ]),
    );
    return products.map((product) =>
      product.fabricUsageItems?.length || product.fabric_usage_items?.length
        ? product
        : {
            ...product,
            fabricUsageItems: fabricUsageById.get(product.id) || [],
          },
    );
  } catch {
    return products;
  }
}

export async function getOutsourcedCompanies() {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-companies`,
  );
  const data = await readJson<unknown>(response);
  return unwrapArray<OutsourcedCompany>(data, ["companies", "data"]);
}

export async function createOutsourcedCompany(
  payload: OutsourcedCompanyPayload,
) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-companies`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return unwrapObject<OutsourcedCompany>(
    await readJson<unknown>(response),
    ["company", "data"],
  );
}

export async function updateOutsourcedCompany(
  id: string,
  payload: OutsourcedCompanyPayload,
) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-companies/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return unwrapObject<OutsourcedCompany>(
    await readJson<unknown>(response),
    ["company", "data"],
  );
}

export async function getOutsourcedServices(filters?: {
  status?: string;
  companyId?: string;
  overdue?: boolean;
  companyName?: string;
  productId?: string;
  productName?: string;
  dueFrom?: string;
  dueTo?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.companyId) params.set("companyId", filters.companyId);
  if (filters?.overdue) params.set("overdue", "true");
  if (filters?.companyName) params.set("companyName", filters.companyName);
  if (filters?.productId) params.set("productId", filters.productId);
  if (filters?.productName) params.set("productName", filters.productName);
  if (filters?.dueFrom) params.set("dueFrom", filters.dueFrom);
  if (filters?.dueTo) params.set("dueTo", filters.dueTo);
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services${query}`,
  );
  const data = await readJson<unknown>(response);
  return unwrapArray<OutsourcedService>(data, ["services", "data"]);
}

export async function getOutsourcedServiceAlerts() {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/alerts`,
  );
  const data = await readJson<unknown>(response);
  const alerts = unwrapArray<OutsourcedAlert>(data, [
    "alerts",
    "services",
    "data",
  ]);
  const count =
    data && typeof data === "object" && typeof (data as { count?: unknown }).count === "number"
      ? (data as { count: number }).count
      : alerts.length;
  return { count, alerts };
}

export async function getOutsourcedService(id: string) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/${id}`,
  );
  return unwrapObject<OutsourcedService>(
    await readJson<unknown>(response),
    ["service", "data"],
  );
}

export async function createOutsourcedService(
  payload: OutsourcedServicePayload,
) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return unwrapObject<OutsourcedService>(
    await readJson<unknown>(response),
    ["service", "data"],
  );
}

export async function updateOutsourcedService(
  id: string,
  payload: OutsourcedServiceUpdatePayload,
) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return unwrapObject<OutsourcedService>(
    await readJson<unknown>(response),
    ["service", "data"],
  );
}

export async function addOutsourcedServiceDelivery(
  id: string,
  payload: OutsourcedDeliveryPayload,
) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/${id}/deliveries`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return unwrapObject<OutsourcedService>(
    await readJson<unknown>(response),
    ["service", "data"],
  );
}

export async function addOutsourcedServicePayment(
  id: string,
  payload: OutsourcedServicePaymentPayload,
) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/${id}/payments`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return readJson<{ payment: OutsourcedServicePayment; service: OutsourcedService }>(
    response,
  );
}

export async function finalizeOutsourcedService(id: string) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-services/${id}/finalize`,
    {
      method: "PUT",
    },
  );
  return readJson<unknown>(response);
}

export interface MarkCompanyServicesPaidResult {
  markedCount: number;
  totalPaid: number;
}

export async function markOutsourcedCompanyServicesPaid(
  companyId: string,
  filters?: { dueFrom?: string; dueTo?: string },
) {
  const response = await outsourcedFetch(
    `${API_URL}/admin/outsourced-companies/${companyId}/mark-services-paid`,
    {
      method: "PUT",
      body: JSON.stringify({
        dueFrom: filters?.dueFrom || undefined,
        dueTo: filters?.dueTo || undefined,
      }),
    },
  );
  return unwrapObject<MarkCompanyServicesPaidResult>(
    await readJson<unknown>(response),
    ["result", "data"],
  );
}
