import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "../hooks/useDebounce";
import StatCard from "../components/admin/StatCard";
import {
  addOutsourcedServiceDelivery,
  addOutsourcedServicePayment,
  createOutsourcedCompany,
  createOutsourcedService,
  createOutsourcedServiceType,
  deleteOutsourcedServiceType,
  finalizeOutsourcedService,
  getOutsourcedCompanies,
  getOutsourcedProducts,
  getOutsourcedService,
  getOutsourcedServices,
  getOutsourcedServiceTypes,
  markOutsourcedCompanyServicesPaid,
  type OutsourcedCompany,
  type OutsourcedCompanyPayload,
  type OutsourcedDeliveryPayload,
  type FabricCuttingSummary,
  type OutsourcedProduct,
  type OutsourcedProductQuantity,
  type OutsourcedService,
  type OutsourcedServiceCostItem,
  type OutsourcedServicePayload,
  type OutsourcedServicePaymentPayload,
  type OutsourcedServiceUpdatePayload,
  type OutsourcedServiceType,
  type OutsourcedServiceTypePayload,
  updateOutsourcedService,
  updateOutsourcedServiceType,
  updateOutsourcedCompany,
} from "../services/outsourcedServices";

const SERVICE_FALLBACKS: Required<OutsourcedServiceType>[] = [
  {
    id: "fabric_cutting",
    key: "fabric_cutting",
    value: "fabric_cutting",
    label: "Retirada de tecido para corte",
    input_unit: "metros",
    expected_return_unit: "unidades",
    inputUnit: "metros",
    outputUnit: "unidades",
    inputMode: "measure",
    outputMode: "products",
    active: true,
    builtIn: true,
  },
  {
    id: "embroidery",
    key: "embroidery",
    value: "embroidery",
    label: "Bordagem",
    input_unit: "unidades",
    expected_return_unit: "unidades",
    inputUnit: "unidades",
    outputUnit: "unidades",
    inputMode: "products",
    outputMode: "products",
    active: true,
    builtIn: true,
  },
  {
    id: "sewing",
    key: "sewing",
    value: "sewing",
    label: "Costura",
    input_unit: "unidades",
    expected_return_unit: "unidades",
    inputUnit: "unidades",
    outputUnit: "unidades",
    inputMode: "products",
    outputMode: "products",
    active: true,
    builtIn: true,
  },
  {
    id: "stuffing",
    key: "stuffing",
    value: "stuffing",
    label: "Enchimento",
    input_unit: "unidades",
    expected_return_unit: "unidades",
    inputUnit: "unidades",
    outputUnit: "unidades",
    inputMode: "products",
    outputMode: "products",
    active: true,
    builtIn: true,
  },
  {
    id: "closing",
    key: "closing",
    value: "closing",
    label: "Fechamento",
    input_unit: "unidades",
    expected_return_unit: "unidades",
    inputUnit: "unidades",
    outputUnit: "unidades",
    inputMode: "products",
    outputMode: "products",
    active: true,
    builtIn: true,
  },
];

const emptyCompany: OutsourcedCompanyPayload = {
  name: "",
  document: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  active: true,
};

const emptyService = {
  company_id: "",
  service_type: "fabric_cutting",
  input_quantity: "",
  fabric_paid_amount: "",
  service_cost_amount: "",
  service_cost_items: [{ productId: "", amount: "", unitAmount: "" }],
  expected_return_items: [{ productId: "", quantity: "" }],
  due_date: "",
  started_at: "",
  notes: "",
};

const emptyDelivery = {
  items: [{ productId: "", quantity: "" }],
  delivered_at: "",
  observation: "",
};

const emptyPayment = {
  amount: "",
  paid_at: "",
  observation: "",
};

const emptyTypeForm: Required<OutsourcedServiceTypePayload> = {
  label: "",
  inputUnit: "unidades",
  outputUnit: "unidades",
  inputMode: "products",
  outputMode: "products",
  active: true,
};

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const toIsoOrUndefined = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const money = (value?: number | null) =>
  typeof value === "number"
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "-";

const serviceTypeValue = (type: OutsourcedServiceType) =>
  type.value || type.key || type.id || "";

const serviceTypeId = (type: OutsourcedServiceType) =>
  type.id || serviceTypeValue(type);

const normalizeServiceTypes = (items: Array<OutsourcedServiceType | string>) => {
  const normalized = items
    .map((item) => {
      if (typeof item === "string") {
        return (
          SERVICE_FALLBACKS.find((type) => serviceTypeValue(type) === item) || {
            id: item,
            value: item,
            label: item,
            inputUnit: "unidades",
            outputUnit: "unidades",
            inputMode: "products" as const,
            outputMode: "products" as const,
            active: true,
          }
        );
      }
      return item;
    })
    .filter((item): item is OutsourcedServiceType => Boolean(item))
    .map((item) => ({
      ...item,
      value: serviceTypeValue(item),
      inputUnit: item.inputUnit || item.input_unit || "unidades",
      outputUnit: item.outputUnit || item.expected_return_unit || "unidades",
      inputMode: item.inputMode || "products",
      outputMode: item.outputMode || "products",
      active: item.active !== false,
    }));

  return normalized.length > 0 ? normalized : SERVICE_FALLBACKS;
};

const getTypeLabel = (
  value: string,
  types: OutsourcedServiceType[],
  fallback?: string,
) =>
  fallback ||
  types.find((type) => serviceTypeValue(type) === value)?.label ||
  SERVICE_FALLBACKS.find((type) => type.value === value)?.label ||
  value;

const statusClasses = (service: OutsourcedService) => {
  if (service.is_overdue) return "outsourced-status-pill is-overdue";
  if (service.status === "concluido")
    return "outsourced-status-pill is-complete";
  return "outsourced-status-pill is-pending";
};

const getInputUnit = (serviceType: string, types: OutsourcedServiceType[] = []) =>
  types.find((type) => serviceTypeValue(type) === serviceType)?.inputUnit ||
  types.find((type) => serviceTypeValue(type) === serviceType)?.input_unit ||
  (isFabricCuttingService(serviceType, types) ? "metros" : "unidades");

const totalItemsQuantity = (items?: Array<{ quantity?: number | string }>) =>
  (items || []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);

const productImage = (
  product?: OutsourcedProduct | OutsourcedProductQuantity,
) => {
  if (!product) return "";
  return (
    product.imageUrl ||
    product.image_url ||
    (Array.isArray(product.images) ? product.images[0] : "") ||
    ""
  );
};

const productName = (
  productId: string,
  products: OutsourcedProduct[],
  item?: Partial<OutsourcedProductQuantity> | OutsourcedServiceCostItem,
) =>
  item?.productName ||
  item?.name ||
  products.find((product) => product.id === productId)?.name ||
  productId;

const itemProductId = (item: OutsourcedProductQuantity) =>
  item.productId || item.product_id || "";

const formatProductItems = (
  items: OutsourcedProductQuantity[] | undefined,
  products: OutsourcedProduct[],
) => {
  if (!items?.length) return "-";
  return items
    .map((item) => {
      const productId = itemProductId(item);
      return `${productName(productId, products, item)}: ${item.quantity}`;
    })
    .join(", ");
};

const isSewingService = (
  value: string,
  types: OutsourcedServiceType[] = [],
) => {
  const label = getTypeLabel(value, types).toLowerCase();
  return value === "sewing" || label.includes("costura");
};

// Servicos que permitem cadastrar o valor por produto (ex.: por pelucia) e somam o
// total automaticamente: costura, fechamento e enchimento + fechamento (combinado).
const usesPerProductServiceCost = (
  value: string,
  types: OutsourcedServiceType[] = [],
) => {
  const label = getTypeLabel(value, types).toLowerCase();
  return (
    isSewingService(value, types) ||
    value === "closing" ||
    label.includes("fechamento")
  );
};

const isFabricCuttingService = (
  value: string,
  types: OutsourcedServiceType[] = [],
) => {
  const normalizedValue = (value || "").toLowerCase();
  const label = getTypeLabel(value, types).toLowerCase();
  return (
    normalizedValue === "fabric_cutting" ||
    normalizedValue.includes("corte") ||
    normalizedValue.includes("cortar") ||
    label.includes("corte") ||
    label.includes("cortar")
  );
};

const outputRequiresProducts = (
  value: string,
  types: OutsourcedServiceType[] = [],
) => {
  const type = types.find((item) => serviceTypeValue(item) === value);
  return (type?.outputMode || "products") !== "measure";
};

const totalCostItems = (items?: Array<{ amount?: number | string }>) =>
  (items || []).reduce((total, item) => total + (Number(item.amount) || 0), 0);

const formatCostItems = (
  items: OutsourcedServiceCostItem[] | undefined,
  products: OutsourcedProduct[],
) => {
  if (!items?.length) return "-";
  return items
    .map((item) => {
      const productId = item.productId || item.product_id || "";
      const unitLabel =
        item.unitAmount != null ? ` (${money(Number(item.unitAmount))}/un.)` : "";
      return `${productName(productId, products, item)}: ${money(Number(item.amount) || 0)}${unitLabel}`;
    })
    .join(", ");
};

