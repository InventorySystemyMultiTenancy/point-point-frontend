import { API_BASE_URL } from "./apiBase";
import { authenticatedFetch } from "./apiService";

const BASE_URL = API_BASE_URL;
const API_URL = `${BASE_URL}/api`;

export type OutsourcedServiceStatus = "pendente" | "concluido" | string;

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

export interface OutsourcedService {
  id: string;
  company_id: string;
  company_name?: string;
  service_type: string;
  service_type_label?: string;
  status: OutsourcedServiceStatus;
  input_quantity: number;
  input_unit: string;
  fabric_paid_amount?: number | null;
  expected_return_quantity: number;
  expected_return_unit: string;
  total_delivered_quantity?: number;
  remaining_quantity?: number;
  due_date: string;
  started_at?: string | null;
  is_overdue?: boolean;
  notes?: string | null;
  deliveries?: OutsourcedDelivery[];
}

export interface OutsourcedDelivery {
  id?: string;
  quantity: number;
  delivered_at: string;
  observation?: string | null;
}

export interface OutsourcedAlert {
  id: string;
  company_name?: string;
  service_type?: string;
  service_type_label?: string;
  due_date?: string;
  remaining_quantity?: number;
}

export interface OutsourcedAlertsResponse {
  count: number;
  alerts: OutsourcedAlert[];
}

export interface OutsourcedServiceType {
  value?: string;
  key?: string;
  service_type?: string;
  label?: string;
  name?: string;
}

export interface OutsourcedServicePayload {
  company_id: string;
  service_type: string;
  input_quantity: number;
  fabric_paid_amount?: number;
  expected_return_quantity: number;
  due_date: string;
  started_at?: string;
  notes?: string;
}

export type OutsourcedCompanyPayload = Omit<OutsourcedCompany, "id">;

function unwrapArray<T>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }
  return [];
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message)
        : `Erro na API (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function getOutsourcedServiceTypes() {
  const response = await authenticatedFetch(
    `${API_URL}/admin/outsourced-services/types`,
  );
  const data = await readJson<unknown>(response);
  return unwrapArray<OutsourcedServiceType>(data, ["types", "data"]);
}

export async function getOutsourcedCompanies() {
  const response = await authenticatedFetch(
    `${API_URL}/admin/outsourced-companies`,
  );
  const data = await readJson<unknown>(response);
  return unwrapArray<OutsourcedCompany>(data, ["companies", "data"]);
}

export async function createOutsourcedCompany(
  payload: OutsourcedCompanyPayload,
) {
  const response = await authenticatedFetch(
    `${API_URL}/admin/outsourced-companies`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return readJson<OutsourcedCompany>(response);
}

export async function updateOutsourcedCompany(
  id: string,
  payload: OutsourcedCompanyPayload,
) {
  const response = await authenticatedFetch(
    `${API_URL}/admin/outsourced-companies/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return readJson<OutsourcedCompany>(response);
}

export async function getOutsourcedServices(params?: {
  status?: string;
  overdue?: boolean;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.overdue) search.set("overdue", "true");

  const query = search.toString();
  const response = await authenticatedFetch(
    `${API_URL}/admin/outsourced-services${query ? `?${query}` : ""}`,
  );
  const data = await readJson<unknown>(response);
  return unwrapArray<OutsourcedService>(data, ["services", "data"]);
}

export async function getOutsourcedServiceAlerts() {
  const response = await authenticatedFetch(
    `${API_URL}/admin/outsourced-services/alerts`,
  );
  const data = await readJson<unknown>(response);
  if (Array.isArray(data)) {
    return { count: data.length, alerts: data as OutsourcedAlert[] };
  }
  const record = (data || {}) as Partial<OutsourcedAlertsResponse>;
  return {
    count: Number(record.count || record.alerts?.length || 0),
    alerts: record.alerts || [],
  };
}

export async function getOutsourcedService(id: string) {
  const response = await authenticatedFetch(
    `${API_URL}/admin/outsourced-services/${id}`,
  );
  return readJson<OutsourcedService>(response);
}

export async function createOutsourcedService(
  payload: OutsourcedServicePayload,
) {
  const response = await authenticatedFetch(
    `${API_URL}/admin/outsourced-services`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return readJson<OutsourcedService>(response);
}

export async function addOutsourcedServiceDelivery(
  id: string,
  payload: { quantity: number; delivered_at: string; observation?: string },
) {
  const response = await authenticatedFetch(
    `${API_URL}/admin/outsourced-services/${id}/deliveries`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return readJson<OutsourcedService>(response);
}

export async function finalizeOutsourcedService(id: string) {
  const response = await authenticatedFetch(
    `${API_URL}/admin/outsourced-services/${id}/finalize`,
    { method: "PUT" },
  );
  return readJson<OutsourcedService>(response);
}
