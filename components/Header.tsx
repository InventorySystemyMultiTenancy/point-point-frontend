import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/pointpoint-logo.png";

const Header: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAdminArea = location.pathname.startsWith("/admin");
  const isLoginRoute =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/menu";

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
    navigate("/");
  };

  const linkClass = "monster-header-link text-white hover:text-[#d2b48c] transition-colors font-medium";
  const mobileLinkClass = "text-stone-100 hover:text-[#d2b48c] font-medium";

  const adminLinks = (
    <>
      <NavLink to="/admin" className={linkClass}>Produtos</NavLink>
      <NavLink to="/admin/management-report" className={linkClass}>Relatório Gestão</NavLink>
      <NavLink to="/admin/outsourced-services" className={linkClass}>SERVIÇOS TERCEIRIZADOS</NavLink>
      <NavLink to="/admin/reports" className={linkClass}>Relatórios IA</NavLink>
      <NavLink
        to="/superadmin/login"
        className="monster-header-action bg-purple-700 text-white font-bold py-1 px-4 rounded-lg ml-2 hover:bg-purple-800 transition-colors shadow-md superadmin-btn"
        title="SuperAdmin"
      >
        SuperAdmin
      </NavLink>
    </>
  );

  const mobileAdminLinks = (
    <>
      <NavLink to="/admin" className={mobileLinkClass}>Produtos</NavLink>
      <NavLink to="/admin/management-report" className={mobileLinkClass}>Relatório Gestão</NavLink>
      <NavLink to="/admin/outsourced-services" className={mobileLinkClass}>SERVIÇOS TERCEIRIZADOS</NavLink>
      <NavLink to="/admin/reports" className={mobileLinkClass}>Relatórios IA</NavLink>
      <NavLink to="/superadmin/login" className={mobileLinkClass}>SuperAdmin</NavLink>
    </>
  );

  return (
    <>
      <header
        className={`monster-header bg-gradient-to-r from-[#fff6e5] via-purple-800 to-[#d2b48c] border-b border-stone-200 sticky top-0 z-50 h-16 ${
          isLoginRoute ? "login-plush-header" : ""
        }`}
      >
        <div className="container mx-auto px-3 sm:px-4 h-full flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 relative min-w-0">
            <NavLink to={currentUser ? "/menu" : "/"} className="flex items-center gap-2 group min-w-0">
              <img
                src={logo}
                alt="Point&Point logo"
                className="monster-header-logo w-10 h-10 sm:w-12 sm:h-12 rounded-lg group-hover:scale-105 transition-transform object-cover shrink-0"
              />
              <span className="monster-header-brand text-base sm:text-xl font-bold text-stone-800 tracking-tight whitespace-nowrap">
                Point&Point
              </span>
            </NavLink>
          </div>

          <nav className="flex items-center gap-4 md:gap-8 max-[1100px]:hidden">
            {currentUser && (!currentUser.role || currentUser.role === "customer" || currentUser.role === "admin") && (
              <NavLink to="/menu" className={linkClass}>Catálogo</NavLink>
            )}

            {currentUser?.role === "kitchen" && (
              <NavLink to="/cozinha" className="monster-header-link text-stone-700 hover:text-purple-800 transition-colors font-medium">
                Pedidos Cozinha
              </NavLink>
            )}

            {currentUser?.role === "admin" && !isAdminArea && (
              <NavLink to="/admin/login" className={linkClass}>Ir para Admin</NavLink>
            )}

            {currentUser?.role === "admin" && isAdminArea && adminLinks}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="monster-header-action hidden max-[1100px]:inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-purple-700 text-white hover:bg-purple-800 transition-colors shrink-0"
              aria-label="Abrir menu"
              title="Menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-4 max-[1100px]:hidden">
              {currentUser ? (
                <>
                  <div className="h-6 w-px bg-stone-200 mx-1"></div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:block text-right leading-tight">
                      <p className="text-xs text-white font-medium">Olá,</p>
                      <p className="text-sm font-bold max-w-[120px] truncate" style={{ color: "#d2b48c" }}>
                        {currentUser.name}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate("/register?edit=1")}
                      className="monster-header-action edit-btn bg-purple-700 text-white font-bold py-1 px-3 rounded-lg ml-2 hover:bg-purple-800 transition-colors shadow-md text-xs"
                      title="Editar meus dados"
                    >
                      <span className="edit-btn-label">Editar meus dados</span>
                    </button>
                    <NavLink
                      to="/meus-pedidos"
                      className="monster-header-action bg-[#fff6e5] text-purple-800 font-bold py-1 px-3 rounded-lg ml-2 hover:bg-[#d2b48c] transition-colors shadow-md text-xs flex items-center gap-2"
                      title="Meus Pedidos"
                    >
                      Meus Pedidos
                    </NavLink>
                    <button
                      onClick={handleLogout}
                      className="text-white hover:text-purple-700 hover:bg-[#fff6e5] p-2 rounded-full transition-all duration-300 ease-in-out transform hover:scale-105 shadow-lg"
                      title="Sair"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-sm text-white">Bem-vindo!</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <div className="min-[1101px]:hidden bg-[#3b2418] border-b border-purple-400/30 shadow-md">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
            {currentUser && (!currentUser.role || currentUser.role === "customer" || currentUser.role === "admin") && (
              <NavLink to="/menu" className={mobileLinkClass}>Catálogo</NavLink>
            )}
            {currentUser?.role === "kitchen" && <NavLink to="/cozinha" className={mobileLinkClass}>Pedidos Cozinha</NavLink>}
            {currentUser?.role === "admin" && !isAdminArea && <NavLink to="/admin/login" className={mobileLinkClass}>Ir para Admin</NavLink>}
            {currentUser?.role === "admin" && isAdminArea && mobileAdminLinks}

            {currentUser ? (
              <>
                <div className="h-px bg-purple-300/20 my-1" />
                <p className="text-sm text-stone-300">
                  Olá, <span className="font-bold text-[#d2b48c]">{currentUser.name}</span>
                </p>
                <button onClick={() => navigate("/register?edit=1")} className={`text-left ${mobileLinkClass}`}>
                  Editar meus dados
                </button>
                <NavLink to="/meus-pedidos" className={mobileLinkClass}>Meus Pedidos</NavLink>
                <button onClick={handleLogout} className={`text-left ${mobileLinkClass}`}>Sair</button>
              </>
            ) : (
              <span className="text-sm text-stone-100">Bem-vindo!</span>
            )}
          </div>
        </div>
      )}

      <div style={{ height: "4px", background: "#7e22ce", width: "100%" }} />
    </>
  );
};

export default Header;
