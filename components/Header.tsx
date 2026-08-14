import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useFavorites } from "../contexts/FavoritesContext";
import logo from "../assets/pointpointcorrect-transparent.png";

const Header: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { cartItems, isCartOpen, openCart, toggleCart } = useCart();
  const { favoriteIds } = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const isAdminArea = location.pathname.startsWith("/admin");

  // Busca/favoritos/carrinho só aparecem para quem está logado como
  // cliente (sem papel definido, "customer" ou "admincustomer").
  // Visitantes veem o link "Entre ou Cadastre-se" no lugar.
  const isCustomerRole =
    !!currentUser &&
    (!currentUser.role ||
      currentUser.role === "customer" ||
      currentUser.role === "admincustomer");

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/menu") {
      const params = new URLSearchParams(location.search);
      setSearchInput(params.get("q") || "");
    } else {
      setSearchInput("");
    }
  }, [location.pathname, location.search]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (location.pathname === "/menu") {
      const params = new URLSearchParams(location.search);
      if (value.trim()) params.set("q", value);
      else params.delete("q");
      navigate(`/menu?${params.toString()}`, { replace: true });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(
      location.pathname === "/menu" ? location.search : "",
    );
    if (searchInput.trim()) params.set("q", searchInput.trim());
    else params.delete("q");
    navigate(`/menu?${params.toString()}`);
  };

  const handleCartClick = () => {
    if (location.pathname !== "/menu") {
      navigate("/menu");
      openCart();
    } else {
      toggleCart();
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
    navigate("/");
  };

  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

  const adminLinks = (
    <>
      <NavLink to="/admin" className="site-header-link">
        Painel Administrativo
      </NavLink>
      <NavLink
        to="/admin/management-report"
        className="site-header-link site-header-link-accent"
      >
        Relatório Gestão
      </NavLink>
      <NavLink
        to="/superadmin/login"
        className="site-header-pill"
        title="SuperAdmin"
      >
        <span>SuperAdmin</span>
        <span role="img" aria-label="SuperAdmin">
          👑
        </span>
      </NavLink>
    </>
  );

  const mobileAdminLinks = (
    <>
      <NavLink to="/admin" className="site-header-mobile-link">
        Painel Administrativo
      </NavLink>
      <NavLink
        to="/admin/management-report"
        className="site-header-mobile-link"
      >
        Relatório Gestão
      </NavLink>
      <NavLink to="/superadmin/login" className="site-header-mobile-link">
        SuperAdmin
      </NavLink>
    </>
  );

  return (
    <>
      <header className="site-header site-header-dark sticky top-0 z-50">
        <div className="site-header-row container mx-auto px-3 sm:px-4 min-w-0">
          {/* Logo */}
          <NavLink
            to={currentUser ? "/menu" : "/"}
            className="site-header-logo-link group min-w-0"
          >
            <img
              src={logo}
              alt="POIT&POIT logo"
              className="site-header-logo w-10 h-10 sm:w-11 sm:h-11 group-hover:scale-105 transition-transform object-contain shrink-0"
            />
            <span className="site-header-brand truncate">POIT&POIT</span>
          </NavLink>

          {/* Busca (clientes e administradores navegando pela loja) */}
          {(isCustomerRole || currentUser?.role === "admin") && (
            <form
              className="site-header-search flex max-[860px]:hidden"
              onSubmit={handleSearchSubmit}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar pelúcias..."
                aria-label="Buscar produtos"
              />
            </form>
          )}

          {/* Área direita */}
          <div className="site-header-actions shrink-0">
            {/* Navegação por papel (Desktop) */}
            <nav className="site-header-nav flex max-[1100px]:hidden">
              {currentUser &&
                (!currentUser.role ||
                  currentUser.role === "customer" ||
                  currentUser.role === "admin") && (
                  <NavLink to="/menu" className="site-header-link">
                    Catálogo
                  </NavLink>
                )}

              {currentUser?.role === "kitchen" && (
                <NavLink to="/cozinha" className="site-header-link">
                  Pedidos Cozinha
                </NavLink>
              )}

              {currentUser?.role === "admin" && !isAdminArea && (
                <NavLink to="/admin/login" className="site-header-link">
                  Ir para Admin
                </NavLink>
              )}

              {currentUser?.role === "admin" && isAdminArea && adminLinks}
            </nav>

            {isCustomerRole && (
              <>
                <button
                  type="button"
                  className="site-header-icon-btn"
                  onClick={() => navigate("/favoritos")}
                  aria-label="Meus favoritos"
                  title="Favoritos"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="21"
                    height="21"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 20.727c-.39 0-.78-.146-1.076-.438L4.318 13.72C2.83 12.25 2.83 9.868 4.318 8.4c1.487-1.47 3.898-1.47 5.385 0L12 10.667l2.297-2.267c1.487-1.47 3.898-1.47 5.385 0 1.487 1.469 1.487 3.85 0 5.319l-6.606 6.57c-.296.292-.686.438-1.076.438z"
                    />
                  </svg>
                  {favoriteIds.length > 0 && (
                    <span className="site-header-badge">
                      {favoriteIds.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className="site-header-icon-btn"
                  onClick={handleCartClick}
                  aria-label="Abrir carrinho"
                  title="Carrinho"
                  aria-pressed={isCartOpen}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="21"
                    height="21"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 6h15l-1.5 9h-12z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 6L5 3H2M9 10V6a3 3 0 016 0v4"
                    />
                    <circle cx="9" cy="20" r="1.5" />
                    <circle cx="18" cy="20" r="1.5" />
                  </svg>
                  {cartCount > 0 && (
                    <span className="site-header-badge">{cartCount}</span>
                  )}
                </button>
              </>
            )}

            {/* Hamburguer (<1100px) */}
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="site-header-hamburger hidden max-[1100px]:inline-flex"
              aria-label="Abrir menu"
              title="Menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {/* Conta (Desktop) */}
            <div className="site-header-account flex max-[1100px]:hidden">
              {currentUser ? (
                <>
                  <div className="site-header-divider" />
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:block text-right leading-tight">
                      <p className="site-header-hello">Olá,</p>
                      <p className="site-header-username truncate max-w-[100px]">
                        {currentUser.name}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate("/register?edit=1")}
                      className="site-header-chip"
                      title="Editar meus dados"
                    >
                      Editar meus dados
                    </button>
                    <NavLink
                      to="/meus-pedidos"
                      className="site-header-chip site-header-chip-alt"
                      title="Meus Pedidos"
                    >
                      <span>📦</span>
                      <span>Meus Pedidos</span>
                    </NavLink>
                    <button
                      onClick={handleLogout}
                      className="site-header-icon-btn"
                      title="Sair"
                      aria-label="Sair"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <NavLink to="/login" className="site-header-guest-link">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path
                      strokeLinecap="round"
                      d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"
                    />
                  </svg>
                  <span>Entre ou Cadastre-se</span>
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <div className="site-header-mobile site-header-dark min-[1101px]:hidden">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
            {(isCustomerRole || currentUser?.role === "admin") && (
              <form
                className="site-header-search site-header-search-mobile flex"
                onSubmit={handleSearchSubmit}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Buscar pelúcias..."
                  aria-label="Buscar produtos"
                />
              </form>
            )}

            {currentUser &&
              (!currentUser.role ||
                currentUser.role === "customer" ||
                currentUser.role === "admin") && (
                <NavLink to="/menu" className="site-header-mobile-link">
                  Catálogo
                </NavLink>
              )}

            {currentUser?.role === "kitchen" && (
              <NavLink to="/cozinha" className="site-header-mobile-link">
                Pedidos Cozinha
              </NavLink>
            )}

            {currentUser?.role === "admin" && !isAdminArea && (
              <NavLink to="/admin/login" className="site-header-mobile-link">
                Ir para Admin
              </NavLink>
            )}

            {currentUser?.role === "admin" && isAdminArea && mobileAdminLinks}

            {currentUser ? (
              <>
                <div className="site-header-divider" />
                <p className="site-header-hello">
                  Olá,{" "}
                  <span className="site-header-username">
                    {currentUser.name}
                  </span>
                </p>
                <button
                  onClick={() => navigate("/register?edit=1")}
                  className="site-header-mobile-link text-left"
                >
                  Editar meus dados
                </button>
                <NavLink to="/meus-pedidos" className="site-header-mobile-link">
                  Meus Pedidos
                </NavLink>
                {isCustomerRole && (
                  <NavLink to="/favoritos" className="site-header-mobile-link">
                    Favoritos{" "}
                    {favoriteIds.length > 0 ? `(${favoriteIds.length})` : ""}
                  </NavLink>
                )}
                <button
                  onClick={handleLogout}
                  className="site-header-mobile-link text-left"
                >
                  Sair
                </button>
              </>
            ) : (
              <NavLink to="/login" className="site-header-mobile-link">
                Entre ou Cadastre-se
              </NavLink>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
