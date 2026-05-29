import { API_BASE_URL } from "../services/apiBase";
import React, { useEffect, useState } from "react";
import "../assets/animated-gradient.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import type { User } from "../types";

interface CPFLoginProps {
  onBack: () => void;
  onLoginSuccess: (user: User) => void;
}

const API_URL = API_BASE_URL;

const PlushBackground: React.FC = () => (
  <>
    <div className="plush-lane plush-lane-one" aria-hidden="true">
      🧸 🐻 🐰 🦊 🧸 🐼 🐻 🐰 🧸 🐻 🐰 🦊 🧸 🐼 🐻 🐰 🧸 🐻 🐰 🦊 🧸 🐼 🐻 🐰
    </div>
    <div className="plush-lane plush-lane-two" aria-hidden="true">
      🐼 🧸 🐰 🐻 🦄 🧸 🦊 🐻 🐼 🧸 🐰 🐻 🦄 🧸 🦊 🐻 🐼 🧸 🐰 🐻 🦄 🧸 🦊 🐻
    </div>
    <div className="plush-lane plush-lane-three" aria-hidden="true">
      🦄 🐻 🧸 🐼 🐰 🦊 🧸 🐻 🦄 🐻 🧸 🐼 🐰 🦊 🧸 🐻 🦄 🐻 🧸 🐼 🐰 🦊 🧸 🐻
    </div>
    <div className="tech-grid" aria-hidden="true" />
  </>
);

const CPFLogin: React.FC<CPFLoginProps> = ({ onLoginSuccess }) => {
  const [documentInput, setDocumentInput] = useState("");
  const [cleanedDoc, setCleanedDoc] = useState("");
  const [requiresRegistration, setRequiresRegistration] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [cep, setCep] = useState("");
  const [phone, setPhone] = useState("");

  const formatDocument = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return cleaned
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const validateDocument = () => {
    const clean = documentInput.replace(/\D/g, "");
    if (clean.length !== 11 && clean.length !== 14) {
      setError("Documento invalido. Digite 11 digitos (CPF) ou 14 (CNPJ).");
      return "";
    }
    setCleanedDoc(clean);
    return clean;
  };

  const handleDocChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentInput(formatDocument(event.target.value));
    setError("");
  };

  const openRegistration = () => {
    const clean = validateDocument();
    if (!clean) return;
    setPassword("");
    setRequiresRegistration(true);
    setError("");
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = validateDocument();
    if (!clean) return;
    if (!password.trim()) {
      setError("Digite sua senha.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: clean, password }),
      });
      const data = await response.json();
      if (response.ok && data.user) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || "Documento ou senha incorretos.");
      }
    } catch {
      setError("Erro ao autenticar.");
    } finally {
      setIsLoading(false);
    }
  };

  const registerUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = cleanedDoc || validateDocument();
    if (!clean) return;
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Preencha nome, e-mail e senha.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: clean,
          name: name.trim(),
          email: email.trim(),
          address: address.trim(),
          cep: cep.trim(),
          phone: phone.trim(),
          password: password.trim(),
          role: "customer",
        }),
      });
      const data = await response.json();
      if (response.ok && data.user) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || "Erro ao cadastrar.");
      }
    } catch {
      setError("Erro de rede ao cadastrar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-tech-bg flex min-h-screen items-center justify-center overflow-hidden">
      <PlushBackground />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/70 bg-white/92 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-stone-900">
            {requiresRegistration ? "Criar conta" : "Point&Point"}
          </h1>
          <p className="text-stone-600">
            {requiresRegistration
              ? "Complete seus dados"
              : "Entre com CPF/CNPJ e senha"}
          </p>
        </div>

        {!requiresRegistration ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">
                CPF ou CNPJ
              </label>
              <input
                type="text"
                value={documentInput}
                onChange={handleDocChange}
                placeholder="000.000.000-00"
                className="w-full rounded-lg border-2 border-stone-200 px-4 py-3 text-lg transition-colors focus:border-purple-700 focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">
                Senha
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="Sua senha"
                className="w-full rounded-lg border-2 border-stone-200 px-4 py-3 transition-colors focus:border-purple-700 focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-purple-700">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-purple-700 py-3 text-lg font-bold text-white transition-colors hover:bg-purple-800 disabled:bg-purple-300"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>

            <button
              type="button"
              onClick={openRegistration}
              className="w-full text-sm font-semibold text-stone-600 hover:text-purple-800"
            >
              Criar conta
            </button>
          </form>
        ) : (
          <form
            onSubmit={registerUser}
            className="max-h-[60vh] space-y-4 overflow-y-auto px-1"
          >
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome completo"
              className="w-full rounded-lg border px-4 py-2"
            />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="E-mail"
              className="w-full rounded-lg border px-4 py-2"
            />
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Endereco"
              className="w-full rounded-lg border px-4 py-2"
            />
            <input
              type="text"
              value={cep}
              onChange={(event) => setCep(event.target.value)}
              placeholder="CEP"
              className="w-full rounded-lg border px-4 py-2"
            />
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Telefone"
              className="w-full rounded-lg border px-4 py-2"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Crie uma senha"
              className="w-full rounded-lg border px-4 py-2"
            />
            {error && <p className="text-sm text-purple-700">{error}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-purple-700 py-3 font-bold text-white hover:bg-purple-800 disabled:bg-purple-300"
            >
              {isLoading ? "Cadastrando..." : "Cadastrar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRequiresRegistration(false);
                setError("");
              }}
              className="w-full text-sm text-stone-500"
            >
              Voltar
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

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
