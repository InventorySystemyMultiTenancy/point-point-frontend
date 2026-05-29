import React, { useState, useEffect } from "react";
import "../assets/animated-gradient.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";

import type { User } from "../types";

// --- Componente WelcomeScreen (Mantido conforme original) ---
interface WelcomeScreenProps {
  onNameSubmit: (name: string) => void;
  isLoading?: boolean;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNameSubmit, isLoading = false }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Por favor, digite seu nome");
      return;
    }
    onNameSubmit(trimmedName);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen animated-gradient p-4">
      <div className="login-glass-card w-full max-w-md rounded-2xl shadow-2xl p-10">
        <div className="text-center mb-8">
          <img src="/selfMachine.jpg" alt="Self Machine" className="w-48 h-auto mx-auto mb-6 rounded-xl" />
          <h1 className="text-4xl font-bold text-white mb-2">Pastel Kiosk</h1>
          <p className="text-blue-100">Bem-vindo a nossa deliciosa experiencia!</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-blue-100 mb-2">Como voce se chama?</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="Digite seu nome"
              className="login-input w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors"
              autoFocus
              disabled={isLoading}
            />
            {error && <p className="text-blue-200 text-sm mt-2">{error}</p>}
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg disabled:bg-blue-300 shadow-lg shadow-blue-950/40">
            {isLoading ? "Carregando..." : "Começar Pedido"}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Componente Login por Documento (CPF/CNPJ) ---
interface CPFLoginProps {
  onBack: () => void;
  onLoginSuccess: (user: User) => void;
}

const CPFLogin: React.FC<CPFLoginProps> = ({ onBack, onLoginSuccess }) => {
  const navigate = useNavigate();
  
  // Estados do Formulário
  const [documentInput, setDocumentInput] = useState("");
  const [cleanedDoc, setCleanedDoc] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requiresRegistration, setRequiresRegistration] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Estados dos Campos de Cadastro
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [cep, setCep] = useState("");
  const [phone, setPhone] = useState("");
  const [userFound, setUserFound] = useState<User | null>(null);

  const formatDocument = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      return cleaned
        .slice(0, 14)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentInput(formatDocument(e.target.value));
    setError("");
    setRequiresRegistration(false);
  };

  const checkDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = documentInput.replace(/\D/g, "");
    if (clean.length !== 11 && clean.length !== 14) {
      setError("Documento inválido. Digite 11 dígitos (CPF) ou 14 (CNPJ).");
      return;
    }
    setIsLoading(true);
    setError("");
    setCleanedDoc(clean);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/users/check-cpf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: clean }),
      });
      if (!response.ok) throw new Error("Erro ao verificar documento");
      const data = await response.json();

      if (data.exists && data.user) {
        setUserFound(data.user);
        setShowPassword(true);
      } else {
        setRequiresRegistration(true);
      }
    } catch (err) {
      setError("Erro ao verificar documento. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const registerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Preencha os campos obrigatórios.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: cleanedDoc,
          name: name.trim(),
          email: email.trim(),
          address: address.trim(),
          cep: cep.trim(),
          phone: phone.trim(),
          password: password.trim(),
          role: "customer"
        }),
      });
      const data = await response.json();
      if (response.ok && data.user) onLoginSuccess(data.user);
      else setError(data.error || "Erro ao cadastrar");
    } catch (err) {
      setError("Erro de rede ao cadastrar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cleanedDoc, password }),
      });
      const data = await response.json();
      if (response.ok && data.user) onLoginSuccess(data.user);
      else setError(data.error || "Senha incorreta.");
    } catch (err) {
      setError("Erro ao autenticar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen animated-gradient p-4">
      <div className="login-glass-card w-full max-w-md rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {requiresRegistration ? "Cadastrar Conta" : showPassword ? "Digite sua senha" : "Fazer Login"}
          </h1>
          <p className="text-blue-100">
            {requiresRegistration ? "Complete seu cadastro" : showPassword ? `Olá, ${userFound?.name}!` : "CPF ou CNPJ para começar"}
          </p>
        </div>

        {/* FLUXO INICIAL (DOCUMENTO) */}
        {!requiresRegistration && !showPassword && (
          <form onSubmit={checkDocument} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-blue-100 mb-2">CPF ou CNPJ</label>
              <input
                type="text"
                value={documentInput}
                onChange={handleDocChange}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className="login-input w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors text-lg"
              />
              {error && <p className="text-blue-200 text-sm mt-2">{error}</p>}
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-950/40">
              {isLoading ? "Verificando..." : "Continuar"}
            </button>
          </form>
        )}

        {/* FLUXO SENHA */}
        {showPassword && (
          <form onSubmit={handleLoginWithPassword} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-blue-100 mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="login-input w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors"
                autoFocus
              />
              {error && <p className="text-blue-200 text-sm mt-2">{error}</p>}
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-950/40">Entrar</button>
            <button type="button" onClick={() => setShowPassword(false)} className="w-full text-sm text-blue-100 hover:text-white">Voltar</button>
          </form>
        )}

        {/* FLUXO CADASTRO */}
        {requiresRegistration && (
          <form onSubmit={registerUser} className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome Completo" className="login-input w-full px-4 py-2 border rounded-lg" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="login-input w-full px-4 py-2 border rounded-lg" />
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Endereco" className="login-input w-full px-4 py-2 border rounded-lg" />
            <input type="text" value={cep} onChange={e => setCep(e.target.value)} placeholder="CEP" className="login-input w-full px-4 py-2 border rounded-lg" />
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefone" className="login-input w-full px-4 py-2 border rounded-lg" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Crie uma senha" className="login-input w-full px-4 py-2 border rounded-lg" />
            {error && <p className="text-blue-200 text-sm">{error}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-950/40">Cadastrar</button>
            <button type="button" onClick={() => setRequiresRegistration(false)} className="w-full text-sm text-blue-100 hover:text-white">Voltar</button>
          </form>
        )}
      </div>
    </div>
  );
};

// --- Componente LoginPage Principal ---
const LoginPage: React.FC = () => {
  const { login, currentUser } = useAuth();
  const { clearCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) navigate("/menu");
  }, [currentUser, navigate]);

  const handleLoginSuccess = (user: User) => {
    clearCart();
    login(user);
    navigate("/menu");
  };

  return <CPFLogin onBack={() => {}} onLoginSuccess={handleLoginSuccess} />;
};

export default LoginPage;
