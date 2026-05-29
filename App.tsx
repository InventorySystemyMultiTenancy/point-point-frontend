import RegisterPage from "./pages/RegisterPage";
import React, { useEffect } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // <--- IMPORTANTE
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { StoreProvider, useStore } from "./contexts/StoreContext"; // 🏪 MULTI-TENANT
import LoginPage from "./pages/LoginPage";
import StoreNotFound from "./pages/StoreNotFound";
import MenuPage from "./pages/MenuPage";
import PaymentPage from "./pages/PaymentPage";
import OrderHistoryPage from "./pages/OrderHistoryPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import AdminPage from "./pages/AdminPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminReportsPage from "./pages/AdminReportsPage";
import AdminManagementReportPage from "./pages/AdminManagementReportPage";
import AdminOutsourcedServicesPage from "./pages/AdminOutsourcedServicesPage";
import AdminCategoriesPage from "./pages/AdminCategoriesPage"; // 🆕
import Header from "./components/Header";
import Chatbot from "./components/Chatbot";
// import InactivityGuard from "./components/InactivityGuard";
import type { UserRole } from "./types";
import { isAuthenticated as hasAdminToken } from "./services/apiService";

import OrderDetailPage from "./pages/OrderDetailPage";
import CustomerOrdersPage from "./pages/CustomerOrdersPage";

// 1. Configuração do Cliente React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Não recarregar ao trocar de aba
      retry: 1, // Tenta apenas 1 vez se der erro de rede
    },
  },
});

// Proteção de rota para clientes (customer)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (currentUser.role === "kitchen") {
    return <Navigate to="/cozinha" replace />;
  }
  return <>{children}</>;
};

// Proteção de rota por role específico
const RoleProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
}> = ({ children, allowedRoles, redirectTo = "/login" }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to={redirectTo} replace />;
  }

  const userRole = currentUser.role || "customer";
  if (allowedRoles.includes("admin") && userRole === "admin" && !hasAdminToken()) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  // Configurar Point Smart 2 na inicialização do sistema

  // Integração com maquininha removida

  return (
    // 2. Envolvendo a aplicação com os Providers (incluindo StoreProvider para Multi-tenant)
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <AuthProvider>
          <CartProvider>
            <HashRouter>
              <RouterBody />
              <Footer />
            </HashRouter>
          </CartProvider>
        </AuthProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
};

const RouterBody: React.FC = () => {
  const location = useLocation();
  const { store, loading, error } = useStore(); // 🏪 MULTI-TENANT
  const isLoginRoute =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/register";
  const isFullBleedRoute = isLoginRoute || location.pathname === "/menu";
  const isAdminThemeRoute =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/superadmin");
  const isCheckoutThemeRoute = location.pathname === "/payment";
  const mainClassName = isFullBleedRoute
    ? "bg-[#3b2418]"
    : isAdminThemeRoute
      ? "admin-modern-theme p-4 md:p-8"
      : isCheckoutThemeRoute
        ? "checkout-modern-theme p-4 md:p-8"
        : "p-4 md:p-8";

  // Loading state enquanto carrega a loja
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-200 border-t-amber-600 mx-auto mb-4"></div>
          <p className="text-stone-600 font-medium">Carregando loja...</p>
        </div>
      </div>
    );
  }

  // Erro ao carregar loja (404, etc)
  if (error || !store) {
    return <StoreNotFound />;
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800">
      {/* <InactivityGuard /> */}
      {!isLoginRoute && <Header />}
      <main
        className={mainClassName}
        style={
          isFullBleedRoute || isAdminThemeRoute || isCheckoutThemeRoute
            ? undefined
            : { background: "#FFF6E5" }
        }
      >
        <Routes>
          <Route path="/superadmin/login" element={<SuperAdminPage />} />
          {/* Rota protegida para detalhamento do superadmin */}
          <Route
            path="/superadmin/detalhes"
            element={
              <RoleProtectedRoute
                allowedRoles={["superadmin"]}
                redirectTo="/superadmin/login"
              >
                <SuperAdminPage />
              </RoleProtectedRoute>
            }
          />
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Rota protegida para clientes */}
          <Route
            path="/menu"
            element={
              <ProtectedRoute>
                <MenuPage />
              </ProtectedRoute>
            }
          />

          {/* Rota protegida para pagamento */}
          <Route
            path="/payment"
            element={
              <ProtectedRoute>
                <PaymentPage />
              </ProtectedRoute>
            }
          />

          {/* Rotas de login especiais */}
          <Route path="/cozinha/login" element={<OrderHistoryPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Rota protegida para histórico de pedidos */}
          <Route
            path="/historico"
            element={
              <RoleProtectedRoute
                allowedRoles={["admin", "kitchen"]}
                redirectTo="/admin/login"
              >
                <OrderHistoryPage />
              </RoleProtectedRoute>
            }
          />

          {/* Rota protegida para detalhes do pedido */}
          <Route
            path="/historico/detalhes"
            element={
              <RoleProtectedRoute
                allowedRoles={["admin", "kitchen"]}
                redirectTo="/admin/login"
              >
                <OrderDetailPage />
              </RoleProtectedRoute>
            }
          />

          {/* Rota protegida para '/meus-pedidos' */}
          <Route
            path="/meus-pedidos"
            element={
              <ProtectedRoute>
                <CustomerOrdersPage />
              </ProtectedRoute>
            }
          />

          {/* Rota protegida para admin */}
          <Route
            path="/admin"
            element={
              <RoleProtectedRoute
                allowedRoles={["admin"]}
                redirectTo="/admin/login"
              >
                <AdminPage />
              </RoleProtectedRoute>
            }
          />

          {/* 🆕 Rota protegida para gerenciar categorias */}
          <Route
            path="/admin/categories"
            element={
              <RoleProtectedRoute
                allowedRoles={["admin"]}
                redirectTo="/admin/login"
              >
                <AdminCategoriesPage />
              </RoleProtectedRoute>
            }
          />

          {/* Rota protegida para relatórios do admin */}
          <Route
            path="/admin/outsourced-services"
            element={
              <RoleProtectedRoute
                allowedRoles={["admin"]}
                redirectTo="/admin/login"
              >
                <AdminOutsourcedServicesPage />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/admin/reports"
            element={
              <RoleProtectedRoute
                allowedRoles={["admin"]}
                redirectTo="/admin/login"
              >
                <AdminReportsPage />
              </RoleProtectedRoute>
            }
          />

          {/* Rota protegida para relatório de gestão (admin) */}
          <Route
            path="/admin/management-report"
            element={
              <RoleProtectedRoute
                allowedRoles={["admin"]}
                redirectTo="/admin/login"
              >
                <AdminManagementReportPage />
              </RoleProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
};

import Footer from "./components/Footer";
export default App;
