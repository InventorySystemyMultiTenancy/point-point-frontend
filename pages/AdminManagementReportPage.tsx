import React, { useCallback, useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "../services/apiService";

interface ManagementSummary {
  ecommerceGrossRevenue: number;
  outsourcedMaterialRevenue: number;
  grossRevenue: number;
  outsourcedServiceCosts: number;
  registeredExpenses: number;
  netProfit: number;
}

interface ManagementReportResponse {
  success?: boolean;
  summary: Partial<ManagementSummary> & Record<string, unknown>;
  generatedAt?: string;
}

interface ManagementExpense {
  id: string | number;
  description: string;
  amount: number;
  category?: string | null;
  expense_date: string;
  notes?: string | null;
}

interface ExpenseFormState {
  description: string;
  amount: string;
  category: string;
  expense_date: string;
  notes: string;
}

type Tab = "finance" | "expenses";
type FilterMode = "general" | "custom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const emptyExpenseForm: ExpenseFormState = {
  description: "",
  amount: "",
  category: "",
  expense_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

const money = (value?: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const toIsoBoundary = (date: string, type: "start" | "end") => {
  const time = type === "start" ? "T00:00:00.000" : "T23:59:59.999";
  return new Date(`${date}${time}`).toISOString();
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
};

const unwrapExpenses = (data: unknown): ManagementExpense[] => {
  if (Array.isArray(data)) return data as ManagementExpense[];
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.expenses)) return record.expenses as ManagementExpense[];
  if (Array.isArray(record.data)) return record.data as ManagementExpense[];
  return [];
};

const AdminManagementReportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("finance");
  const [report, setReport] = useState<ManagementReportResponse | null>(null);
  const [expenses, setExpenses] = useState<ManagementExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("general");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingExpense, setEditingExpense] = useState<ManagementExpense | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(emptyExpenseForm);

  const queryString = useMemo(() => {
    if (filterMode !== "custom" || !startDate || !endDate) return "";
    const params = new URLSearchParams({
      startAt: toIsoBoundary(startDate, "start"),
      endAt: toIsoBoundary(endDate, "end"),
    });
    return `?${params.toString()}`;
  }, [endDate, filterMode, startDate]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/admin/management-report${queryString}`,
      );
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Erro ao carregar relatorio de gestao");
      }
      setReport(await response.json());
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const fetchExpenses = useCallback(async () => {
    setError("");
    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/admin/management-expenses${queryString}`,
      );
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Erro ao carregar gastos");
      }
      setExpenses(unwrapExpenses(await response.json()));
    } catch (err) {
      setExpenses([]);
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  }, [queryString]);

  useEffect(() => {
    fetchReport();
    fetchExpenses();
  }, [fetchExpenses, fetchReport]);

  const summary: ManagementSummary = {
    ecommerceGrossRevenue: Number(report?.summary.ecommerceGrossRevenue) || 0,
    outsourcedMaterialRevenue: Number(report?.summary.outsourcedMaterialRevenue) || 0,
    grossRevenue: Number(report?.summary.grossRevenue) || 0,
    outsourcedServiceCosts: Number(report?.summary.outsourcedServiceCosts) || 0,
    registeredExpenses: Number(report?.summary.registeredExpenses) || 0,
    netProfit: Number(report?.summary.netProfit) || 0,
  };

  const applyFilter = () => {
    if (filterMode === "custom" && (!startDate || !endDate)) {
      setError("Selecione data inicial e final.");
      return;
    }
    fetchReport();
    fetchExpenses();
  };

  const resetFilter = () => {
    setFilterMode("general");
    setStartDate("");
    setEndDate("");
  };

  const openExpenseForm = (expense?: ManagementExpense) => {
    setEditingExpense(expense || null);
    setExpenseForm(
      expense
        ? {
            description: expense.description || "",
            amount: String(expense.amount || ""),
            category: expense.category || "",
            expense_date: expense.expense_date
              ? new Date(expense.expense_date).toISOString().slice(0, 10)
              : emptyExpenseForm.expense_date,
            notes: expense.notes || "",
          }
        : emptyExpenseForm,
    );
  };

  const closeExpenseForm = () => {
    setEditingExpense(null);
    setExpenseForm(emptyExpenseForm);
  };

  const saveExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount);
    if (!expenseForm.description.trim() || !expenseForm.expense_date || amount <= 0) {
      setError("Preencha descricao, data e valor maior que zero.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        description: expenseForm.description.trim(),
        amount,
        category: expenseForm.category.trim() || undefined,
        expense_date: new Date(`${expenseForm.expense_date}T12:00:00.000`).toISOString(),
        notes: expenseForm.notes.trim() || undefined,
      };
      const url = editingExpense
        ? `${API_BASE}/api/admin/management-expenses/${editingExpense.id}`
        : `${API_BASE}/api/admin/management-expenses`;
      const response = await authenticatedFetch(url, {
        method: editingExpense ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Erro ao salvar gasto");
      }
      closeExpenseForm();
      await fetchExpenses();
      await fetchReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (expense: ManagementExpense) => {
    if (!window.confirm(`Excluir gasto "${expense.description}"?`)) return;
    setSaving(true);
    setError("");
    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/admin/management-expenses/${expense.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Erro ao excluir gasto");
      }
      await fetchExpenses();
      await fetchReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Relatorio de Gestao
          </h1>
          <p className="text-slate-600 mt-2">
            Financeiro POIT&POIT: faturamento, custos, gastos e lucro liquido.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchReport();
            fetchExpenses();
          }}
          disabled={loading}
          className="bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-purple-800 disabled:opacity-60"
        >
          {loading ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("finance")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === "finance" ? "bg-purple-700 text-white" : "bg-stone-100 text-stone-700"
            }`}
          >
            Financeiro
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === "expenses" ? "bg-purple-700 text-white" : "bg-stone-100 text-stone-700"
            }`}
          >
            Gastos
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[auto_1fr_1fr_auto_auto] md:items-end">
          <label className="flex items-center gap-2 font-semibold text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filterMode === "custom"}
              onChange={(event) => setFilterMode(event.target.checked ? "custom" : "general")}
            />
            Filtrar datas
          </label>
          <label className="text-sm font-semibold text-slate-700">
            De
            <input
              type="date"
              value={startDate}
              disabled={filterMode !== "custom"}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Ate
            <input
              type="date"
              value={endDate}
              disabled={filterMode !== "custom"}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={applyFilter}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={resetFilter}
            className="rounded-lg bg-stone-200 px-4 py-2 font-bold text-stone-700 hover:bg-stone-300"
          >
            Limpar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {activeTab === "finance" && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FinanceCard label="Faturamento ecommerce" value={summary.ecommerceGrossRevenue} color="border-purple-500" />
            <FinanceCard label="Receita materiais terceirizados" value={summary.outsourcedMaterialRevenue} color="border-amber-500" />
            <FinanceCard label="Faturamento bruto total" value={summary.grossRevenue} color="border-emerald-500" />
            <FinanceCard label="Custos servicos terceirizados" value={summary.outsourcedServiceCosts} color="border-red-500" />
            <FinanceCard label="Gastos cadastrados" value={summary.registeredExpenses} color="border-stone-500" />
            <FinanceCard label="Lucro liquido" value={summary.netProfit} color={summary.netProfit >= 0 ? "border-green-500" : "border-red-600"} highlight />
          </div>

          <div className="rounded-xl bg-white p-6 shadow border-l-4 border-green-500">
            <h2 className="text-2xl font-bold text-slate-900">Lucro liquido</h2>
            <p className="mt-2 text-slate-600">
              Lucro liquido = faturamento bruto total - gastos - custos dos terceirizados.
            </p>
            <p className="mt-4 text-4xl font-bold text-green-700">
              {money(summary.netProfit)}
            </p>
          </div>
        </section>
      )}

      {activeTab === "expenses" && (
        <section className="space-y-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openExpenseForm()}
              className="rounded-lg bg-purple-700 px-5 py-2 font-bold text-white hover:bg-purple-800"
            >
              Novo gasto
            </button>
          </div>

          {(editingExpense || expenseForm.description || expenseForm.amount) && (
            <form onSubmit={saveExpense} className="grid gap-4 rounded-xl bg-white p-5 shadow md:grid-cols-2">
              <FormInput label="Descricao" required value={expenseForm.description} onChange={(value) => setExpenseForm((prev) => ({ ...prev, description: value }))} />
              <FormInput label="Valor" type="number" min="0.01" step="0.01" required value={expenseForm.amount} onChange={(value) => setExpenseForm((prev) => ({ ...prev, amount: value }))} />
              <FormInput label="Categoria" value={expenseForm.category} onChange={(value) => setExpenseForm((prev) => ({ ...prev, category: value }))} />
              <FormInput label="Data do gasto" type="date" required value={expenseForm.expense_date} onChange={(value) => setExpenseForm((prev) => ({ ...prev, expense_date: value }))} />
              <label className="md:col-span-2 text-sm font-semibold text-slate-700">
                Observacoes
                <textarea
                  value={expenseForm.notes}
                  onChange={(event) => setExpenseForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={closeExpenseForm} className="rounded-lg bg-stone-200 px-5 py-2 font-bold text-stone-700">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-purple-700 px-5 py-2 font-bold text-white disabled:opacity-60">Salvar</button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl bg-white shadow">
            <table className="min-w-[780px] w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-3 text-left">Descricao</th>
                  <th className="p-3 text-left">Categoria</th>
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-left">Observacoes</th>
                  <th className="p-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum gasto cadastrado.</td></tr>
                ) : expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="p-3 font-semibold text-slate-900">{expense.description}</td>
                    <td className="p-3 text-slate-600">{expense.category || "-"}</td>
                    <td className="p-3 text-slate-600">{formatDate(expense.expense_date)}</td>
                    <td className="p-3 text-right font-bold text-red-700">{money(expense.amount)}</td>
                    <td className="p-3 text-slate-600">{expense.notes || "-"}</td>
                    <td className="p-3 text-right space-x-3">
                      <button onClick={() => openExpenseForm(expense)} className="font-bold text-purple-700">Editar</button>
                      <button onClick={() => deleteExpense(expense)} className="font-bold text-red-600">Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

const FinanceCard: React.FC<{ label: string; value: number; color: string; highlight?: boolean }> = ({ label, value, color, highlight }) => (
  <div className={`rounded-xl bg-white p-5 shadow border-l-4 ${color}`}>
    <p className="text-sm font-semibold text-slate-500">{label}</p>
    <p className={`mt-2 font-bold ${highlight ? "text-4xl text-green-700" : "text-3xl text-slate-900"}`}>
      {money(value)}
    </p>
  </div>
);

const FormInput: React.FC<{ label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; step?: string }> = ({ label, value, onChange, type = "text", required, min, step }) => (
  <label className="text-sm font-semibold text-slate-700">
    {label}
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      min={min}
      step={step}
      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
    />
  </label>
);

export default AdminManagementReportPage;
