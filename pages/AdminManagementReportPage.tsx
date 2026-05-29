import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { authenticatedFetch } from "../services/apiService";

interface ManagementReportSummary {
  totalOrders: number;
  totalOrderAttempts: number;
  successfulOrders: number;
  canceledOrders: number;
  pendingOrders: number;
  totalItemsSold: number;
  totalRevenue: number;
  averageTicket: number;
  successRate: number;
  cancellationRate: number;
  pendingRate: number;
  totalToPayGiraKids: number;
  totalPaidToGiraKids: number;
  totalGiraKidsAccrued: number;
}

interface ProductManagementReport {
  productId: string;
  name: string;
  category?: string;
  stock?: number | null;
  minStock?: number;
  quantitySold: number;
  revenue: number;
  giraKidsValue: number;
}

interface ProductVolumeAnalyticsItem {
  productId: string;
  name: string;
  category: string;
  quantitySold: number;
  revenue: number;
}

interface AbcAnalyticsItem {
  productId: string;
  name: string;
  category: string;
  quantitySold: number;
  revenue: number;
  revenueShare: number;
  cumulativeShare: number;
  classification: "A" | "B" | "C";
}

interface CategoryPerformanceItem {
  category: string;
  quantitySold: number;
  revenue: number;
  revenueShare: number;
}

interface StockAlertItem {
  productId: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  safetyStock: number;
  quantitySold: number;
  revenue: number;
  averageDailySales: number;
  daysToStockout: number | null;
  suggestedPurchase: number;
  severity: "critical" | "warning";
}

interface ManagementReportResponse {
  success: boolean;
  summary: ManagementReportSummary;
  products: ProductManagementReport[];
  charts: {
    revenueEvolution: {
      daily: Array<{ label: string; revenue: number; orders: number }>;
      weekly: Array<{ label: string; revenue: number; orders: number }>;
      monthly: Array<{ label: string; revenue: number; orders: number }>;
    };
    paymentDistribution: Array<{
      method: string;
      name: string;
      value: number;
      orders: number;
      revenue: number;
    }>;
  };
  analytics: {
    periodDays: number;
    topProductsByVolume: ProductVolumeAnalyticsItem[];
    abcCurve: AbcAnalyticsItem[];
    categoryPerformance: CategoryPerformanceItem[];
    stockAlerts: StockAlertItem[];
  };
  filters?: {
    startAt: string | null;
    endAt: string | null;
  };
  generatedAt: string;
}

type FilterMode = "general" | "custom";
type FilterPreset = "today" | "last7days" | "currentMonth";
type RevenueGranularity = "daily" | "weekly" | "monthly";

interface AppliedFilter {
  mode: FilterMode;
  startDate: string;
  endDate: string;
  label: string;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const integerFormatter = new Intl.NumberFormat("pt-BR");
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const CHART_COLORS = ["#10b981", "#2563eb", "#f59e0b", "#ef4444"];
const ABC_CLASS_COLORS = {
  A: "#ef4444",
  B: "#f59e0b",
  C: "#2563eb",
};

const formatCurrency = (value: number) =>
  currencyFormatter.format(Number.isFinite(value) ? value : 0);

const formatInteger = (value: number) =>
  integerFormatter.format(Number.isFinite(value) ? value : 0);

const formatPercent = (value: number) => `${percentFormatter.format(value)}%`;

const formatAxisCurrency = (value: number) => {
  if (!Number.isFinite(value)) return "R$ 0";
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${Math.round(value)}`;
};

const truncateLabel = (value: string, maxLength = 24) => {
  if (!value) return "-";
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
};

const createGeneralFilter = (): AppliedFilter => ({
  mode: "general",
  startDate: "",
  endDate: "",
  label: "Data geral",
});

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toIsoBoundary = (date: string, type: "start" | "end") => {
  const time = type === "start" ? "T00:00:00.000" : "T23:59:59.999";
  return new Date(`${date}${time}`).toISOString();
};

const formatFilterDate = (date: string) => {
  if (!date) return "";
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
};

const buildCustomFilterLabel = (startDate: string, endDate: string) =>
  `${formatFilterDate(startDate)} ate ${formatFilterDate(endDate)}`;

const createPresetFilter = (preset: FilterPreset): AppliedFilter => {
  const today = new Date();
  const endDate = formatDateInput(today);

  if (preset === "today") {
    return {
      mode: "custom",
      startDate: endDate,
      endDate,
      label: "Hoje",
    };
  }

  if (preset === "last7days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);

    return {
      mode: "custom",
      startDate: formatDateInput(start),
      endDate,
      label: "Ultimos 7 dias",
    };
  }

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    mode: "custom",
    startDate: formatDateInput(firstDayOfMonth),
    endDate,
    label: "Mes atual",
  };
};

const AdminManagementReportPage: React.FC = () => {
  const [report, setReport] = useState<ManagementReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("general");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [revenueGranularity, setRevenueGranularity] =
    useState<RevenueGranularity>("daily");
  const [appliedFilter, setAppliedFilter] =
    useState<AppliedFilter>(createGeneralFilter);

  // Proteção por senha extra
  const [senhaExtra, setSenhaExtra] = useState("");
  const [senhaCorreta, setSenhaCorreta] = useState(false);
  const [senhaErro, setSenhaErro] = useState("");

  // Troque pela senha real depois
  const SENHA_ESPECIAL = "135";

  const fetchReport = useCallback(async (filter: AppliedFilter) => {
    setLoading(true);
    setError("");

    try {
      if (filter.mode === "custom") {
        if (!filter.startDate || !filter.endDate) {
          setError("Selecione a data inicial e final para filtrar.");
          setLoading(false);
          return;
        }

        if (filter.startDate > filter.endDate) {
          setError("A data inicial nao pode ser maior que a data final.");
          setLoading(false);
          return;
        }
      }

      const url = new URL(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/admin/management-report`,
      );

