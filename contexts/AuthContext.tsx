import React, { createContext, ReactNode, useContext, useState } from "react";
import type { Order, User } from "../types";
import { logout as apiAdminLogout } from "../services/apiService";

interface AuthContextType {
  currentUser: User | null;
  currentAdmin: User | null;
  login: (user: User) => void;
  adminLogin: (user: User) => void;
  logout: () => Promise<void>;
  adminLogout: () => Promise<void>;
  addOrderToHistory: (order: Order) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredUser(key: string): User | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = readStoredUser("customerUser") || readStoredUser("currentUser");
    if (stored?.role === "admin" || stored?.role === "superadmin") {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("customerUser");
      return null;
    }
    return stored;
  });
  const [currentAdmin, setCurrentAdmin] = useState<User | null>(() =>
    readStoredUser("adminUser"),
  );

  const login = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("customerUser", JSON.stringify(user));
      localStorage.removeItem("currentUser");
    } catch {
      // ignore storage failures
    }
  };

  const adminLogin = (user: User) => {
    setCurrentAdmin(user);
    try {
      localStorage.setItem("adminUser", JSON.stringify(user));
    } catch {
      // ignore storage failures
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem("customerUser");
      localStorage.removeItem("currentUser");
    } catch {
      // ignore storage failures
    }
  };

  const adminLogout = async () => {
    apiAdminLogout();
    setCurrentAdmin(null);
    try {
      localStorage.removeItem("adminUser");
    } catch {
      // ignore storage failures
    }
  };

  const addOrderToHistory = (order: Order) => {
    setCurrentUser((prevUser) => {
      if (!prevUser) return null;
      const next = {
        ...prevUser,
        historico: [...prevUser.historico, order],
      };
      try {
        localStorage.setItem("customerUser", JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentAdmin,
        login,
        adminLogin,
        logout,
        adminLogout,
        addOrderToHistory,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