const productFabricUsageItems = (product?: OutsourcedProduct) =>
  Array.isArray(product?.fabricUsageItems)
    ? product.fabricUsageItems
    : Array.isArray(product?.fabric_usage_items)
      ? product.fabric_usage_items
      : [];

const formatMeters = (value?: number | null) =>
  `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} m`;

const buildFabricCuttingPreview = (
  rows: Array<{ productId: string; quantity: string }>,
  products: OutsourcedProduct[],
): FabricCuttingSummary => {
  const items = rows.flatMap((row) => {
    const product = products.find((item) => item.id === row.productId);
    const pieces = Number(row.quantity) || 0;
    if (!product || pieces <= 0) return [];

    return productFabricUsageItems(product)
      .filter((usage) => usage.color?.trim() && Number(usage.centimeters) > 0)
      .map((usage) => {
        const centimetersPerPiece = Number(usage.centimeters) || 0;
        const totalCentimeters = pieces * centimetersPerPiece;
        return {
          productId: product.id,
          productName: product.name,
          color: usage.color,
          pieces,
          centimeters_per_piece: centimetersPerPiece,
          total_centimeters: totalCentimeters,
          total_meters: totalCentimeters / 100,
        };
      });
  });

  const totalsByColor = Array.from(
    items.reduce((acc, item) => {
      const current = acc.get(item.color) || {
        color: item.color,
        pieces: 0,
        total_centimeters: 0,
        total_meters: 0,
      };
      current.pieces += item.pieces;
      current.total_centimeters += item.total_centimeters;
      current.total_meters = current.total_centimeters / 100;
      acc.set(item.color, current);
      return acc;
    }, new Map<string, FabricCuttingSummary["totals_by_color"][number]>()),
  ).map(([, value]) => value);

  return { items, totals_by_color: totalsByColor };
};

