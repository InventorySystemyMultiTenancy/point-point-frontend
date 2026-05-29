import React, { useEffect, useMemo, useState } from "react";
import {
  addOutsourcedServiceDelivery,
  createOutsourcedCompany,
  createOutsourcedService,
  finalizeOutsourcedService,
  getOutsourcedCompanies,
  getOutsourcedService,
  getOutsourcedServices,
  getOutsourcedServiceTypes,
  type OutsourcedCompany,
  type OutsourcedCompanyPayload,
  type OutsourcedDeliveryPayload,
  type OutsourcedService,
  type OutsourcedServicePayload,
  type OutsourcedServiceType,
  updateOutsourcedCompany,
} from "../services/outsourcedServices";

const SERVICE_FALLBACKS: Required<OutsourcedServiceType>[] = [
  {
    id: "fabric_cutting",
    key: "fabric_cutting",
    value: "fabric_cutting",
    label: "Retirada de tecido para corte",
    input_unit: "tecido",
    expected_return_unit: "pecas_cortadas",
  },
  {
    id: "embroidery_sewing",
    key: "embroidery_sewing",
    value: "embroidery_sewing",
    label: "Bordagem e costura",
    input_unit: "tecido",
    expected_return_unit: "peles_costuradas",
  },
  {
    id: "stuffing_closing",
    key: "stuffing_closing",
    value: "stuffing_closing",
    label: "Enchimento e fechamento",
    input_unit: "peles",
    expected_return_unit: "pelucias_prontas",
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
  expected_return_quantity: "",
  due_date: "",
  started_at: "",
  notes: "",
};

const emptyDelivery = {
  quantity: "",
  delivered_at: "",
  observation: "",
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
  if (service.is_overdue) return "bg-red-100 text-red-700 border-red-200";
  if (service.status === "concluido")
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
};

const ProgressBar: React.FC<{ service: OutsourcedService }> = ({ service }) => {
  const expected = Number(service.expected_return_quantity) || 0;
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

const SummaryCard: React.FC<{
  label: string;
  value: number;
  color: string;
}> = ({ label, value, color }) => (
  <div className={`rounded-lg bg-white p-5 shadow border-l-4 ${color}`}>
    <p className="text-sm font-medium text-stone-500">{label}</p>
    <p className="mt-2 text-3xl font-bold text-stone-900">{value}</p>
  </div>
);

const AdminOutsourcedServicesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"services" | "companies">(
    "services",
  );
  const [companies, setCompanies] = useState<OutsourcedCompany[]>([]);
  const [services, setServices] = useState<OutsourcedService[]>([]);
  const [types, setTypes] = useState<OutsourcedServiceType[]>(SERVICE_FALLBACKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pendente" | "concluido" | "overdue"
  >("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [companyModal, setCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] =
    useState<OutsourcedCompany | null>(null);
  const [companyForm, setCompanyForm] =
    useState<OutsourcedCompanyPayload>(emptyCompany);
  const [serviceModal, setServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({ ...emptyService });
  const [selectedService, setSelectedService] =
    useState<OutsourcedService | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({ ...emptyDelivery });

  const loadPageData = async () => {
    setError("");
    setLoading(true);
    try {
      const [companyList, typeList] = await Promise.all([
        getOutsourcedCompanies(),
        getOutsourcedServiceTypes().catch(() => SERVICE_FALLBACKS),
      ]);
      setCompanies(companyList);
      setTypes(typeList.length > 0 ? typeList : SERVICE_FALLBACKS);
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
  ) => {
    const nextServices = await getOutsourcedServices(
      filter === "overdue"
        ? { overdue: true }
        : filter === "all"
          ? undefined
          : { status: filter },
    );
    setServices(nextServices);
  };

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    loadServices(statusFilter).catch((err) => {
      console.error("Erro ao filtrar servicos:", err);
      setError("Nao foi possivel aplicar o filtro.");
    });
  }, [statusFilter]);

  const visibleServices = useMemo(
    () =>
      companyFilter === "all"
        ? services
        : services.filter((service) => service.company_id === companyFilter),
    [companyFilter, services],
  );

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

  const openNewCompany = () => {
    setEditingCompany(null);
    setCompanyForm(emptyCompany);
    setCompanyModal(true);
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

  const saveService = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload: OutsourcedServicePayload = {
      company_id: serviceForm.company_id,
      service_type: serviceForm.service_type,
      input_quantity: Number(serviceForm.input_quantity),
      expected_return_quantity: Number(serviceForm.expected_return_quantity),
      due_date: new Date(serviceForm.due_date).toISOString(),
      started_at: toIsoOrUndefined(serviceForm.started_at),
      notes: serviceForm.notes.trim() || undefined,
    };
    if (serviceForm.fabric_paid_amount !== "") {
      payload.fabric_paid_amount = Number(serviceForm.fabric_paid_amount);
    }

    setSaving(true);
    try {
      await createOutsourcedService(payload);
      setServiceModal(false);
      setServiceForm({ ...emptyService });
      await loadServices(statusFilter);
    } catch (err) {
      console.error("Erro ao criar servico:", err);
      alert("Erro ao criar servico terceirizado.");
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
    const payload: OutsourcedDeliveryPayload = {
      quantity: Number(deliveryForm.quantity),
      delivered_at: new Date(deliveryForm.delivered_at).toISOString(),
      observation: deliveryForm.observation.trim() || undefined,
    };
    setSaving(true);
    try {
      await addOutsourcedServiceDelivery(selectedService.id, payload);
      setDeliveryForm({
        ...emptyDelivery,
        delivered_at: toDateTimeLocal(new Date().toISOString()),
      });
      await refreshSelectedService(selectedService.id);
    } catch (err) {
      console.error("Erro ao lancar entrega:", err);
      alert("Erro ao lancar entrega.");
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

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-purple-700">
            Point&Point Admin
          </p>
          <h1 className="text-3xl font-bold text-stone-900">
            Servicos Terceirizados
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setServiceModal(true)}
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
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Servicos pendentes"
          value={summary.pending}
          color="border-amber-500"
        />
        <SummaryCard
          label="Servicos concluidos"
          value={summary.completed}
          color="border-emerald-500"
        />
        <SummaryCard
          label="Servicos atrasados"
          value={summary.overdue}
          color="border-red-500"
        />
        <SummaryCard
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
      </div>

      {loading ? (
        <div className="rounded-lg bg-white p-8 text-center text-stone-500 shadow">
          Carregando...
        </div>
      ) : activeTab === "services" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow lg:flex-row lg:items-end">
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
          </div>

          <div className="overflow-x-auto rounded-lg bg-white shadow">
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
                    "Valor tecido",
                    "Progresso",
                    "Observacoes",
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
                {visibleServices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
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
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(service)}`}
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
                        {service.input_quantity} {service.input_unit}
                      </td>
                      <td className="px-4 py-3">
                        {service.expected_return_quantity}{" "}
                        {service.expected_return_unit}
                      </td>
                      <td className="px-4 py-3">
                        {service.total_delivered_quantity}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {service.remaining_quantity}
                      </td>
                      <td className="px-4 py-3">
                        {money(service.fabric_paid_amount)}
                      </td>
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
        </section>
      ) : (
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
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        company.active === false
                          ? "bg-stone-100 text-stone-600"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {company.active === false ? "Inativa" : "Ativa"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEditCompany(company)}
                      className="font-bold text-purple-700 hover:text-purple-900"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              Novo servico terceirizado
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
                  {types.map((type) => (
                    <option key={serviceTypeValue(type)} value={serviceTypeValue(type)}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <FormInput
                label="Quantidade retirada"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={serviceForm.input_quantity}
                onChange={(value) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    input_quantity: value,
                  }))
                }
              />
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
                label="Quantidade prevista de retorno"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={serviceForm.expected_return_quantity}
                onChange={(value) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    expected_return_quantity: value,
                  }))
                }
              />
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
                onCancel={() => setServiceModal(false)}
              />
            </form>
          </div>
        </div>
      )}

      {selectedService && (
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
              <button
                onClick={() => setSelectedService(null)}
                className="rounded-lg bg-stone-100 px-4 py-2 font-bold text-stone-700 hover:bg-stone-200"
              >
                Fechar
              </button>
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
                      className={`mt-1 inline-block rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(selectedService)}`}
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
                  <Info label="Retirada" value={`${selectedService.input_quantity} ${selectedService.input_unit}`} />
                  <Info label="Retorno previsto" value={`${selectedService.expected_return_quantity} ${selectedService.expected_return_unit}`} />
                  <Info label="Ja entregue" value={String(selectedService.total_delivered_quantity)} />
                  <Info label="Faltante" value={String(selectedService.remaining_quantity)} />
                  <Info label="Valor tecido" value={money(selectedService.fabric_paid_amount)} />
                  <Info label="Inicio" value={formatDate(selectedService.started_at)} />
                  <Info label="Observacoes" value={selectedService.notes || "-"} />
                </div>

                <div className="mb-6">
                  <h3 className="mb-3 text-lg font-bold text-stone-900">
                    Historico de entregas
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-stone-200">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="bg-stone-50">
                        <tr>
                          <th className="px-4 py-3 text-left">Data</th>
                          <th className="px-4 py-3 text-left">Quantidade</th>
                          <th className="px-4 py-3 text-left">Observacao</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {(selectedService.deliveries || []).length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
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
                              <td className="px-4 py-3 font-bold">
                                {delivery.quantity}
                              </td>
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
                  <FormInput
                    label="Quantidade"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={deliveryForm.quantity}
                    onChange={(value) =>
                      setDeliveryForm((prev) => ({
                        ...prev,
                        quantity: value,
                      }))
                    }
                  />
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
}> = ({ label, value, onChange, type = "text", required, min, step }) => (
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
      className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-purple-600 focus:outline-none"
    />
  </label>
);

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
