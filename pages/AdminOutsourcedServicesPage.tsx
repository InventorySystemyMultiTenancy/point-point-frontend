import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addOutsourcedServiceDelivery,
  createOutsourcedCompany,
  createOutsourcedService,
  finalizeOutsourcedService,
  getOutsourcedCompanies,
  getOutsourcedService,
  getOutsourcedServiceTypes,
  getOutsourcedServices,
  updateOutsourcedCompany,
  type OutsourcedCompany,
  type OutsourcedCompanyPayload,
  type OutsourcedDelivery,
  type OutsourcedService,
  type OutsourcedServicePayload,
  type OutsourcedServiceType,
} from "../services/outsourcedServices";

const SERVICE_FALLBACKS = [
  {
    value: "fabric_cutting",
    label: "Retirada de tecido para corte",
    inputUnit: "tecido",
    returnUnit: "pecas_cortadas",
  },
  {
    value: "embroidery_sewing",
    label: "Bordagem e costura",
    inputUnit: "tecido",
    returnUnit: "peles_costuradas",
  },
  {
    value: "stuffing_closing",
    label: "Enchimento e fechamento",
    inputUnit: "peles",
    returnUnit: "pelucias_prontas",
  },
];

const emptyCompanyForm: OutsourcedCompanyPayload = {
  name: "",
  document: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  active: true,
};

const emptyServiceForm = {
  company_id: "",
  service_type: "fabric_cutting",
  input_quantity: "",
  fabric_paid_amount: "",
  expected_return_quantity: "",
  due_date: "",
  started_at: "",
  notes: "",
};

type Tab = "companies" | "services";
type ServiceFilter = "all" | "pendente" | "concluido" | "overdue";

function serviceTypeKey(type: OutsourcedServiceType) {
  return type.value || type.key || type.service_type || "";
}