const FabricCuttingSummaryBox: React.FC<{
  summary?: FabricCuttingSummary | null;
  emptyMessage?: string;
}> = ({
  summary,
  emptyMessage = "Nenhum consumo de tecido cadastrado para os produtos selecionados.",
}) => {
  const items = summary?.items || [];
  const totals = summary?.totals_by_color || [];

  return (
    <div className="rounded-lg border border-pink-100 bg-pink-50 p-4">
      <h3 className="text-sm font-bold uppercase text-stone-700">
        Resumo de corte
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">{emptyMessage}</p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {items.map((item, index) => (
              <p key={`${item.productId}-${item.color}-${index}`} className="text-sm text-stone-700">
                <span className="font-semibold">{item.productName}</span>: cortar{" "}
                {item.pieces} peças de {item.centimeters_per_piece} cm de tecido{" "}
                {item.color}, totalizando {formatMeters(item.total_meters)} ({item.pieces}{" "}
                {item.pieces === 1 ? "retalho" : "retalhos"} de tecido {item.color} de{" "}
                {item.centimeters_per_piece} cm)
              </p>
            ))}
          </div>
          <div className="mt-3 rounded-md bg-white px-3 py-2">
            <p className="mb-1 text-xs font-bold uppercase text-stone-500">
              Totais por cor
            </p>
            <div className="space-y-1">
              {totals.map((total) => (
                <p key={total.color} className="text-sm font-semibold text-stone-800">
                  {total.color}: {formatMeters(total.total_meters)} no total (
                  {total.pieces} {total.pieces === 1 ? "retalho" : "retalhos"})
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const FabricCuttingTotalsInline: React.FC<{
  summary?: FabricCuttingSummary | null;
}> = ({ summary }) => {
  const totals = summary?.totals_by_color || [];
  if (totals.length === 0) {
    return (
      <span className="block text-xs text-stone-400">
        Nenhum consumo de tecido cadastrado.
      </span>
    );
  }

  return (
    <span className="block text-xs font-semibold text-pink-700">
      {totals
        .map(
          (total) =>
            `${total.color}: ${formatMeters(total.total_meters)} (${total.pieces} retalho${total.pieces === 1 ? "" : "s"})`,
        )
        .join(" | ")}
    </span>
  );
};

const ProgressBar: React.FC<{ service: OutsourcedService }> = ({ service }) => {
  const expected =
    Number(service.expected_return_quantity) ||
    totalItemsQuantity(service.expected_return_items);
  const delivered = Number(service.total_delivered_quantity) || 0;
  const percent = expected > 0 ? Math.min((delivered / expected) * 100, 100) : 0;

  return (
    <div className="min-w-[150px]">
      <div className="mb-1 flex justify-between text-xs text-stone-500">
        <span>
          {delivered} / {expected}
        </span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div
          className={`h-full rounded-full ${
            service.is_overdue ? "bg-red-500" : "bg-purple-600"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

const AdminOutsourcedServicesPage: React.FC = () => {
  const isEmployeeView = `${window.location.pathname}${window.location.hash}`.includes(
    "/employee",
  );
  const [activeTab, setActiveTab] = useState<"services" | "companies" | "types">(
    "services",
  );
  const [companies, setCompanies] = useState<OutsourcedCompany[]>([]);
  const [services, setServices] = useState<OutsourcedService[]>([]);
  const [types, setTypes] = useState<OutsourcedServiceType[]>(SERVICE_FALLBACKS);
  const [products, setProducts] = useState<OutsourcedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pendente" | "concluido" | "overdue"
  >("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [companyNameSearch, setCompanyNameSearch] = useState("");
  const [productNameSearch, setProductNameSearch] = useState("");
  const debouncedCompanyName = useDebounce(companyNameSearch, 400);
  const debouncedProductName = useDebounce(productNameSearch, 400);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [companyPaymentServices, setCompanyPaymentServices] = useState<
    OutsourcedService[]
  >([]);
  const [loadingCompanyPayment, setLoadingCompanyPayment] = useState(false);
  const [markingCompanyPaid, setMarkingCompanyPaid] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const servicesTableScrollRef = useRef<HTMLDivElement>(null);
  const servicesTableTopScrollRef = useRef<HTMLDivElement>(null);
  const [servicesTableScrollWidth, setServicesTableScrollWidth] = useState(0);
  const isSyncingTableScroll = useRef(false);

  const handleServicesTopScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingTableScroll.current) {
      isSyncingTableScroll.current = false;
      return;
    }
    if (servicesTableScrollRef.current) {
      isSyncingTableScroll.current = true;
      servicesTableScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  };

  const handleServicesTableScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingTableScroll.current) {
      isSyncingTableScroll.current = false;
      return;
    }
    if (servicesTableTopScrollRef.current) {
      isSyncingTableScroll.current = true;
      servicesTableTopScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  };

  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [companyModal, setCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] =
    useState<OutsourcedCompany | null>(null);
  const [companyForm, setCompanyForm] =
    useState<OutsourcedCompanyPayload>(emptyCompany);
  const [serviceModal, setServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({ ...emptyService });
  const [editingService, setEditingService] = useState<OutsourcedService | null>(
    null,
  );
  const [selectedService, setSelectedService] =
    useState<OutsourcedService | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({ ...emptyDelivery });
  const [paymentForm, setPaymentForm] = useState({ ...emptyPayment });
  const [editingType, setEditingType] = useState<OutsourcedServiceType | null>(
    null,
  );
  const [typeForm, setTypeForm] =
    useState<Required<OutsourcedServiceTypePayload>>(emptyTypeForm);

  const loadPageData = async () => {
    setError("");
    setLoading(true);
    try {
      const [companyList, typeList, productList] = await Promise.all([
        getOutsourcedCompanies(),
        getOutsourcedServiceTypes().catch(() => SERVICE_FALLBACKS),
        getOutsourcedProducts().catch(() => []),
      ]);
      setCompanies(companyList);
      setTypes(normalizeServiceTypes(typeList));
      setProducts(productList);
      await loadServices(statusFilter);
    } catch (err) {
      console.error("Erro ao carregar servicos terceirizados:", err);
      setError("Nao foi possivel carregar os servicos terceirizados.");
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async (
    filter: "all" | "pendente" | "concluido" | "overdue" = statusFilter,
    companyName: string = debouncedCompanyName,
    productName: string = debouncedProductName,
    dueFromValue: string = dueFrom,
    dueToValue: string = dueTo,
  ) => {
    const nextServices = await getOutsourcedServices({
      ...(filter === "overdue"
        ? { overdue: true }
        : filter === "all"
          ? {}
          : { status: filter }),
      ...(companyName.trim() ? { companyName: companyName.trim() } : {}),
      ...(productName.trim() ? { productName: productName.trim() } : {}),
      ...(dueFromValue ? { dueFrom: dueFromValue } : {}),
      ...(dueToValue ? { dueTo: dueToValue } : {}),
    });
    setServices(nextServices);
  };

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    loadServices(
      statusFilter,
      debouncedCompanyName,
      debouncedProductName,
      dueFrom,
      dueTo,
    ).catch((err) => {
      console.error("Erro ao filtrar servicos:", err);
      setError("Nao foi possivel aplicar o filtro.");
    });
  }, [statusFilter, debouncedCompanyName, debouncedProductName, dueFrom, dueTo]);

  useEffect(() => {
    if (companyFilter === "all") {
      setCompanyPaymentServices([]);
      return;
    }
    let isMounted = true;
    setLoadingCompanyPayment(true);
    getOutsourcedServices({
      companyId: companyFilter,
      ...(dueFrom ? { dueFrom } : {}),
      ...(dueTo ? { dueTo } : {}),
    })
      .then((data) => {
        if (isMounted) setCompanyPaymentServices(data);
      })
      .catch((err) => {
        console.error("Erro ao carregar pagamentos da empresa:", err);
        if (isMounted) setCompanyPaymentServices([]);
      })
      .finally(() => {
        if (isMounted) setLoadingCompanyPayment(false);
      });
    return () => {
      isMounted = false;
    };
  }, [companyFilter, dueFrom, dueTo]);

  const companyPaymentSummary = useMemo(() => {
    const withCost = companyPaymentServices.filter(
      (service) => service.service_cost_amount != null,
    );
    const open = withCost.filter((service) => !service.paid);
    const paid = withCost.filter((service) => service.paid);
    const partial = open.filter((service) => (service.paid_amount || 0) > 0);
    return {
      openTotal: totalCostItems(
        open.map((service) => ({
          amount:
            service.remaining_amount ??
            (service.service_cost_amount || 0) - (service.paid_amount || 0),
        })),
      ),
      paidTotal: totalCostItems(
        paid.map((service) => ({ amount: service.service_cost_amount || 0 })),
      ),
      openCount: open.length,
      paidCount: paid.length,
      partialCount: partial.length,
      partialTotal: totalCostItems(
        partial.map((service) => ({ amount: service.paid_amount || 0 })),
      ),
    };
  }, [companyPaymentServices]);

  const handleMarkCompanyPaid = async () => {
    if (companyFilter === "all" || companyPaymentSummary.openCount === 0) return;
    const company = companies.find((item) => item.id === companyFilter);
    const confirmed = window.confirm(
      `Marcar ${companyPaymentSummary.openCount} servico(s) de "${
        company?.name || "empresa"
      }" como pago, totalizando ${money(companyPaymentSummary.openTotal)}?`,
    );
    if (!confirmed) return;

    setMarkingCompanyPaid(true);
    try {
      const result = await markOutsourcedCompanyServicesPaid(companyFilter, {
        ...(dueFrom ? { dueFrom } : {}),
        ...(dueTo ? { dueTo } : {}),
      });
      await Promise.all([
        getOutsourcedServices({
          companyId: companyFilter,
          ...(dueFrom ? { dueFrom } : {}),
          ...(dueTo ? { dueTo } : {}),
        }).then(setCompanyPaymentServices),
        loadServices(statusFilter, debouncedCompanyName, debouncedProductName),
      ]);
      alert(
        `${result.markedCount} servico(s) marcado(s) como pago, totalizando ${money(result.totalPaid)}.`,
      );
    } catch (err) {
      console.error("Erro ao marcar servicos como pago:", err);
      alert("Erro ao marcar servicos como pago.");
    } finally {
      setMarkingCompanyPaid(false);
    }
  };

  const visibleServices = useMemo(
    () =>
      companyFilter === "all"
        ? services
        : services.filter((service) => service.company_id === companyFilter),
    [companyFilter, services],
  );

  useEffect(() => {
    const tableContainer = servicesTableScrollRef.current;
    if (!tableContainer || viewMode !== "table") return;

    const updateScrollWidth = () =>
      setServicesTableScrollWidth(tableContainer.scrollWidth);

    updateScrollWidth();

    const resizeObserver = new ResizeObserver(updateScrollWidth);
    resizeObserver.observe(tableContainer);
    return () => resizeObserver.disconnect();
  }, [viewMode, visibleServices, isEmployeeView]);

  const summary = useMemo(() => {
    const activeCompanies = companies.filter(
      (company) => company.active !== false,
    ).length;
    return {
      pending: services.filter((service) => service.status === "pendente")
        .length,
      completed: services.filter((service) => service.status === "concluido")
        .length,
      overdue: services.filter((service) => service.is_overdue).length,
      activeCompanies,
    };
  }, [companies, services]);

  const servicesByDate = useMemo(() => {
    const map = new Map<string, OutsourcedService[]>();
    visibleServices.forEach((service) => {
      const date = new Date(service.due_date);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);
      const current = map.get(key) || [];
      current.push(service);
      map.set(key, current);
    });
    return map;
  }, [visibleServices]);

  const calendarWeeks = useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const weeks: Array<Array<number | null>> = [];
    let week: Array<number | null> = Array(firstDayOfMonth).fill(null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      weeks.push(week);
    }

    return weeks;
  }, [calendarYear, calendarMonth]);

  const monthLabel = useMemo(
    () =>
      new Date(calendarYear, calendarMonth).toLocaleString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [calendarMonth, calendarYear],
  );

  const goPrevMonth = () => {
    const date = new Date(calendarYear, calendarMonth - 1, 1);
    setCalendarYear(date.getFullYear());
    setCalendarMonth(date.getMonth());
  };

  const goNextMonth = () => {
    const date = new Date(calendarYear, calendarMonth + 1, 1);
    setCalendarYear(date.getFullYear());
    setCalendarMonth(date.getMonth());
  };

  const openNewCompany = () => {
    setEditingCompany(null);
    setCompanyForm(emptyCompany);
    setCompanyModal(true);
  };

  const openNewService = () => {
    const firstActiveType =
      types.find((type) => type.active !== false) || types[0] || SERVICE_FALLBACKS[0];
    setEditingService(null);
    setServiceForm({
      ...emptyService,
      service_type: serviceTypeValue(firstActiveType),
      expected_return_items: [{ productId: "", quantity: "" }],
    });
    setServiceModal(true);
  };

  const openEditService = (service: OutsourcedService) => {
    const expectedItems = service.expected_return_items?.length
      ? service.expected_return_items.map((item) => ({
          productId: itemProductId(item),
          quantity: String(item.quantity ?? ""),
        }))
      : [{ productId: "", quantity: "" }];
    const costItems = expectedItems.map((item, index) => {
      const existing = service.service_cost_items?.[index];
      const expectedQty = Number(item.quantity) || 0;
      const unitAmount =
        existing?.unitAmount != null
          ? existing.unitAmount
          : existing?.amount != null && expectedQty > 0
            ? Math.round((Number(existing.amount) / expectedQty) * 100) / 100
            : null;
      return {
        productId: item.productId,
        amount: existing?.amount != null ? String(existing.amount) : "",
        unitAmount: unitAmount != null ? String(unitAmount) : "",
      };
    });
    setEditingService(service);
    setServiceForm({
      company_id: service.company_id,
      service_type: service.service_type,
      input_quantity:
        service.input_quantity != null ? String(service.input_quantity) : "",
      fabric_paid_amount:
        service.fabric_paid_amount != null
          ? String(service.fabric_paid_amount)
          : "",
      service_cost_amount:
        service.service_cost_amount != null
          ? String(service.service_cost_amount)
          : "",
      service_cost_items: costItems,
      expected_return_items: expectedItems,
      due_date: toDateTimeLocal(service.due_date),
      started_at: toDateTimeLocal(service.started_at),
      notes: service.notes || "",
    });
    setServiceModal(true);
  };

  const resetTypeForm = () => {
    setEditingType(null);
    setTypeForm(emptyTypeForm);
  };

  const openEditType = (type: OutsourcedServiceType) => {
    setEditingType(type);
    setTypeForm({
      label: type.label || "",
      inputUnit: type.inputUnit || type.input_unit || "unidades",
      outputUnit: type.outputUnit || type.expected_return_unit || "unidades",
      inputMode: type.inputMode || "products",
      outputMode: type.outputMode || "products",
      active: type.active !== false,
    });
  };

  const saveType = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingType) {
        await updateOutsourcedServiceType(serviceTypeId(editingType), typeForm);
      } else {
        await createOutsourcedServiceType(typeForm);
      }
      const updatedTypes = await getOutsourcedServiceTypes();
      setTypes(normalizeServiceTypes(updatedTypes));
      resetTypeForm();
    } catch (err) {
      console.error("Erro ao salvar tipo de servico:", err);
      alert("Erro ao salvar tipo de servico.");
    } finally {
      setSaving(false);
    }
  };

  const removeType = async (type: OutsourcedServiceType) => {
    if (!window.confirm("Deseja excluir este tipo de servico?")) return;
    setSaving(true);
    try {
      await deleteOutsourcedServiceType(serviceTypeId(type));
      const updatedTypes = await getOutsourcedServiceTypes();
      setTypes(normalizeServiceTypes(updatedTypes));
      if (editingType && serviceTypeValue(editingType) === serviceTypeValue(type)) {
        resetTypeForm();
      }
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 409) {
        alert("Este tipo esta em uso e nao pode ser excluido.");
      } else {
        console.error("Erro ao excluir tipo de servico:", err);
        alert("Erro ao excluir tipo de servico.");
      }
    } finally {
      setSaving(false);
    }
  };

  const openEditCompany = (company: OutsourcedCompany) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name || "",
      document: company.document || "",
      contact_name: company.contact_name || "",
      phone: company.phone || "",
      email: company.email || "",
      address: company.address || "",
      notes: company.notes || "",
      active: company.active !== false,
    });
    setCompanyModal(true);
  };

  const saveCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingCompany) {
        await updateOutsourcedCompany(editingCompany.id, companyForm);
      } else {
        await createOutsourcedCompany(companyForm);
      }
      setCompanyModal(false);
      setEditingCompany(null);
      setCompanies(await getOutsourcedCompanies());
    } catch (err) {
      console.error("Erro ao salvar empresa:", err);
      alert("Erro ao salvar empresa terceirizada.");
    } finally {
      setSaving(false);
    }
  };

  const updateServiceReturnItem = (
    index: number,
    field: "productId" | "quantity",
    value: string,
  ) => {
    setServiceForm((prev) => ({
      ...prev,
      expected_return_items: prev.expected_return_items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
      service_cost_items:
        field === "productId"
          ? prev.service_cost_items.map((item, itemIndex) =>
              itemIndex === index ? { ...item, productId: value } : item,
            )
          : prev.service_cost_items,
    }));
  };

  const addServiceReturnItem = () => {
    setServiceForm((prev) => ({
      ...prev,
      expected_return_items: [
        ...prev.expected_return_items,
        { productId: "", quantity: "" },
      ],
      service_cost_items: [
        ...prev.service_cost_items,
        { productId: "", amount: "", unitAmount: "" },
      ],
    }));
  };

  const removeServiceReturnItem = (index: number) => {
    setServiceForm((prev) => ({
      ...prev,
      expected_return_items:
        prev.expected_return_items.length === 1
          ? prev.expected_return_items
          : prev.expected_return_items.filter((_, itemIndex) => itemIndex !== index),
      service_cost_items:
        prev.service_cost_items.length === 1
          ? prev.service_cost_items
          : prev.service_cost_items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateServiceCostItemUnitAmount = (index: number, unitAmount: string) => {
    setServiceForm((prev) => {
      const expectedQty = Number(prev.expected_return_items[index]?.quantity) || 0;
      const unit = Number(unitAmount);
      const computedAmount =
        unitAmount !== "" && Number.isFinite(unit)
          ? String(Math.round(unit * expectedQty * 100) / 100)
          : "";
      return {
        ...prev,
        service_cost_items: prev.service_cost_items.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, unitAmount, amount: computedAmount }
            : item,
        ),
      };
    });
  };

  const updateDeliveryItem = (
    index: number,
    field: "productId" | "quantity",
    value: string,
  ) => {
    setDeliveryForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const addDeliveryItem = () => {
    setDeliveryForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: "", quantity: "" }],
    }));
  };

  const removeDeliveryItem = (index: number) => {
    setDeliveryForm((prev) => ({
      ...prev,
      items:
        prev.items.length === 1
          ? prev.items
          : prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const parseItemRows = (items: typeof serviceForm.expected_return_items) =>
    items
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      }))
      .filter((item) => item.productId && item.quantity > 0);

  const parseCostRows = () =>
    serviceForm.service_cost_items
      .map((item, index) => ({
        productId:
          item.productId || serviceForm.expected_return_items[index]?.productId || "",
        amount: Number(item.amount),
        unitAmount: item.unitAmount !== "" ? Number(item.unitAmount) : undefined,
      }))
      .filter((item) => item.productId && item.amount >= 0);

  const saveService = async (event: React.FormEvent) => {
    event.preventDefault();
    const expectedReturnItems = parseItemRows(serviceForm.expected_return_items);
    if (
      outputRequiresProducts(serviceForm.service_type, types) &&
      expectedReturnItems.length === 0
    ) {
      alert("Informe os produtos e quantidades previstos para retorno.");
      return;
    }
    const payload: OutsourcedServicePayload | OutsourcedServiceUpdatePayload = {
      company_id: serviceForm.company_id,
      service_type: serviceForm.service_type,
      expected_return_items: expectedReturnItems,
      due_date: new Date(serviceForm.due_date).toISOString(),
      started_at: toIsoOrUndefined(serviceForm.started_at),
      notes: serviceForm.notes.trim() || undefined,
    };
    const perProductCostService = usesPerProductServiceCost(
      serviceForm.service_type,
      types,
    );
    const cuttingService = isFabricCuttingService(serviceForm.service_type, types);
    const serviceCostItems =
      perProductCostService && !isEmployeeView ? parseCostRows() : [];
    if (!cuttingService || serviceForm.input_quantity !== "") {
      payload.input_quantity = Number(serviceForm.input_quantity);
    }
    if (!isEmployeeView && serviceForm.fabric_paid_amount !== "") {
      payload.fabric_paid_amount = Number(serviceForm.fabric_paid_amount);
    }
    if (!isEmployeeView && perProductCostService) {
      if (
        serviceCostItems.length !== expectedReturnItems.length ||
        serviceCostItems.some((item) => Number.isNaN(item.amount))
      ) {
        alert("Informe o valor cobrado para cada produto.");
        return;
      }
      payload.service_cost_items = serviceCostItems;
      payload.service_cost_amount = totalCostItems(serviceCostItems);
    } else if (!isEmployeeView && serviceForm.service_cost_amount !== "") {
      payload.service_cost_amount = Number(serviceForm.service_cost_amount);
    }

    setSaving(true);
    try {
      if (editingService) {
        const updated = await updateOutsourcedService(editingService.id, payload);
        setServiceModal(false);
        setEditingService(null);
        setServiceForm({ ...emptyService });
        await loadServices(statusFilter, debouncedCompanyName, debouncedProductName);
        if (selectedService?.id === editingService.id) {
          setSelectedService(
            updated?.id ? updated : await getOutsourcedService(editingService.id),
          );
        }
      } else {
        await createOutsourcedService(payload as OutsourcedServicePayload);
        setServiceModal(false);
        setServiceForm({ ...emptyService });
        await loadServices(statusFilter, debouncedCompanyName, debouncedProductName);
      }
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 400) {
        alert((err as Error).message);
      } else {
        console.error(
          editingService ? "Erro ao atualizar servico:" : "Erro ao criar servico:",
          err,
        );
        alert(
          editingService
            ? "Erro ao atualizar servico terceirizado."
            : "Erro ao criar servico terceirizado.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const openServiceDetail = async (service: OutsourcedService) => {
    setDetailLoading(true);
    setSelectedService(service);
    try {
      setSelectedService(await getOutsourcedService(service.id));
      setDeliveryForm({
        ...emptyDelivery,
        delivered_at: toDateTimeLocal(new Date().toISOString()),
      });
      setPaymentForm({
        ...emptyPayment,
        paid_at: toDateTimeLocal(new Date().toISOString()),
      });
    } catch (err) {
      console.error("Erro ao buscar detalhe do servico:", err);
      alert("Erro ao carregar detalhe do servico.");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshSelectedService = async (id: string) => {
    const fresh = await getOutsourcedService(id);
    setSelectedService(fresh);
    await loadServices(statusFilter);
  };

  const saveDelivery = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedService) return;
    const deliveryItems = parseItemRows(deliveryForm.items);
    if (deliveryItems.length === 0) {
      alert("Informe pelo menos um produto entregue.");
      return;
    }
    const payload: OutsourcedDeliveryPayload = {
      items: deliveryItems,
      delivered_at: new Date(deliveryForm.delivered_at).toISOString(),
      observation: deliveryForm.observation.trim() || undefined,
    };
    setSaving(true);
    try {
      const { amountDue } = await addOutsourcedServiceDelivery(
        selectedService.id,
        payload,
      );
      setDeliveryForm({
        ...emptyDelivery,
        delivered_at: toDateTimeLocal(new Date().toISOString()),
      });
      // Recarrega o servico completo (com historico de entregas atualizado) em vez de
      // usar a resposta do POST diretamente, pois ela nao inclui a lista de entregas.
      await refreshSelectedService(selectedService.id);
      if (!isEmployeeView && amountDue != null) {
        alert(`Entrega registrada. Valor a pagar por esta entrega: ${money(amountDue)}`);
      }
    } catch (err) {
      console.error("Erro ao lancar entrega:", err);
      alert("Erro ao lancar entrega.");
    } finally {
      setSaving(false);
    }
  };

  const submitPayment = async (amountOverride?: number) => {
    if (!selectedService) return;
    const amount = amountOverride ?? Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      alert("Informe um valor pago maior que zero.");
      return;
    }
    const payload: OutsourcedServicePaymentPayload = {
      amount,
      paid_at: new Date(paymentForm.paid_at).toISOString(),
      observation: paymentForm.observation.trim() || undefined,
    };
    setSaving(true);
    try {
      const { payment, service } = await addOutsourcedServicePayment(
        selectedService.id,
        payload,
      );
      setPaymentForm({
        ...emptyPayment,
        paid_at: toDateTimeLocal(new Date().toISOString()),
      });
      setSelectedService((prev) =>
        prev
          ? {
              ...prev,
              ...service,
              payments: [payment, ...(prev.payments || [])],
            }
          : prev,
      );
      setServices((prev) =>
        prev.map((item) => (item.id === service.id ? { ...item, ...service } : item)),
      );
    } catch (err) {
      console.error("Erro ao lancar pagamento:", err);
      alert(
        err instanceof Error && (err as Error & { status?: number }).status === 400
          ? (err as Error).message
          : "Erro ao lancar pagamento.",
      );
    } finally {
      setSaving(false);
    }
  };

  const finalizeService = async () => {
    if (!selectedService) return;
    if (!window.confirm("Deseja finalizar este servico manualmente?")) return;

    setSaving(true);
    try {
      await finalizeOutsourcedService(selectedService.id);
      await refreshSelectedService(selectedService.id);
    } catch (err) {
      console.error("Erro ao finalizar servico:", err);
      alert("Erro ao finalizar servico.");
    } finally {
      setSaving(false);
    }
  };

  const serviceInputUnit = getInputUnit(serviceForm.service_type, types);
  const expectedReturnTotal = totalItemsQuantity(serviceForm.expected_return_items);
  const isPerProductCostForm = usesPerProductServiceCost(
    serviceForm.service_type,
    types,
  );
  const isFabricCuttingForm = isFabricCuttingService(serviceForm.service_type, types);
  const perProductCostTotal = totalCostItems(serviceForm.service_cost_items);
  const fabricCuttingPreview = isFabricCuttingForm
    ? buildFabricCuttingPreview(serviceForm.expected_return_items, products)
    : null;
  const buildStoredFabricSummary = (service: OutsourcedService) =>
    buildFabricCuttingPreview(
      (service.expected_return_items || []).map((item) => ({
        productId: itemProductId(item),
        quantity: String(item.quantity ?? ""),
      })),
      products,
    );

  const selectedServiceFabricSummary =
    selectedService && isFabricCuttingService(selectedService.service_type, types)
      ? selectedService.fabric_cutting_summary?.items?.length
        ? selectedService.fabric_cutting_summary
        : buildStoredFabricSummary(selectedService)
      : null;

  const selectedServiceExpectedProducts = selectedService?.expected_return_items
    ?.map(itemProductId)
    .filter(Boolean);
  const deliveryProducts =
    selectedServiceExpectedProducts && selectedServiceExpectedProducts.length > 0
      ? products.filter((product) =>
          selectedServiceExpectedProducts.includes(product.id),
        )
      : products;

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-purple-700">
            POIT&POIT Admin
          </p>
          <h1 className="text-3xl font-bold text-stone-900">
            Servicos Terceirizados
          </h1>
        </div>
        {!isEmployeeView && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openNewService}
              className="rounded-lg bg-purple-700 px-5 py-2 font-bold text-white shadow hover:bg-purple-800"
            >
              Novo servico
            </button>
            <button
              onClick={openNewCompany}
              className="rounded-lg bg-stone-700 px-5 py-2 font-bold text-white shadow hover:bg-stone-800"
            >
              Nova empresa
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Servicos pendentes"
          value={summary.pending}
          color="border-amber-500"
        />
        <StatCard
          label="Servicos concluidos"
          value={summary.completed}
          color="border-emerald-500"
        />
        <StatCard
          label="Servicos atrasados"
          value={summary.overdue}
          color="border-red-500"
        />
        <StatCard
          label="Empresas ativas"
          value={summary.activeCompanies}
          color="border-purple-500"
        />
      </div>

      <div className="mb-5 flex gap-2 border-b border-stone-200">
        <button
          onClick={() => setActiveTab("services")}
          className={`px-4 py-3 text-sm font-bold ${
            activeTab === "services"
              ? "border-b-2 border-purple-700 text-purple-700"
              : "text-stone-500"
          }`}
        >
          Servicos
        </button>
        <button
          onClick={() => setActiveTab("companies")}
          className={`px-4 py-3 text-sm font-bold ${
            activeTab === "companies"
              ? "border-b-2 border-purple-700 text-purple-700"
              : "text-stone-500"
          }`}
        >
          Empresas terceirizadas
        </button>
        {!isEmployeeView && (
          <button
            onClick={() => setActiveTab("types")}
            className={`px-4 py-3 text-sm font-bold ${
              activeTab === "types"
                ? "border-b-2 border-purple-700 text-purple-700"
                : "text-stone-500"
            }`}
          >
            Tipos de servico
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg bg-white p-8 text-center text-stone-500 shadow">
          Carregando...
        </div>
      ) : activeTab === "services" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
              <label className="flex flex-col gap-1 text-sm font-semibold text-stone-600">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as
                        | "all"
                        | "pendente"
                        | "concluido"
                        | "overdue",
                    )
                  }
                  className="rounded-lg border border-stone-300 px-3 py-2"
                >
                  <option value="all">Todos</option>
                  <option value="pendente">Pendentes</option>
                  <option value="concluido">Concluidos</option>
                  <option value="overdue">Atrasados</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-stone-600">
                Empresa terceirizada
                <select
                  value={companyFilter}
                  onChange={(event) => setCompanyFilter(event.target.value)}
                  className="min-w-[260px] rounded-lg border border-stone-300 px-3 py-2"
                >
                  <option value="all">Todas</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-stone-600">
                Buscar por nome da empresa
                <input
                  type="text"
                  value={companyNameSearch}
                  onChange={(event) => setCompanyNameSearch(event.target.value)}
                  placeholder="Ex: Confeccoes"
                  className="min-w-[220px] rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-stone-600">
                Buscar por produto previsto
                <input
                  type="text"
                  value={productNameSearch}
                  onChange={(event) => setProductNameSearch(event.target.value)}
                  placeholder="Ex: Camiseta"
                  className="min-w-[220px] rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-stone-600">
                Prazo de
                <input
                  type="date"
                  value={dueFrom}
                  onChange={(event) => setDueFrom(event.target.value)}
                  className="w-full min-w-0 max-w-[160px] rounded-lg border border-stone-300 px-2 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-stone-600">
                Prazo ate
                <input
                  type="date"
                  value={dueTo}
                  onChange={(event) => setDueTo(event.target.value)}
                  className="w-full min-w-0 max-w-[160px] rounded-lg border border-stone-300 px-2 py-2 text-sm"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${
                  viewMode === "table"
                    ? "bg-purple-700 text-white"
                    : "bg-stone-100 text-stone-700"
                }`}
              >
                Tabela
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${
                  viewMode === "calendar"
                    ? "bg-purple-700 text-white"
                    : "bg-stone-100 text-stone-700"
                }`}
              >
                Calendário
              </button>
            </div>
          </div>

          {!isEmployeeView && companyFilter !== "all" && (
            <div className="flex flex-col gap-4 rounded-lg border border-purple-200 bg-purple-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                    Em aberto no periodo
                  </p>
                  <p className="text-2xl font-black text-red-700">
                    {money(companyPaymentSummary.openTotal)}
                  </p>
                  <p className="text-xs text-stone-500">
                    {companyPaymentSummary.openCount} servico(s)
                  </p>
                </div>
                {companyPaymentSummary.partialCount > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                      Pago parcialmente
                    </p>
                    <p className="text-2xl font-black text-amber-600">
                      {money(companyPaymentSummary.partialTotal)}
                    </p>
                    <p className="text-xs text-stone-500">
                      {companyPaymentSummary.partialCount} servico(s)
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                    Ja pago no periodo
                  </p>
                  <p className="text-2xl font-black text-emerald-700">
                    {money(companyPaymentSummary.paidTotal)}
                  </p>
                  <p className="text-xs text-stone-500">
                    {companyPaymentSummary.paidCount} servico(s)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleMarkCompanyPaid}
                disabled={
                  markingCompanyPaid ||
                  loadingCompanyPayment ||
                  companyPaymentSummary.openCount === 0
                }
                className="w-full rounded-lg bg-emerald-700 px-5 py-3 text-center font-bold text-white shadow hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:whitespace-nowrap"
              >
                {markingCompanyPaid
                  ? "Marcando..."
                  : companyPaymentSummary.openCount === 0
                    ? "Nada em aberto"
                    : `Marcar todos como pago (${money(companyPaymentSummary.openTotal)})`}
              </button>
            </div>
          )}

          {viewMode === "calendar" ? (
            <div className="space-y-4 rounded-lg bg-white shadow">
              <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-700">Calendário</p>
                  <p className="text-xs text-stone-500">
                    Mostrando serviços com prazo no mês selecionado.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goPrevMonth}
                    className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-200"
                  >
                    Anterior
                  </button>
                  <div className="rounded-lg bg-stone-50 px-3 py-2 text-sm font-bold text-stone-900">
                    {monthLabel}
                  </div>
                  <button
                    type="button"
                    onClick={goNextMonth}
                    className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-200"
                  >
                    Próximo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-px bg-stone-200 px-0 text-center text-[11px] uppercase text-stone-500">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((weekDay) => (
                  <div
                    key={weekDay}
                    className="bg-stone-50 px-2 py-2 font-bold"
                  >
                    {weekDay}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-stone-200 p-0">
                {calendarWeeks.flat().map((day, index) => {
                  const dayKey = day
                    ? `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    : "";
                  const dayServices = day ? servicesByDate.get(dayKey) || [] : [];

                  return (
                    <div
                      key={`${calendarYear}-${calendarMonth}-${index}`}
                      className={`min-h-[140px] overflow-hidden bg-white p-3 text-[12px] ${
                        day ? "" : "bg-stone-100"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className={`font-bold ${dayServices.length ? 'text-purple-700' : 'text-stone-500'}`}>
                          {day || ""}
                        </span>
                        {dayServices.length > 0 && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                            {dayServices.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {dayServices.slice(0, 3).map((service) => (
                          <button
                            type="button"
                            key={service.id}
                            onClick={() => openServiceDetail(service)}
                            className="w-full rounded-lg border border-stone-200 bg-stone-50 p-2 text-left transition hover:border-purple-300 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-600"
                          >
                            <p className="truncate font-semibold text-stone-900">
                              {service.company_name}
                            </p>
                            <p className="truncate text-[11px] text-stone-600">
                              {getTypeLabel(service.service_type, types, service.service_type_label)}
                            </p>
                          </button>
                        ))}
                        {dayServices.length > 3 && (
                          <p className="text-[11px] text-stone-500">
                            +{dayServices.length - 3} outros
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
            <div
              ref={servicesTableTopScrollRef}
              onScroll={handleServicesTopScroll}
              className="overflow-x-auto overflow-y-hidden"
            >
              <div style={{ width: servicesTableScrollWidth, height: 1 }} />
            </div>
            <div
              ref={servicesTableScrollRef}
              onScroll={handleServicesTableScroll}
              className="overflow-x-auto rounded-lg bg-white shadow"
            >
            <table className="min-w-[1180px] w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50">
                <tr>
                  {[
                    "Empresa",
                    "Servico",
                    "Status",
                    "Prazo",
                    "Retirada",
                    "Retorno previsto",
                    "Entregue",
                    "Faltante",
                    !isEmployeeView ? "Valor tecido" : null,
                    !isEmployeeView ? "Custo servico" : null,
                    "Progresso",
                    "Observacoes",
                  ].map((header) =>
                    header ? (
                      <th
                        key={header}
                        className="px-4 py-3 text-left text-xs font-bold uppercase text-stone-500"
                      >
                        {header}
                      </th>
                    ) : null,
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibleServices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isEmployeeView ? 10 : 12}
                      className="px-4 py-8 text-center text-stone-500"
                    >
                      Nenhum servico encontrado.
                    </td>
                  </tr>
                ) : (
                  visibleServices.map((service) => (
                    <tr
                      key={service.id}
                      onClick={() => openServiceDetail(service)}
                      className="cursor-pointer hover:bg-purple-50/60"
                    >
                      <td className="px-4 py-3 font-semibold text-stone-900">
                        {service.company_name}
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {getTypeLabel(
                          service.service_type,
                          types,
                          service.service_type_label,
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                        className={statusClasses(service)}
                        >
                          {service.is_overdue
                            ? "Atrasado"
                            : service.status === "concluido"
                              ? "Concluido"
                              : "Pendente"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatDate(service.due_date)}</td>
                      <td className="px-4 py-3">
                        {service.input_quantity}{" "}
                        {service.input_unit || getInputUnit(service.service_type, types)}
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <span className="block font-bold">
                          {Number(service.expected_return_quantity) ||
                            totalItemsQuantity(service.expected_return_items)}{" "}
                          unidades
                        </span>
                        <span className="block truncate text-xs text-stone-500">
                          {formatProductItems(service.expected_return_items, products)}
                        </span>
                        {isFabricCuttingService(service.service_type, types) && (
                          <FabricCuttingTotalsInline
                            summary={
                              service.fabric_cutting_summary?.items?.length
                                ? service.fabric_cutting_summary
                                : buildStoredFabricSummary(service)
                            }
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {service.total_delivered_quantity}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {service.remaining_quantity}
                      </td>
                      {!isEmployeeView && (
                        <>
                          <td className="px-4 py-3">
                            {money(service.fabric_paid_amount)}
                          </td>
                          <td className="px-4 py-3">
                            {money(service.service_cost_amount)}
                            {service.service_cost_amount != null && (
                              <span
                                className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                  service.paid
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {service.paid ? "Pago" : "Em aberto"}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <ProgressBar service={service} />
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-stone-500">
                        {service.notes || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </>
          )}
        </section>
      ) : activeTab === "companies" ? (
        <section className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-[900px] w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                {[
                  "Empresa",
                  "Documento",
                  "Contato",
                  "Telefone",
                  "Email",
                  "Status",
                  !isEmployeeView ? "Acoes" : null,
                ].map((header) =>
                  header ? (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-bold uppercase text-stone-500"
                    >
                      {header}
                    </th>
                  ) : null,
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {companies.map((company) => (
                <tr key={company.id}>
                  <td className="px-4 py-3 font-bold text-stone-900">
                    {company.name}
                    {company.notes && (
                      <p className="text-xs font-normal text-stone-500">
                        {company.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">{company.document || "-"}</td>
                  <td className="px-4 py-3">{company.contact_name || "-"}</td>
                  <td className="px-4 py-3">{company.phone || "-"}</td>
                  <td className="px-4 py-3">{company.email || "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`outsourced-status-pill ${
                        company.active === false
                          ? "is-inactive"
                          : "is-complete"
                      }`}
                    >
                      {company.active === false ? "Inativa" : "Ativa"}
                    </span>
                  </td>
                  {!isEmployeeView && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEditCompany(company)}
                        className="font-bold text-purple-700 hover:text-purple-900"
                      >
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="space-y-4">
          <form
            onSubmit={saveType}
            className="grid gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto_auto]"
          >
            <FormInput
              label="Nome do tipo"
              required
              value={typeForm.label}
              onChange={(value) =>
                setTypeForm((prev) => ({ ...prev, label: value }))
              }
            />
            <FormInput
              label="Unidade retirada"
              required
              value={typeForm.inputUnit}
              onChange={(value) =>
                setTypeForm((prev) => ({ ...prev, inputUnit: value }))
              }
            />
            <FormInput
              label="Unidade retorno"
              required
              value={typeForm.outputUnit}
              onChange={(value) =>
                setTypeForm((prev) => ({ ...prev, outputUnit: value }))
              }
            />
            <ModeSelect
              label="Modo retirada"
              value={typeForm.inputMode}
              onChange={(value) =>
                setTypeForm((prev) => ({ ...prev, inputMode: value }))
              }
            />
            <ModeSelect
              label="Modo retorno"
              value={typeForm.outputMode}
              onChange={(value) =>
                setTypeForm((prev) => ({ ...prev, outputMode: value }))
              }
            />
            <label className="flex items-center gap-2 self-end rounded-lg bg-stone-50 px-3 py-2 text-sm font-bold text-stone-700">
              <input
                type="checkbox"
                checked={typeForm.active}
                onChange={(event) =>
                  setTypeForm((prev) => ({
                    ...prev,
                    active: event.target.checked,
                  }))
                }
              />
              Ativo
            </label>
            <div className="flex gap-2 self-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-60"
              >
                {editingType ? "Atualizar" : "Criar"}
              </button>
              {editingType && (
                <button
                  type="button"
                  onClick={resetTypeForm}
                  className="rounded-lg bg-stone-200 px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-300"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="overflow-x-auto rounded-lg bg-white shadow">
            <table className="min-w-[920px] w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50">
                <tr>
                  {[
                    "Tipo",
                    "Retirada",
                    "Retorno",
                    "Modo retirada",
                    "Modo retorno",
                    "Status",
                    "Acoes",
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-bold uppercase text-stone-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {types.map((type) => (
                  <tr key={serviceTypeValue(type)}>
                    <td className="px-4 py-3 font-bold text-stone-900">
                      {type.label}
                      {type.builtIn && (
                        <span className="ml-2 rounded-full bg-stone-100 px-2 py-1 text-xs font-bold text-stone-600">
                          Padrao
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{type.inputUnit || "-"}</td>
                    <td className="px-4 py-3">{type.outputUnit || "-"}</td>
                    <td className="px-4 py-3">{type.inputMode}</td>
                    <td className="px-4 py-3">{type.outputMode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`outsourced-status-pill ${
                          type.active === false ? "is-inactive" : "is-complete"
                        }`}
                      >
                        {type.active === false ? "Inativo" : "Ativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEditType(type)}
                        className="mr-3 font-bold text-purple-700 hover:text-purple-900"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeType(type)}
                        className="font-bold text-red-700 hover:text-red-900"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {companyModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="mt-8 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-2xl font-bold text-stone-900">
              {editingCompany ? "Editar empresa" : "Cadastrar empresa"}
            </h2>
            <form onSubmit={saveCompany} className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Nome"
                required
                value={companyForm.name}
                onChange={(value) =>
                  setCompanyForm((prev) => ({ ...prev, name: value }))
                }
              />
              <FormInput
                label="Documento"
                value={companyForm.document || ""}
                onChange={(value) =>
                  setCompanyForm((prev) => ({ ...prev, document: value }))
                }
              />
              <FormInput
                label="Contato"
                value={companyForm.contact_name || ""}
                onChange={(value) =>
                  setCompanyForm((prev) => ({ ...prev, contact_name: value }))
                }
              />
              <FormInput
                label="Telefone"
                value={companyForm.phone || ""}
                onChange={(value) =>
                  setCompanyForm((prev) => ({ ...prev, phone: value }))
                }
              />
              <FormInput
                label="Email"
                type="email"
                value={companyForm.email || ""}
                onChange={(value) =>
                  setCompanyForm((prev) => ({ ...prev, email: value }))
                }
              />
              <FormInput
                label="Endereco"
                value={companyForm.address || ""}
                onChange={(value) =>
                  setCompanyForm((prev) => ({ ...prev, address: value }))
                }
              />
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-stone-600">
                  Observacoes
                </span>
                <textarea
                  value={companyForm.notes || ""}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  className="min-h-24 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 font-semibold text-stone-700">
                <input
                  type="checkbox"
                  checked={companyForm.active}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({
                      ...prev,
                      active: event.target.checked,
                    }))
                  }
                />
                Empresa ativa
              </label>
              <ModalActions
                saving={saving}
                onCancel={() => setCompanyModal(false)}
              />
            </form>
          </div>
        </div>
      )}

      {serviceModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="mt-8 w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-2xl font-bold text-stone-900">
              {editingService
                ? "Editar servico terceirizado"
                : "Novo servico terceirizado"}
            </h2>
            <form onSubmit={saveService} className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-semibold text-stone-600">
                  Empresa
                </span>
                <select
                  required
                  value={serviceForm.company_id}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      company_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {companies
                    .filter((company) => company.active !== false)
                    .map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold text-stone-600">
                  Tipo de servico
                </span>
                <select
                  required
                  value={serviceForm.service_type}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      service_type: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                >
                  {types
                    .filter((type) => type.active !== false)
                    .map((type) => (
                      <option key={serviceTypeValue(type)} value={serviceTypeValue(type)}>
                        {type.label}
                      </option>
                    ))}
                </select>
              </label>
              <FormInput
                label={
                  isFabricCuttingForm
                    ? `Quantidade retirada (${serviceInputUnit}) - opcional`
                    : `Quantidade retirada (${serviceInputUnit})`
                }
                type="number"
                min="0.01"
                step="0.01"
                required={!isFabricCuttingForm}
                value={serviceForm.input_quantity}
                onChange={(value) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    input_quantity: value,
                  }))
                }
              />
              {!isEmployeeView && (
                <>
                  <FormInput
                    label="Valor pago pelo tecido"
                    type="number"
                    min="0"
                    step="0.01"
                    value={serviceForm.fabric_paid_amount}
                    onChange={(value) =>
                      setServiceForm((prev) => ({
                        ...prev,
                        fabric_paid_amount: value,
                      }))
                    }
                  />
                  <FormInput
                    label="Valor cobrado pelo terceirizado pelo servico"
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={isPerProductCostForm}
                    value={
                      isPerProductCostForm
                        ? perProductCostTotal.toFixed(2)
                        : serviceForm.service_cost_amount
                    }
                    onChange={(value) =>
                      setServiceForm((prev) => ({
                        ...prev,
                        service_cost_amount: value,
                      }))
                    }
                  />
                </>
              )}
              <div className="space-y-3 rounded-lg border border-stone-200 p-4 sm:col-span-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase text-stone-700">
                      Retorno previsto
                    </h3>
                    <p className="text-xs text-stone-500">
                      Total calculado: {expectedReturnTotal} unidades
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addServiceReturnItem}
                    className="rounded-lg bg-purple-100 px-3 py-2 text-sm font-bold text-purple-800 hover:bg-purple-200"
                  >
                    Adicionar produto
                  </button>
                </div>
                {serviceForm.expected_return_items.map((item, index) => (
                  <ProductQuantityRow
                    key={`expected-${index}`}
                    item={item}
                    products={products}
                    onChange={(field, value) =>
                      updateServiceReturnItem(index, field, value)
                    }
                    onRemove={() => removeServiceReturnItem(index)}
                    canRemove={serviceForm.expected_return_items.length > 1}
                  />
                ))}
              </div>
              {isFabricCuttingForm && (
                <div className="sm:col-span-2">
                  <FabricCuttingSummaryBox summary={fabricCuttingPreview} />
                </div>
              )}
              {!isEmployeeView && isPerProductCostForm && (
                <div className="space-y-3 rounded-lg border border-stone-200 p-4 sm:col-span-2">
                  <div>
                    <h3 className="text-sm font-bold uppercase text-stone-700">
                      Valor do servico por produto
                    </h3>
                    <p className="text-xs text-stone-500">
                      Total cobrado pelo terceirizado: {money(perProductCostTotal)}
                    </p>
                  </div>
                  {serviceForm.expected_return_items.map((item, index) => {
                    const expectedQty = Number(item.quantity) || 0;
                    const rowAmount = Number(
                      serviceForm.service_cost_items[index]?.amount || 0,
                    );
                    return (
                      <div
                        key={`cost-${index}`}
                        className="grid gap-3 rounded-lg bg-white p-3 shadow-sm sm:grid-cols-[1fr_160px_140px]"
                      >
                        <div>
                          <span className="mb-1 block text-sm font-semibold text-stone-600">
                            Produto
                          </span>
                          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                            {item.productId
                              ? productName(item.productId, products)
                              : "Selecione o produto no retorno previsto"}
                          </div>
                        </div>
                        <FormInput
                          label="Valor por unidade"
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={serviceForm.service_cost_items[index]?.unitAmount || ""}
                          onChange={(value) =>
                            updateServiceCostItemUnitAmount(index, value)
                          }
                        />
                        <div>
                          <span className="mb-1 block text-sm font-semibold text-stone-600">
                            Subtotal ({expectedQty || 0} un.)
                          </span>
                          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-bold text-stone-700">
                            {money(rowAmount)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <FormInput
                label="Prazo"
                type="datetime-local"
                required
                value={serviceForm.due_date}
                onChange={(value) =>
                  setServiceForm((prev) => ({ ...prev, due_date: value }))
                }
              />
              <FormInput
                label="Inicio"
                type="datetime-local"
                value={serviceForm.started_at}
                onChange={(value) =>
                  setServiceForm((prev) => ({ ...prev, started_at: value }))
                }
              />
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-stone-600">
                  Observacoes
                </span>
                <textarea
                  value={serviceForm.notes}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  className="min-h-24 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>
              <ModalActions
                saving={saving}
                onCancel={() => {
                  setServiceModal(false);
                  setEditingService(null);
                }}
              />
            </form>
          </div>
        </div>
      )}

      {selectedService && !serviceModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="mt-8 w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">
                  {selectedService.company_name}
                </h2>
                <p className="font-semibold text-purple-700">
                  {getTypeLabel(
                    selectedService.service_type,
                    types,
                    selectedService.service_type_label,
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                {!isEmployeeView && (
                  <button
                    onClick={() => openEditService(selectedService)}
                    className="rounded-lg bg-purple-100 px-4 py-2 font-bold text-purple-800 hover:bg-purple-200"
                  >
                    Editar
                  </button>
                )}
                <button
                  onClick={() => setSelectedService(null)}
                  className="rounded-lg bg-stone-100 px-4 py-2 font-bold text-stone-700 hover:bg-stone-200"
                >
                  Fechar
                </button>
              </div>
            </div>

            {detailLoading ? (
              <p className="py-8 text-center text-stone-500">Carregando...</p>
            ) : (
              <>
                <div className="mb-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-stone-50 p-4">
                    <p className="text-xs font-bold uppercase text-stone-500">
                      Prazo
                    </p>
                    <p className="font-bold">{formatDate(selectedService.due_date)}</p>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-4">
                    <p className="text-xs font-bold uppercase text-stone-500">
                      Status
                    </p>
                    <span
                      className={statusClasses(selectedService)}
                    >
                      {selectedService.is_overdue
                        ? "Atrasado"
                        : selectedService.status === "concluido"
                          ? "Concluido"
                          : "Pendente"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-4">
                    <p className="text-xs font-bold uppercase text-stone-500">
                      Progresso
                    </p>
                    <ProgressBar service={selectedService} />
                  </div>
                </div>

                <div className="mb-6 grid gap-4 rounded-lg border border-stone-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="Retirada" value={`${selectedService.input_quantity} ${selectedService.input_unit || getInputUnit(selectedService.service_type, types)}`} />
                  <Info label="Itens retirados" value={formatProductItems(selectedService.input_items, products)} />
                  <Info label="Retorno previsto" value={`${Number(selectedService.expected_return_quantity) || totalItemsQuantity(selectedService.expected_return_items)} unidades`} />
                  <Info label="Itens previstos" value={formatProductItems(selectedService.expected_return_items, products)} />
                  <Info label="Ja entregue" value={String(selectedService.total_delivered_quantity)} />
                  <Info label="Faltante" value={String(selectedService.remaining_quantity)} />
                  {!isEmployeeView && (
                    <>
                      <Info label="Valor tecido" value={money(selectedService.fabric_paid_amount)} />
                      <Info label="Custo servico" value={money(selectedService.service_cost_amount)} />
                      <Info label="Pago" value={money(selectedService.paid_amount)} />
                      <Info
                        label="Falta pagar"
                        value={
                          selectedService.remaining_amount == null
                            ? "-"
                            : money(selectedService.remaining_amount)
                        }
                      />
                      {usesPerProductServiceCost(selectedService.service_type, types) && (
                        <Info
                          label="Custo por produto"
                          value={formatCostItems(
                            selectedService.service_cost_items,
                            products,
                          )}
                        />
                      )}
                    </>
                  )}
                  <Info label="Inicio" value={formatDate(selectedService.started_at)} />
                  <Info label="Observacoes" value={selectedService.notes || "-"} />
                </div>

                {isFabricCuttingService(selectedService.service_type, types) && (
                  <div className="mb-6">
                    <FabricCuttingSummaryBox summary={selectedServiceFabricSummary} />
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="mb-3 text-lg font-bold text-stone-900">
                    Historico de entregas
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-stone-200">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="bg-stone-50">
                        <tr>
                          <th className="px-4 py-3 text-left">Data</th>
                          <th className="px-4 py-3 text-left">Produtos</th>
                          <th className="px-4 py-3 text-left">Total</th>
                          {!isEmployeeView && (
                            <th className="px-4 py-3 text-left">Valor a pagar</th>
                          )}
                          <th className="px-4 py-3 text-left">Observacao</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {(selectedService.deliveries || []).length === 0 ? (
                          <tr>
                            <td
                              colSpan={isEmployeeView ? 4 : 5}
                              className="px-4 py-5 text-center text-stone-500"
                            >
                              Nenhuma entrega lancada.
                            </td>
                          </tr>
                        ) : (
                          selectedService.deliveries?.map((delivery) => (
                            <tr key={delivery.id}>
                              <td className="px-4 py-3">
                                {formatDate(delivery.delivered_at)}
                              </td>
                              <td className="px-4 py-3">
                                {formatProductItems(delivery.items, products)}
                              </td>
                              <td className="px-4 py-3 font-bold">
                                {delivery.quantity ||
                                  totalItemsQuantity(delivery.items)}
                              </td>
                              {!isEmployeeView && (
                                <td className="px-4 py-3 font-bold text-purple-800">
                                  {delivery.amount_due != null
                                    ? money(delivery.amount_due)
                                    : "-"}
                                </td>
                              )}
                              <td className="px-4 py-3">
                                {delivery.observation || "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <form
                  onSubmit={saveDelivery}
                  className="grid gap-4 rounded-lg bg-purple-50 p-4 sm:grid-cols-3"
                >
                  <div className="space-y-3 sm:col-span-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-bold uppercase text-purple-900">
                          Produtos retornados
                        </h3>
                        <p className="text-xs text-purple-800">
                          Total: {totalItemsQuantity(deliveryForm.items)} unidades
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addDeliveryItem}
                        className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-purple-800 hover:bg-purple-100"
                      >
                        Adicionar produto
                      </button>
                    </div>
                    {deliveryForm.items.map((item, index) => (
                      <ProductQuantityRow
                        key={`delivery-${index}`}
                        item={item}
                        products={deliveryProducts}
                        onChange={(field, value) =>
                          updateDeliveryItem(index, field, value)
                        }
                        onRemove={() => removeDeliveryItem(index)}
                        canRemove={deliveryForm.items.length > 1}
                      />
                    ))}
                  </div>
                  <FormInput
                    label="Data da entrega"
                    type="datetime-local"
                    required
                    value={deliveryForm.delivered_at}
                    onChange={(value) =>
                      setDeliveryForm((prev) => ({
                        ...prev,
                        delivered_at: value,
                      }))
                    }
                  />
                  <FormInput
                    label="Observacao"
                    value={deliveryForm.observation}
                    onChange={(value) =>
                      setDeliveryForm((prev) => ({
                        ...prev,
                        observation: value,
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-2 sm:col-span-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-purple-700 px-5 py-2 font-bold text-white hover:bg-purple-800 disabled:opacity-60"
                    >
                      Lancar entrega
                    </button>
                    {selectedService.status !== "concluido" && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={finalizeService}
                        className="rounded-lg bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Finalizar servico
                      </button>
                    )}
                  </div>
                </form>

                {!isEmployeeView && selectedService.service_cost_amount != null && (
                  <div className="mt-6">
                    <h3 className="mb-3 text-lg font-bold text-stone-900">
                      Historico de pagamentos
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-stone-200">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead className="bg-stone-50">
                          <tr>
                            <th className="px-4 py-3 text-left">Data</th>
                            <th className="px-4 py-3 text-left">Valor</th>
                            <th className="px-4 py-3 text-left">Observacao</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {(selectedService.payments || []).length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-5 text-center text-stone-500"
                              >
                                Nenhum pagamento lancado.
                              </td>
                            </tr>
                          ) : (
                            selectedService.payments?.map((payment) => (
                              <tr key={payment.id}>
                                <td className="px-4 py-3">
                                  {formatDate(payment.paid_at)}
                                </td>
                                <td className="px-4 py-3 font-bold">
                                  {money(payment.amount)}
                                </td>
                                <td className="px-4 py-3">
                                  {payment.observation || "-"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {(selectedService.remaining_amount ?? 0) > 0 && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitPayment();
                        }}
                        className="mt-4 grid gap-4 rounded-lg bg-emerald-50 p-4 sm:grid-cols-3"
                      >
                        <FormInput
                          label="Valor pago"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={paymentForm.amount}
                          onChange={(value) =>
                            setPaymentForm((prev) => ({ ...prev, amount: value }))
                          }
                        />
                        <FormInput
                          label="Data do pagamento"
                          type="datetime-local"
                          required
                          value={paymentForm.paid_at}
                          onChange={(value) =>
                            setPaymentForm((prev) => ({ ...prev, paid_at: value }))
                          }
                        />
                        <FormInput
                          label="Observacao"
                          value={paymentForm.observation}
                          onChange={(value) =>
                            setPaymentForm((prev) => ({ ...prev, observation: value }))
                          }
                        />
                        <div className="flex flex-wrap gap-2 sm:col-span-3">
                          <button
                            type="submit"
                            disabled={saving}
                            className="rounded-lg bg-emerald-700 px-5 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                          >
                            Registrar pagamento parcial
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              submitPayment(selectedService.remaining_amount || 0)
                            }
                            className="rounded-lg bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Pagar tudo ({money(selectedService.remaining_amount)})
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FormInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, type = "text", required, min, step, disabled }) => (
  <label>
    <span className="mb-1 block text-sm font-semibold text-stone-600">
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      min={min}
      step={step}
      disabled={disabled}
      className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-purple-600 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
    />
  </label>
);

const ModeSelect: React.FC<{
  label: string;
  value: "products" | "measure";
  onChange: (value: "products" | "measure") => void;
}> = ({ label, value, onChange }) => (
  <label>
    <span className="mb-1 block text-sm font-semibold text-stone-600">
      {label}
    </span>
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value as "products" | "measure")
      }
      className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-purple-600 focus:outline-none"
    >
      <option value="products">Produtos</option>
      <option value="measure">Medida</option>
    </select>
  </label>
);

const ProductQuantityRow: React.FC<{
  item: { productId: string; quantity: string };
  products: OutsourcedProduct[];
  onChange: (field: "productId" | "quantity", value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}> = ({ item, products, onChange, onRemove, canRemove }) => {
  const selectedProduct = products.find((product) => product.id === item.productId);
  const image = productImage(selectedProduct);

  return (
    <div className="grid gap-3 rounded-lg bg-white p-3 shadow-sm sm:grid-cols-[1fr_140px_auto] sm:items-end">
      <label>
        <span className="mb-1 block text-sm font-semibold text-stone-600">
          Produto
        </span>
        <select
          required
          value={item.productId}
          onChange={(event) => onChange("productId", event.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-purple-600 focus:outline-none"
        >
          <option value="">Selecione</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} - {product.category || "Sem categoria"} - estoque{" "}
              {product.stock ?? 0}
            </option>
          ))}
        </select>
        {selectedProduct && (
          <div className="mt-2 flex items-center gap-3 rounded-lg bg-stone-50 p-2">
            {image ? (
              <img
                src={image}
                alt={selectedProduct.name}
                className="h-12 w-12 rounded object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-stone-200 text-xs font-bold text-stone-500">
                Sem imagem
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-stone-800">
                {selectedProduct.name}
              </p>
              <p className="text-xs text-stone-500">
                {selectedProduct.category || "Sem categoria"} - estoque atual:{" "}
                {selectedProduct.stock ?? 0}
              </p>
            </div>
          </div>
        )}
      </label>
      <FormInput
        label="Quantidade"
        type="number"
        min="0.01"
        step="0.01"
        required
        value={item.quantity}
        onChange={(value) => onChange("quantity", value)}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="rounded-lg bg-stone-200 px-3 py-2 font-bold text-stone-700 hover:bg-stone-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Remover
      </button>
    </div>
  );
};

const ModalActions: React.FC<{ saving: boolean; onCancel: () => void }> = ({
  saving,
  onCancel,
}) => (
  <div className="flex justify-end gap-2 sm:col-span-2">
    <button
      type="button"
      onClick={onCancel}
      className="rounded-lg bg-stone-200 px-5 py-2 font-bold text-stone-700 hover:bg-stone-300"
    >
      Cancelar
    </button>
    <button
      type="submit"
      disabled={saving}
      className="rounded-lg bg-purple-700 px-5 py-2 font-bold text-white hover:bg-purple-800 disabled:opacity-60"
    >
      {saving ? "Salvando..." : "Salvar"}
    </button>
  </div>
);

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-bold uppercase text-stone-500">{label}</p>
    <p className="font-semibold text-stone-800">{value}</p>
  </div>
);

export default AdminOutsourcedServicesPage;
