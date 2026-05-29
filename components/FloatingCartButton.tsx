import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";

const FloatingCartButton: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { store } = useStore();

  // Only show if user is logged in and not admin/kitchen
  if (!currentUser || currentUser.role === "admin" || currentUser.role === "kitchen") return null;

  return (
    <button
      className="floating-cart-btn"
      onClick={() => navigate("/payment")}
      aria-label="Abrir carrinho"
    >
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.35 2.7A1 1 0 007 17h10a1 1 0 00.95-.68L21 9M7 13V6a1 1 0 011-1h5a1 1 0 011 1v7" />
      </svg>
    </button>
  );
};

export default FloatingCartButton;