function serviceTypeLabel(type: OutsourcedServiceType) {
  return type.label || type.name || serviceTypeKey(type);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function toIsoFromLocal(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function money(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusLabel(service: OutsourcedService) {
  if (service.is_overdue && service.status !== "concluido") return "Atrasado";
  return service.status === "concluido" ? "Concluido" : "Pendente";
}

function statusClass(service: OutsourcedService) {
  if (service.is_overdue && service.status !== "concluido") {
    return "bg-red-100 text-red-700 border-red-200";
  }
  if (service.status === "concluido") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
  return "bg-amber-100 text-amber-800 border-amber-200";
}

function progressPercent(service: OutsourcedService) {
  const delivered = Number(service.total_delivered_quantity || 0);
  const expected = Number(service.expected_return_quantity || 0);
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((delivered / expected) * 100));
}

function normalizeCompanyPayload(
  form: OutsourcedCompanyPayload,
): OutsourcedCompanyPayload {
  return {
    name: String(form.name || "").trim(),
    document: form.document?.trim() || undefined,
    contact_name: form.contact_name?.trim() || undefined,
    phone: form.phone?.trim() || undefined,
    email: form.email?.trim() || undefined,
    address: form.address?.trim() || undefined,
    notes: form.notes?.trim() || undefined,
    active: Boolean(form.active),
  };
}

const AdminOutsourcedServicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("services");
  const [companies, setCompanies] = useState<OutsourcedCompany[]>([]);
  const [services, setServices] = useState<OutsourcedService[]>([]);
  const [serviceTypes, setServiceTypes] = useState<OutsourcedServiceType[]>([]);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [isCompanyFormOpen, setIsCompanyFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] =
    useState<OutsourcedCompany | null>(null);
  const [companyForm, setCompanyForm] =
    useState<OutsourcedCompanyPayload>(emptyCompanyForm);

  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [selectedService, setSelectedService] =
    useState<OutsourcedService | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    quantity: "",
    delivered_at: "",
    observation: "",
  });

  const availableTypes = serviceTypes.length > 0 ? serviceTypes : SERVICE_FALLBACKS;

  const loadBaseData = async () => {
    setLoading(true);
    setError("");
    try {
      const [companyData, serviceData, typeData] = await Promise.all([
        getOutsourcedCompanies(),
        getOutsourcedServices(),
        getOutsourcedServiceTypes().catch(() => []),
      ]);
      setCompanies(companyData);
      setServices(serviceData);
      setServiceTypes(typeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  const loadServicesForFilter = async (filter: ServiceFilter) => {
    setServiceFilter(filter);
    setCompanyFilter("");
    setError("");
    try {
      if (filter === "pendente") {
        setServices(await getOutsourcedServices({ status: "pendente" }));
      } else if (filter === "overdue") {
        setServices(await getOutsourcedServices({ overdue: true }));
      } else {
        setServices(await getOutsourcedServices());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao filtrar servicos");
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (serviceFilter === "concluido" && service.status !== "concluido") {
        return false;
      }
      if (companyFilter && service.company_id !== companyFilter) return false;
      return true;
    });
  }, [services, serviceFilter, companyFilter]);

  const summary = useMemo(() => {
    const all = services;
    return {
      pending: all.filter((service) => service.status !== "concluido").length,
      completed: all.filter((service) => service.status === "concluido").length,
      overdue: all.filter(
        (service) => service.is_overdue && service.status !== "concluido",
      ).length,
      activeCompanies: companies.filter((company) => company.active !== false)
        .length,
    };
  }, [companies, services]);

  const openCompanyForm = (company?: OutsourcedCompany) => {
    setEditingCompany(company || null);
    setCompanyForm(company ? { ...emptyCompanyForm, ...company } : emptyCompanyForm);
    setIsCompanyFormOpen(true);
  };

  const saveCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = normalizeCompanyPayload(companyForm);
    if (!payload.name) return alert("Informe o nome da empresa.");

    setSaving(true);
    try {
      if (editingCompany) {
        await updateOutsourcedCompany(editingCompany.id, payload);
      } else {
        await createOutsourcedCompany(payload);
      }
      setIsCompanyFormOpen(false);
      setEditingCompany(null);
      setCompanies(await getOutsourcedCompanies());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  const saveService = async (event: React.FormEvent) => {
    event.preventDefault();
    const inputQuantity = Number(serviceForm.input_quantity);
    const expectedQuantity = Number(serviceForm.expected_return_quantity);
    const paidAmount =
      serviceForm.fabric_paid_amount === ""
        ? undefined
        : Number(serviceForm.fabric_paid_amount);

    if (!serviceForm.company_id) return alert("Selecione a empresa.");
    if (inputQuantity <= 0) return alert("Quantidade retirada deve ser maior que zero.");
    if (expectedQuantity <= 0) return alert("Quantidade prevista deve ser maior que zero.");
    if (paidAmount !== undefined && paidAmount < 0) {
      return alert("Valor pago pelo tecido deve ser maior ou igual a zero.");
    }
    if (!serviceForm.due_date) return alert("Informe o prazo.");

    const payload: OutsourcedServicePayload = {
      company_id: serviceForm.company_id,
      service_type: serviceForm.service_type,
      input_quantity: inputQuantity,
      expected_return_quantity: expectedQuantity,
      due_date: toIsoFromLocal(serviceForm.due_date) || "",
      notes: serviceForm.notes.trim() || undefined,
    };
    if (paidAmount !== undefined) payload.fabric_paid_amount = paidAmount;
    const startedAt = toIsoFromLocal(serviceForm.started_at);
    if (startedAt) payload.started_at = startedAt;

    setSaving(true);
    try {
      await createOutsourcedService(payload);
      setIsServiceFormOpen(false);
      setServiceForm(emptyServiceForm);
      await loadServicesForFilter("all");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar servico");
    } finally {
      setSaving(false);
    }
  };

  const openServiceDetail = async (service: OutsourcedService) => {
    setSelectedService(service);
    setDeliveryForm({ quantity: "", delivered_at: "", observation: "" });
    try {
      setSelectedService(await getOutsourcedService(service.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao carregar detalhe");
    }
  };

  const refreshSelectedService = async (id: string) => {
    const updated = await getOutsourcedService(id);
    setSelectedService(updated);
    setServices((prev) =>
      prev.map((service) => (service.id === id ? updated : service)),
    );
  };

  const saveDelivery = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedService) return;
    const quantity = Number(deliveryForm.quantity);
    if (quantity <= 0) return alert("Informe uma quantidade maior que zero.");
    if (!deliveryForm.delivered_at) return alert("Informe a data da entrega.");

    setSaving(true);
    try {
      await addOutsourcedServiceDelivery(selectedService.id, {
        quantity,
        delivered_at: toIsoFromLocal(deliveryForm.delivered_at) || "",
        observation: deliveryForm.observation.trim() || undefined,
      });
      setDeliveryForm({ quantity: "", delivered_at: "", observation: "" });
      await refreshSelectedService(selectedService.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao lancar entrega");
    } finally {
      setSaving(false);
    }
  };

  const finalizeService = async () => {
    if (!selectedService) return;
    if (!window.confirm("Deseja finalizar este servico?")) return;
    setSaving(true);
    try {
      await finalizeOutsourcedService(selectedService.id);
      await refreshSelectedService(selectedService.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao finalizar servico");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate("/admin")}
            className="text-sm font-semibold text-purple-800 hover:text-purple-950 mb-2"
          >
            Voltar ao painel
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold text-purple-900">
            Serviços Terceirizados
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setServiceForm({
                ...emptyServiceForm,
                company_id: companies[0]?.id || "",
              });
              setIsServiceFormOpen(true);
            }}
            className="bg-purple-700 text-white font-bold py-2 px-5 rounded-lg hover:bg-purple-800 shadow-md"
          >
            Novo servico
          </button>
          <button
            onClick={() => openCompanyForm()}
            className="bg-emerald-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-emerald-700 shadow-md"
          >
            Nova empresa
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Servicos pendentes" value={summary.pending} color="amber" />
        <SummaryCard label="Servicos concluidos" value={summary.completed} color="emerald" />
        <SummaryCard label="Servicos atrasados" value={summary.overdue} color="red" />
        <SummaryCard
          label="Empresas ativas"
          value={summary.activeCompanies}
          color="brand"
        />
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-stone-100 mb-6">
        <div className="flex border-b border-stone-200">
          <TabButton
            active={activeTab === "services"}
            onClick={() => setActiveTab("services")}
          >
            Servicos
          </TabButton>
          <TabButton
            active={activeTab === "companies"}
            onClick={() => setActiveTab("companies")}
          >
            Empresas terceirizadas
          </TabButton>
        </div>

        {loading ? (
          <div className="p-10 text-center text-stone-500 font-semibold">
            Carregando dados...
          </div>
        ) : activeTab === "services" ? (
          <ServicesSection
            services={filteredServices}
            companies={companies}
            filter={serviceFilter}
            companyFilter={companyFilter}
            onFilterChange={loadServicesForFilter}
            onCompanyFilterChange={setCompanyFilter}
            onOpenDetail={openServiceDetail}
          />
        ) : (
          <CompaniesSection companies={companies} onEdit={openCompanyForm} />
        )}
      </div>

      {isCompanyFormOpen && (
        <CompanyModal
          form={companyForm}
          saving={saving}
          editing={Boolean(editingCompany)}
          onChange={setCompanyForm}
          onClose={() => setIsCompanyFormOpen(false)}
          onSubmit={saveCompany}
        />
      )}

      {isServiceFormOpen && (
        <ServiceModal
          form={serviceForm}
          companies={companies}
          serviceTypes={availableTypes}
          saving={saving}
          onChange={setServiceForm}
          onClose={() => setIsServiceFormOpen(false)}
          onSubmit={saveService}
        />
      )}

      {selectedService && (
        <ServiceDetailModal
          service={selectedService}
          deliveryForm={deliveryForm}
          saving={saving}
          onDeliveryChange={setDeliveryForm}
          onDeliverySubmit={saveDelivery}
          onFinalize={finalizeService}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: number;
  color: "amber" | "emerald" | "red" | "brand";
}> = ({ label, value, color }) => {
  const colors = {
    amber: "border-amber-500 text-amber-700",
    emerald: "border-emerald-500 text-emerald-700",
    red: "border-red-500 text-red-700",
    brand: "border-amber-500 text-purple-800",
  };
  return (
    <div className={`bg-white p-5 rounded-xl shadow-lg border-l-4 ${colors[color]}`}>
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-3 font-bold text-sm border-b-2 ${
      active
        ? "border-purple-700 text-purple-800 bg-amber-50"
        : "border-transparent text-stone-600 hover:text-purple-800"
    }`}
  >
    {children}
  </button>
);

const ServicesSection: React.FC<{
  services: OutsourcedService[];
  companies: OutsourcedCompany[];
  filter: ServiceFilter;
  companyFilter: string;
  onFilterChange: (filter: ServiceFilter) => void;
  onCompanyFilterChange: (companyId: string) => void;
  onOpenDetail: (service: OutsourcedService) => void;
}> = ({
  services,
  companies,
  filter,
  companyFilter,
  onFilterChange,
  onCompanyFilterChange,
  onOpenDetail,
}) => (
  <div className="p-4 sm:p-6">
    <div className="flex flex-wrap gap-3 mb-5 items-end">
      <div className="flex flex-wrap gap-2">
        {[
          ["all", "Todos"],
          ["pendente", "Pendentes"],
          ["concluido", "Concluidos"],
          ["overdue", "Atrasados"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => onFilterChange(key as ServiceFilter)}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${
              filter === key
                ? "bg-purple-700 text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <select
        value={companyFilter}
        onChange={(event) => onCompanyFilterChange(event.target.value)}
        className="border border-stone-300 rounded-lg px-3 py-2 min-w-[240px]"
      >
        <option value="">Todas as empresas</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-[1180px] w-full divide-y divide-stone-200 text-sm">
        <thead className="bg-stone-50">
          <tr>
            {[
              "Empresa",
              "Tipo",
              "Status",
              "Prazo",
              "Retirada",
              "Retorno previsto",
              "Entregue",
              "Faltante",
              "Valor tecido",
              "Observacoes",
              "Progresso",
            ].map((header) => (
              <th
                key={header}
                className="px-3 py-3 text-left text-xs font-bold text-stone-500 uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {services.length === 0 ? (
            <tr>
              <td colSpan={11} className="p-8 text-center text-stone-500">
                Nenhum servico encontrado.
              </td>
            </tr>
          ) : (
            services.map((service) => (
              <tr
                key={service.id}
                onClick={() => onOpenDetail(service)}
                className="hover:bg-amber-50 cursor-pointer"
              >
                <td className="px-3 py-3 font-bold text-stone-800">
                  {service.company_name || "-"}
                </td>
                <td className="px-3 py-3">{service.service_type_label || service.service_type}</td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full border text-xs font-bold ${statusClass(service)}`}
                  >
                    {statusLabel(service)}
                  </span>
                </td>
                <td className="px-3 py-3">{formatDate(service.due_date)}</td>
                <td className="px-3 py-3">
                  {service.input_quantity} {service.input_unit}
                </td>
                <td className="px-3 py-3">
                  {service.expected_return_quantity} {service.expected_return_unit}
                </td>
                <td className="px-3 py-3">{service.total_delivered_quantity || 0}</td>
                <td className="px-3 py-3">{service.remaining_quantity ?? "-"}</td>
                <td className="px-3 py-3">{money(service.fabric_paid_amount)}</td>
                <td className="px-3 py-3 max-w-[220px] truncate">
                  {service.notes || "-"}
                </td>
                <td className="px-3 py-3 w-40">
                  <ProgressBar service={service} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const CompaniesSection: React.FC<{
  companies: OutsourcedCompany[];
  onEdit: (company: OutsourcedCompany) => void;
}> = ({ companies, onEdit }) => (
  <div className="p-4 sm:p-6 overflow-x-auto">
    <table className="min-w-[900px] w-full divide-y divide-stone-200 text-sm">
      <thead className="bg-stone-50">
        <tr>
          {["Empresa", "Documento", "Contato", "Telefone", "Email", "Status", "Acoes"].map(
            (header) => (
              <th
                key={header}
                className="px-3 py-3 text-left text-xs font-bold text-stone-500 uppercase"
              >
                {header}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-200">
        {companies.length === 0 ? (
          <tr>
            <td colSpan={7} className="p-8 text-center text-stone-500">
              Nenhuma empresa cadastrada.
            </td>
          </tr>
        ) : (
          companies.map((company) => (
            <tr key={company.id} className={company.active === false ? "opacity-60" : ""}>
              <td className="px-3 py-3 font-bold">{company.name}</td>
              <td className="px-3 py-3">{company.document || "-"}</td>
              <td className="px-3 py-3">{company.contact_name || "-"}</td>
              <td className="px-3 py-3">{company.phone || "-"}</td>
              <td className="px-3 py-3">{company.email || "-"}</td>
              <td className="px-3 py-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-bold ${
                    company.active === false
                      ? "bg-stone-100 text-stone-600"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {company.active === false ? "Inativa" : "Ativa"}
                </span>
              </td>
              <td className="px-3 py-3">
                <button
                  onClick={() => onEdit(company)}
                  className="text-purple-800 hover:text-purple-950 font-bold"
                >
                  Editar
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const ProgressBar: React.FC<{ service: OutsourcedService }> = ({ service }) => {
  const percent = progressPercent(service);
  return (
    <div>
      <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${service.status === "concluido" ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-stone-500">
        {service.total_delivered_quantity || 0} / {service.expected_return_quantity}
      </div>
    </div>
  );
};

const CompanyModal: React.FC<{
  form: OutsourcedCompanyPayload;
  editing: boolean;
  saving: boolean;
  onChange: (form: OutsourcedCompanyPayload) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}> = ({ form, editing, saving, onChange, onClose, onSubmit }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start sm:items-center z-50 overflow-y-auto p-3">
    <div className="bg-white p-5 sm:p-7 rounded-xl shadow-2xl w-full max-w-2xl">
      <h2 className="text-2xl font-bold text-purple-900 mb-5">
        {editing ? "Editar empresa" : "Nova empresa terceirizada"}
      </h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput label="Nome" required value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
        <FormInput label="Documento" value={form.document || ""} onChange={(value) => onChange({ ...form, document: value })} />
        <FormInput label="Contato" value={form.contact_name || ""} onChange={(value) => onChange({ ...form, contact_name: value })} />
        <FormInput label="Telefone" value={form.phone || ""} onChange={(value) => onChange({ ...form, phone: value })} />
        <FormInput label="Email" type="email" value={form.email || ""} onChange={(value) => onChange({ ...form, email: value })} />
        <FormInput label="Endereco" value={form.address || ""} onChange={(value) => onChange({ ...form, address: value })} />
        <label className="sm:col-span-2">
          <span className="block text-sm font-semibold text-stone-700 mb-1">Observacoes</span>
          <textarea
            value={form.notes || ""}
            onChange={(event) => onChange({ ...form, notes: event.target.value })}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 min-h-[90px]"
          />
        </label>
        <label className="flex items-center gap-2 font-semibold text-stone-700">
          <input
            type="checkbox"
            checked={form.active !== false}
            onChange={(event) => onChange({ ...form, active: event.target.checked })}
            className="h-4 w-4"
          />
          Empresa ativa
        </label>
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </div>
  </div>
);

const ServiceModal: React.FC<{
  form: typeof emptyServiceForm;
  companies: OutsourcedCompany[];
  serviceTypes: OutsourcedServiceType[];
  saving: boolean;
  onChange: (form: typeof emptyServiceForm) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}> = ({ form, companies, serviceTypes, saving, onChange, onClose, onSubmit }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start sm:items-center z-50 overflow-y-auto p-3">
    <div className="bg-white p-5 sm:p-7 rounded-xl shadow-2xl w-full max-w-3xl">
      <h2 className="text-2xl font-bold text-purple-900 mb-5">Novo servico</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label>
          <span className="block text-sm font-semibold text-stone-700 mb-1">Empresa</span>
          <select
            required
            value={form.company_id}
            onChange={(event) => onChange({ ...form, company_id: event.target.value })}
            className="w-full border border-stone-300 rounded-lg px-3 py-2"
          >
            <option value="">Selecione</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-sm font-semibold text-stone-700 mb-1">Tipo de servico</span>
          <select
            required
            value={form.service_type}
            onChange={(event) => onChange({ ...form, service_type: event.target.value })}
            className="w-full border border-stone-300 rounded-lg px-3 py-2"
          >
            {serviceTypes.map((type) => (
              <option key={serviceTypeKey(type)} value={serviceTypeKey(type)}>
                {serviceTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <FormInput
          label="Quantidade retirada"
          type="number"
          required
          min="0.01"
          step="0.01"
          value={form.input_quantity}
          onChange={(value) => onChange({ ...form, input_quantity: value })}
        />
        <FormInput
          label="Valor pago pelo tecido"
          type="number"
          min="0"
          step="0.01"
          value={form.fabric_paid_amount}
          onChange={(value) => onChange({ ...form, fabric_paid_amount: value })}
        />
        <FormInput
          label="Quantidade prevista de retorno"
          type="number"
          required
          min="0.01"
          step="0.01"
          value={form.expected_return_quantity}
          onChange={(value) => onChange({ ...form, expected_return_quantity: value })}
        />
        <FormInput
          label="Prazo"
          type="datetime-local"
          required
          value={form.due_date}
          onChange={(value) => onChange({ ...form, due_date: value })}
        />
        <FormInput
          label="Inicio"
          type="datetime-local"
          value={form.started_at}
          onChange={(value) => onChange({ ...form, started_at: value })}
        />
        <label className="sm:col-span-2">
          <span className="block text-sm font-semibold text-stone-700 mb-1">Observacoes</span>
          <textarea
            value={form.notes}
            onChange={(event) => onChange({ ...form, notes: event.target.value })}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 min-h-[90px]"
          />
        </label>
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </div>
  </div>
);

const ServiceDetailModal: React.FC<{
  service: OutsourcedService;
  deliveryForm: { quantity: string; delivered_at: string; observation: string };
  saving: boolean;
  onDeliveryChange: (form: {
    quantity: string;
    delivered_at: string;
    observation: string;
  }) => void;
  onDeliverySubmit: (event: React.FormEvent) => void;
  onFinalize: () => void;
  onClose: () => void;
}> = ({
  service,
  deliveryForm,
  saving,
  onDeliveryChange,
  onDeliverySubmit,
  onFinalize,
  onClose,
}) => {
  const deliveries: OutsourcedDelivery[] = service.deliveries || [];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-50 overflow-y-auto p-3">
      <div className="bg-white p-5 sm:p-7 rounded-xl shadow-2xl w-full max-w-4xl my-6">
        <div className="flex justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-purple-900">
              {service.company_name || "Servico terceirizado"}
            </h2>
            <p className="text-stone-600">{service.service_type_label || service.service_type}</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-800 font-bold">
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-sm">
          <DetailItem label="Status" value={statusLabel(service)} />
          <DetailItem label="Prazo" value={formatDate(service.due_date)} />
          <DetailItem label="Valor tecido" value={money(service.fabric_paid_amount)} />
          <DetailItem label="Retirada" value={`${service.input_quantity} ${service.input_unit}`} />
          <DetailItem
            label="Retorno previsto"
            value={`${service.expected_return_quantity} ${service.expected_return_unit}`}
          />
          <DetailItem label="Faltante" value={String(service.remaining_quantity ?? "-")} />
        </div>

        <div className="mb-6">
          <ProgressBar service={service} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold text-stone-800 mb-3">Historico de entregas</h3>
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              {deliveries.length === 0 ? (
                <div className="p-5 text-center text-stone-500">Nenhuma entrega lancada.</div>
              ) : (
                deliveries.map((delivery, index) => (
                  <div
                    key={delivery.id || `${delivery.delivered_at}-${index}`}
                    className="p-4 border-b last:border-b-0 border-stone-200"
                  >
                    <div className="font-bold text-stone-800">
                      {delivery.quantity} {service.expected_return_unit}
                    </div>
                    <div className="text-sm text-stone-500">
                      {formatDate(delivery.delivered_at)}
                    </div>
                    {delivery.observation && (
                      <div className="text-sm text-stone-700 mt-1">
                        {delivery.observation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-stone-800 mb-3">Lancar entrega</h3>
            <form onSubmit={onDeliverySubmit} className="space-y-4">
              <FormInput
                label="Quantidade"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={deliveryForm.quantity}
                onChange={(value) => onDeliveryChange({ ...deliveryForm, quantity: value })}
              />
              <FormInput
                label="Data da entrega"
                type="datetime-local"
                required
                value={deliveryForm.delivered_at}
                onChange={(value) => onDeliveryChange({ ...deliveryForm, delivered_at: value })}
              />
              <label>
                <span className="block text-sm font-semibold text-stone-700 mb-1">Observacao</span>
                <textarea
                  value={deliveryForm.observation}
                  onChange={(event) =>
                    onDeliveryChange({ ...deliveryForm, observation: event.target.value })
                  }
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 min-h-[90px]"
                />
              </label>
              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-purple-700 text-white font-bold py-2 px-5 rounded-lg hover:bg-purple-800 disabled:bg-purple-300"
                >
                  Salvar entrega
                </button>
                {service.status !== "concluido" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={onFinalize}
                    className="bg-emerald-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300"
                  >
                    Finalizar servico
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-stone-50 rounded-lg p-3">
    <div className="text-xs uppercase font-bold text-stone-500">{label}</div>
    <div className="font-bold text-stone-800">{value}</div>
  </div>
);

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
    <span className="block text-sm font-semibold text-stone-700 mb-1">{label}</span>
    <input
      type={type}
      required={required}
      min={min}
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full border border-stone-300 rounded-lg px-3 py-2"
    />
  </label>
);

const ModalActions: React.FC<{
  saving: boolean;
  onClose: () => void;
}> = ({ saving, onClose }) => (
  <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
    <button
      type="button"
      onClick={onClose}
      className="bg-stone-200 text-stone-800 font-bold py-2 px-5 rounded-lg hover:bg-stone-300"
    >
      Cancelar
    </button>
    <button
      type="submit"
      disabled={saving}
      className="bg-purple-700 text-white font-bold py-2 px-5 rounded-lg hover:bg-purple-800 disabled:bg-purple-300"
    >
      {saving ? "Salvando..." : "Salvar"}
    </button>
  </div>
);

export default AdminOutsourcedServicesPage;