      if (filter.mode === "custom") {
        url.searchParams.set(
          "startAt",
          toIsoBoundary(filter.startDate, "start"),
        );
        url.searchParams.set("endAt", toIsoBoundary(filter.endDate, "end"));
      }

      const response = await authenticatedFetch(url.toString());

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Erro ao carregar relatorio de gestao");
      }

      const data: ManagementReportResponse = await response.json();
      setReport(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(appliedFilter);
  }, [appliedFilter, fetchReport]);

  const products = useMemo(() => report?.products || [], [report]);
  const revenueData = useMemo(
    () => report?.charts.revenueEvolution[revenueGranularity] || [],
    [report, revenueGranularity],
  );
  const paymentDistributionData = useMemo(
    () => report?.charts.paymentDistribution || [],
    [report],
  );
  const topProductsByVolumeData = useMemo(
    () => report?.analytics.topProductsByVolume || [],
    [report],
  );
  const abcCurveData = useMemo(
    () => report?.analytics.abcCurve || [],
    [report],
  );
  const categoryPerformanceData = useMemo(
    () => report?.analytics.categoryPerformance || [],
    [report],
  );
  const stockAlertsData = useMemo(
    () => report?.analytics.stockAlerts || [],
    [report],
  );
  const activeFilterLabel = useMemo(() => {
    return appliedFilter.label;
  }, [appliedFilter]);

  const handleApplyFilter = () => {
    if (filterMode === "general") {
      setAppliedFilter(createGeneralFilter());
      return;
    }

    setAppliedFilter({
      mode: "custom",
      startDate,
      endDate,
      label: buildCustomFilterLabel(startDate, endDate),
    });
  };

  const handleSetGeneralFilter = () => {
    setFilterMode("general");
    setStartDate("");
    setEndDate("");
    setAppliedFilter(createGeneralFilter());
  };

  const handleApplyPreset = (preset: FilterPreset) => {
    const presetFilter = createPresetFilter(preset);
    setFilterMode("custom");
    setStartDate(presetFilter.startDate);
    setEndDate(presetFilter.endDate);
    setAppliedFilter(presetFilter);
  };

  const handleRefresh = () => {
    fetchReport(appliedFilter);
  };

  // Formulário de senha extra
  if (!senhaCorreta) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 bg-white rounded-xl shadow flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-4 text-slate-900">
          Acesso Restrito
        </h2>
        <p className="mb-4 text-slate-700 text-center">
          Digite a senha especial para acessar o Relatório de Gestão.
        </p>
        <input
          type="password"
          className="border border-slate-300 rounded-lg px-4 py-2 mb-2 w-full text-lg"
          placeholder="Senha especial"
          value={senhaExtra}
          onChange={(e) => setSenhaExtra(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (senhaExtra === SENHA_ESPECIAL) {
                setSenhaCorreta(true);
                setSenhaErro("");
              } else {
                setSenhaErro("Senha incorreta");
              }
            }
          }}
        />
        <button
          className="bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-800 mt-2"
          onClick={() => {
            if (senhaExtra === SENHA_ESPECIAL) {
              setSenhaCorreta(true);
              setSenhaErro("");
            } else {
              setSenhaErro("Senha incorreta");
            }
          }}
        >
          Entrar
        </button>
        {senhaErro && <p className="text-red-600 mt-2">{senhaErro}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Relatorio de Gestao
          </h1>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-emerald-800"
              onClick={() => {
                // Gera um PDF/tabela estilizada para impressão
                const produtos = report?.products || [];
                const html = `
                  <html>
                  <head>
                    <title>Estoque e Sugestão de Compra</title>
                    <style>
                      body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 24px; }
                      h2 { color: #10b981; margin-bottom: 24px; }
                      table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 2px 8px #0001; border-radius: 12px; overflow: hidden; }
                      th, td { padding: 12px 16px; text-align: left; }
                      th { background: #10b981; color: #fff; font-size: 16px; }
                      tr:nth-child(even) { background: #f0fdf4; }
                      tr:nth-child(odd) { background: #fff; }
                      td { font-size: 15px; color: #334155; }
                      .estoque-baixo { color: #ef4444; font-weight: bold; }
                      .sugestao { color: #2563eb; font-weight: bold; }
                    </style>
                  </head>
                  <body>
                    <h2>Estoque e Sugestão de Compra</h2>
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Estoque</th>
                          <th>Sugerido</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${produtos
                          .map(
                            (p) => `
                          <tr>
                            <td>${p.name}</td>
                            <td class="${p.stock !== undefined && p.stock !== null && p.stock <= (p.minStock ?? 0) ? "estoque-baixo" : ""}">${p.stock ?? "N/A"}</td>
                            <td class="sugestao">${p.minStock ?? "N/A"}</td>
                          </tr>
                        `,
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </body>
                  </html>
                `;
                const printWindow = window.open("", "_blank");
                printWindow?.document.write(html);
                printWindow?.document.close();
                printWindow?.print();
              }}
            >
              Imprimir Estoque/Sugestão
            </button>
          </div>
          <p className="text-slate-600 mt-2">
            Visao financeira para admin com base na logica de repasse GiraKids
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 md:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Periodo</p>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 gap-1">
              <button
                type="button"
                onClick={handleSetGeneralFilter}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filterMode === "general"
                    ? "bg-blue-700 text-white"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Data geral
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("custom")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filterMode === "custom"
                    ? "bg-blue-700 text-white"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Filtrar
              </button>
            </div>
          </div>

          <div className="text-sm text-slate-500">
            Periodo ativo:{" "}
            <span className="font-semibold text-slate-800">
              {activeFilterLabel}
            </span>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">
            Atalhos rapidos
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleApplyPreset("today")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                appliedFilter.label === "Hoje"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("last7days")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                appliedFilter.label === "Ultimos 7 dias"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Ultimos 7 dias
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("currentMonth")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                appliedFilter.label === "Mes atual"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Mes atual
            </button>
          </div>
        </div>

        {filterMode === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                De
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                max={endDate || undefined}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ate
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                min={startDate || undefined}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-600"
              />
            </div>

            <button
              type="button"
              onClick={handleApplyFilter}
              disabled={loading || !startDate || !endDate}
              className="bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Aplicar filtro
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {loading && !report && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-slate-600">
          Carregando relatorio...
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow border-l-4 border-emerald-600 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Faturamento Bruto
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-2">
                {formatCurrency(report.summary.totalRevenue)}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Total vendido no periodo
              </p>
            </div>

            <div className="bg-white rounded-xl shadow border-l-4 border-blue-600 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Ticket Medio
              </p>
              <p className="text-2xl font-bold text-blue-700 mt-2">
                {formatCurrency(report.summary.averageTicket)}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Media por pedido pago
              </p>
            </div>

            <div className="bg-white rounded-xl shadow border-l-4 border-violet-600 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Sucesso de Pagamentos
              </p>
              <p className="text-2xl font-bold text-violet-700 mt-2">
                {formatPercent(report.summary.successRate)}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {formatInteger(report.summary.successfulOrders)} de{" "}
                {formatInteger(report.summary.totalOrderAttempts)} pedidos
              </p>
            </div>

            <div className="bg-white rounded-xl shadow border-l-4 border-rose-500 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Cancelados e Pendentes
              </p>
              <p className="text-2xl font-bold text-rose-600 mt-2">
                {formatPercent(
                  report.summary.cancellationRate + report.summary.pendingRate,
                )}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Cancelados: {formatPercent(report.summary.cancellationRate)} |
                Pendentes: {formatPercent(report.summary.pendingRate)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow border-l-4 border-blue-600 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Quantidade de vendas
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatInteger(report.summary.totalOrders)}
              </p>
              <p className="text-sm text-slate-500 mt-1">Pedidos pagos</p>
            </div>

            <div className="bg-white rounded-xl shadow border-l-4 border-indigo-500 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Itens vendidos
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatInteger(report.summary.totalItemsSold)}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Soma de unidades de produtos
              </p>
            </div>

            <div className="bg-white rounded-xl shadow border-l-4 border-amber-500 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Falta pagar GiraKids
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-2">
                {formatCurrency(report.summary.totalToPayGiraKids)}
              </p>
              <p className="text-sm text-slate-500 mt-1">Pendencia atual</p>
            </div>

            <div className="bg-white rounded-xl shadow border-l-4 border-green-600 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Ja pago para GiraKids
              </p>
              <p className="text-2xl font-bold text-green-700 mt-2">
                {formatCurrency(report.summary.totalPaidToGiraKids)}
              </p>
              <p className="text-sm text-slate-500 mt-1">Historico acumulado</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white rounded-xl shadow p-4 md:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                    Evolucao do Faturamento
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Acompanhe os picos de venda no periodo selecionado
                  </p>
                </div>

                <div className="inline-flex rounded-lg bg-slate-100 p-1 gap-1">
                  {[
                    { value: "daily", label: "Diario" },
                    { value: "weekly", label: "Semanal" },
                    { value: "monthly", label: "Mensal" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setRevenueGranularity(
                          option.value as RevenueGranularity,
                        )
                      }
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        revenueGranularity === option.value
                          ? "bg-blue-700 text-white"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {revenueData.length === 0 ? (
                <div className="h-[320px] flex items-center justify-center text-slate-500 bg-slate-50 rounded-lg">
                  Nao ha faturamento no periodo para exibir no grafico.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient
                        id="revenueFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#2563eb"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="#2563eb"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" stroke="#64748b" />
                    <YAxis
                      stroke="#64748b"
                      tickFormatter={(value) =>
                        formatAxisCurrency(Number(value))
                      }
                    />
                    <Tooltip
                      formatter={(value: number, name: string, item: any) => {
                        if (name === "revenue") {
                          return [formatCurrency(value), "Faturamento"];
                        }

                        return [value, item?.payload?.orders || 0];
                      }}
                      labelFormatter={(label) => `Periodo: ${label}`}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Legend formatter={() => "Faturamento"} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={3}
                      fill="url(#revenueFill)"
                      dot={{ r: 3, fill: "#2563eb" }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-xl shadow p-4 md:p-6">
              <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                  Distribuicao de Pagamentos
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Metodos com maior conversao no periodo
                </p>
              </div>

              {paymentDistributionData.length === 0 ? (
                <div className="h-[320px] flex items-center justify-center text-slate-500 bg-slate-50 rounded-lg">
                  Nenhum pagamento aprovado para distribuir.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={paymentDistributionData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={68}
                        outerRadius={105}
                        paddingAngle={3}
                      >
                        {paymentDistributionData.map((entry, index) => (
                          <Cell
                            key={`${entry.method}-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(
                          value: number,
                          _name: string,
                          item: any,
                        ) => [
                          `${formatInteger(value)} pedidos`,
                          `${item?.payload?.name} · ${formatCurrency(
                            item?.payload?.revenue || 0,
                          )}`,
                        ]}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-3 mt-4">
                    {paymentDistributionData.map((item, index) => (
                      <div
                        key={item.method}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                CHART_COLORS[index % CHART_COLORS.length],
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatInteger(item.orders)} pedidos
                            </p>
                          </div>
                        </div>

                        <p className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                          {formatCurrency(item.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white rounded-xl shadow p-4 md:p-6">
              <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                  Top Produtos Mais Vendidos
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Ranking dos itens com maior volume de saida no periodo
                </p>
              </div>

              {topProductsByVolumeData.length === 0 ? (
                <div className="h-[320px] flex items-center justify-center text-slate-500 bg-slate-50 rounded-lg">
                  Sem vendas suficientes para montar o ranking.
                </div>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(300, topProductsByVolumeData.length * 38)}
                >
                  <BarChart
                    data={topProductsByVolumeData}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 28, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={190}
                      stroke="#64748b"
                      tickFormatter={(value) =>
                        truncateLabel(String(value), 28)
                      }
                    />
                    <Tooltip
                      formatter={(
                        value: number,
                        _name: string,
                        payload: any,
                      ) => [
                        `${formatInteger(value)} unidades`,
                        `${payload?.payload?.name} · ${formatCurrency(
                          payload?.payload?.revenue || 0,
                        )}`,
                      ]}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Bar
                      dataKey="quantitySold"
                      fill="#2563eb"
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-xl shadow p-4 md:p-6">
              <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                  Desempenho por Categoria
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Categorias que mais geram receita
                </p>
              </div>

              {categoryPerformanceData.length === 0 ? (
                <div className="h-[320px] flex items-center justify-center text-slate-500 bg-slate-50 rounded-lg">
                  Nenhuma categoria com faturamento no periodo.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={categoryPerformanceData}
                        dataKey="revenue"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={66}
                        outerRadius={104}
                        paddingAngle={2}
                      >
                        {categoryPerformanceData.map((entry, index) => (
                          <Cell
                            key={`${entry.category}-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(
                          value: number,
                          _name: string,
                          item: any,
                        ) => [
                          formatCurrency(value),
                          `${item?.payload?.category} · ${formatPercent(
                            item?.payload?.revenueShare || 0,
                          )}`,
                        ]}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-3 mt-4">
                    {categoryPerformanceData.map((category, index) => (
                      <div
                        key={category.category}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                CHART_COLORS[index % CHART_COLORS.length],
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {category.category}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatPercent(category.revenueShare)} do
                              faturamento
                            </p>
                          </div>
                        </div>

                        <p className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                          {formatCurrency(category.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                  Curva ABC de Produtos (Pareto)
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Classe A concentra ate 80% da receita, B ate 95% e C os demais
                </p>
              </div>
              <div className="text-sm text-slate-500">
                Produtos analisados: {formatInteger(abcCurveData.length)}
              </div>
            </div>

            {abcCurveData.length === 0 ? (
              <div className="h-[320px] flex items-center justify-center text-slate-500 bg-slate-50 rounded-lg">
                Nenhum dado de faturamento para Curva ABC.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart
                    data={abcCurveData}
                    margin={{ top: 8, right: 28, left: 8, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      angle={-24}
                      textAnchor="end"
                      height={82}
                      interval={0}
                      tickFormatter={(value) =>
                        truncateLabel(String(value), 14)
                      }
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#64748b"
                      tickFormatter={(value) =>
                        formatAxisCurrency(Number(value))
                      }
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      stroke="#64748b"
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "revenue") {
                          return [formatCurrency(value), "Faturamento"];
                        }
                        return [formatPercent(value), "Acumulado"];
                      }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "revenue" ? "Faturamento" : "% Acumulado"
                      }
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="revenue"
                      fill="#2563eb"
                      radius={[6, 6, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulativeShare"
                      stroke="#ef4444"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto mt-5">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="text-left p-3 font-semibold">#</th>
                        <th className="text-left p-3 font-semibold">Produto</th>
                        <th className="text-left p-3 font-semibold">
                          Categoria
                        </th>
                        <th className="text-right p-3 font-semibold">Qtd.</th>
                        <th className="text-right p-3 font-semibold">
                          Faturamento
                        </th>
                        <th className="text-right p-3 font-semibold">
                          % Receita
                        </th>
                        <th className="text-right p-3 font-semibold">
                          % Acumulado
                        </th>
                        <th className="text-center p-3 font-semibold">
                          Classe
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {abcCurveData.map((item, index) => (
                        <tr
                          key={item.productId}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="p-3 text-slate-500">{index + 1}</td>
                          <td className="p-3 font-medium text-slate-800">
                            {item.name}
                          </td>
                          <td className="p-3 text-slate-600">
                            {item.category}
                          </td>
                          <td className="p-3 text-right text-slate-700">
                            {formatInteger(item.quantitySold)}
                          </td>
                          <td className="p-3 text-right font-semibold text-slate-800">
                            {formatCurrency(item.revenue)}
                          </td>
                          <td className="p-3 text-right text-slate-700">
                            {formatPercent(item.revenueShare)}
                          </td>
                          <td className="p-3 text-right text-slate-700">
                            {formatPercent(item.cumulativeShare)}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className="inline-flex items-center justify-center min-w-[32px] h-7 px-3 rounded-full text-xs font-bold text-white"
                              style={{
                                backgroundColor:
                                  ABC_CLASS_COLORS[item.classification],
                              }}
                            >
                              {item.classification}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-4 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                  Painel de Alerta de Estoque
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Produtos em risco considerando estoque minimo e velocidade
                  media de saida
                </p>
              </div>
              <div className="text-sm text-slate-500">
                Base de calculo: {formatInteger(report.analytics.periodDays)}{" "}
                dias
              </div>
            </div>

            {stockAlertsData.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-800">
                Nenhum produto em risco de ruptura no periodo selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="text-left p-3 font-semibold">Produto</th>
                      <th className="text-left p-3 font-semibold">Categoria</th>
                      <th className="text-right p-3 font-semibold">Estoque</th>
                      <th className="text-right p-3 font-semibold">Minimo</th>
                      <th className="text-right p-3 font-semibold">
                        Seguranca
                      </th>
                      <th className="text-right p-3 font-semibold">
                        Venda media/dia
                      </th>
                      <th className="text-right p-3 font-semibold">
                        Dias p/ ruptura
                      </th>
                      <th className="text-right p-3 font-semibold">
                        Sugestao compra
                      </th>
                      <th className="text-center p-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockAlertsData.map((item) => (
                      <tr
                        key={item.productId}
                        className={`border-b border-slate-100 ${
                          item.severity === "critical"
                            ? "bg-red-50/70"
                            : "bg-amber-50/70"
                        }`}
                      >
                        <td className="p-3 font-medium text-slate-800">
                          {item.name}
                        </td>
                        <td className="p-3 text-slate-600">{item.category}</td>
                        <td className="p-3 text-right font-semibold text-slate-800">
                          {formatInteger(item.stock)}
                        </td>
                        <td className="p-3 text-right text-slate-700">
                          {formatInteger(item.minStock)}
                        </td>
                        <td className="p-3 text-right text-slate-700">
                          {formatInteger(item.safetyStock)}
                        </td>
                        <td className="p-3 text-right text-slate-700">
                          {item.averageDailySales.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-slate-700">
                          {item.daysToStockout === null
                            ? "Sem ruptura"
                            : `${item.daysToStockout.toFixed(1)} dias`}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-800">
                          {formatInteger(item.suggestedPurchase)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center h-7 px-3 rounded-full text-xs font-semibold ${
                              item.severity === "critical"
                                ? "bg-red-600 text-white"
                                : "bg-amber-500 text-white"
                            }`}
                          >
                            {item.severity === "critical"
                              ? "Critico"
                              : "Atencao"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                Quanto saiu de cada produto
              </h2>
              <div className="text-sm text-slate-500">
                Total geral GiraKids:{" "}
                <span className="font-semibold text-slate-700">
                  {formatCurrency(report.summary.totalGiraKidsAccrued)}
                </span>
              </div>
            </div>

            {products.length === 0 ? (
              <p className="text-slate-500">
                Nenhum produto vendido ate o momento.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="text-left p-3 font-semibold">#</th>
                      <th className="text-left p-3 font-semibold">Produto</th>
                      <th className="text-right p-3 font-semibold">
                        Qtd. vendida
                      </th>
                      <th className="text-right p-3 font-semibold">
                        Faturamento
                      </th>
                      <th className="text-right p-3 font-semibold">
                        Valor GiraKids
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product, index) => (
                      <tr
                        key={`${product.productId}-${index}`}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="p-3 text-slate-500">{index + 1}</td>
                        <td className="p-3 font-medium text-slate-800">
                          {product.name}
                        </td>
                        <td className="p-3 text-right text-slate-700">
                          {formatInteger(product.quantitySold)}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-800">
                          {formatCurrency(product.revenue)}
                        </td>
                        <td className="p-3 text-right font-semibold text-amber-700">
                          {formatCurrency(product.giraKidsValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 text-right">
            Atualizado em {new Date(report.generatedAt).toLocaleString("pt-BR")}
          </p>
        </>
      )}
    </div>
  );
};

export default AdminManagementReportPage;
