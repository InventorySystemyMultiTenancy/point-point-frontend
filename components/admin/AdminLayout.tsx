import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

type IconProps = { className?: string };

const HomeIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  </svg>
);

const TagIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L3 13V4a1 1 0 0 1 1-1h9l7.59 7.59a2 2 0 0 1 0 2.82Z" />
    <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

const UsersIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M23 20v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
  </svg>
);

const TruckIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16V6a1 1 0 0 1 1-1h9v11M3 16h10m0 0h4m-4 0V9h4l3.5 4V16m0 0h-3.5" />
    <circle cx="7.5" cy="18.5" r="1.8" />
    <circle cx="17" cy="18.5" r="1.8" />
  </svg>
);

const ChartIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m6 10V4m6 16v-7" />
  </svg>
);

const BriefcaseIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="7.5" width="18" height="12" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5M3 12.5h18" />
  </svg>
);

const ClockIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3.5 2" />
  </svg>
);

const LogoutIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
  </svg>
);

interface AdminNavItem {
  to: string;
  label: string;
  icon: React.FC<IconProps>;
}

const NAV_ITEMS: AdminNavItem[] = [
  { to: "/admin", label: "Painel", icon: HomeIcon },
  { to: "/admin/categories", label: "Categorias", icon: TagIcon },
  { to: "/admin/clients", label: "Clientes", icon: UsersIcon },
  { to: "/admin/outsourced-services", label: "Terceirizados", icon: TruckIcon },
  { to: "/admin/reports", label: "Relatórios", icon: ChartIcon },
  { to: "/admin/management-report", label: "Gestão", icon: BriefcaseIcon },
  { to: "/historico", label: "Histórico de Pedidos", icon: ClockIcon },
];

const navLinkClasses = (isActive: boolean) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors whitespace-nowrap ${
    isActive
      ? "bg-purple-700 text-white shadow"
      : "text-stone-600 hover:bg-purple-50 hover:text-purple-800"
  }`;

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    if (!window.confirm("Deseja realmente sair?")) return;
    await logout();
    navigate("/admin/login");
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <nav className="lg:sticky lg:top-4 lg:w-56 lg:shrink-0">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-2 shadow lg:flex-col lg:gap-1 lg:overflow-visible">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              className={({ isActive }) => navLinkClasses(isActive)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
          <div className="my-1 hidden border-t border-stone-200 lg:block" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            <LogoutIcon className="h-4 w-4 shrink-0" />
            Sair
          </button>
        </div>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

export default AdminLayout;
