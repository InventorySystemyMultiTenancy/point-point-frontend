import React, { useEffect, useMemo, useState } from "react";
import "../assets/animated-gradient.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { employeeLogin, saveToken } from "../services/apiService";
import type { User } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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

const PlushBackground: React.FC = () => {
  const plushies = useMemo(
    () => [
      "\u{1F9F8}",
      "\u{1F43B}",
      "\u{1F430}",
      "\u{1F984}",
      "\u{1F43C}",
      "\u{1F9F8}",
      "\u{1F43B}\u{200D}\u{2744}\u{FE0F}",
      "\u{1F428}",
      "\u{1F98A}",
      "\u{1F43B}",
      "\u{1F9F8}",
      "\u{1F430}",
    ],
    [],
  );

  return (
    <div className="plush-orbit" aria-hidden="true">
      {plushies.map((emoji, index) => (
        <span
          key={`${emoji}-${index}`}
          className={`plush-emoji ${index % 2 === 0 ? "move-right" : "move-left"}`}
          style={
            {
              "--top": `${8 + ((index * 11) % 82)}%`,
              "--delay": `${index * -1.7}s`,
              "--size": `${2.1 + (index % 4) * 0.42}rem`,
              "--duration": `${16 + (index % 5) * 3}s`,
            } as React.CSSProperties
          }
        >
          {emoji}
        </span>
      ))}
    </div>
  );
};

const LoginPage: React.FC = () => {
  const { login, currentUser } = useAuth();
  const { clearCart } = useCart();
  const navigate = useNavigate();
  const [documentInput, setDocumentInput] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginKind, setLoginKind] = useState<"customer" | "employee">(
    "customer",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [cep, setCep] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentUser) navigate("/menu");
  }, [currentUser, navigate]);

  const ensureAdminToken = async (user: User, apiToken?: string) => {
    if (apiToken) {
      saveToken(apiToken);
      return;
    }

    if (user.role !== "admin") return;

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin", password: password.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.token) {
      saveToken(data.token);
    }
  };

  const handleLoginSuccess = async (user: User, apiToken?: string) => {
    await ensureAdminToken(user, apiToken);
    clearCart();
    login(user);
    navigate("/menu");
  };

  const cleanDoc = documentInput.replace(/\D/g, "");

  const validateDocumentAndPassword = () => {
    if (mode === "login" && loginKind === "employee") {
      if (!documentInput.trim()) {
        setError("Digite seu nome de usuario.");
        return false;
      }
      if (!password.trim()) {
        setError("Digite sua senha.");
        return false;
      }
      return true;
    }

    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      setError("Digite um CPF ou CNPJ valido.");
      return false;
    }
    if (!password.trim()) {
      setError("Digite sua senha.");
      return false;
    }
    return true;
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!validateDocumentAndPassword()) return;

    setIsLoading(true);
    try {
      if (loginKind === "employee") {
        const success = await employeeLogin(documentInput.trim(), password);
        if (!success) {
          setError("Usuario ou senha incorretos.");
          return;
        }
        clearCart();
        navigate("/employee", { replace: true });
        return;
      }

      const response = await fetch(`${API_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cleanDoc, password: password.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.user) {
        await handleLoginSuccess(data.user, data.token);
        return;
      }
      setError(data.error || data.message || "CPF/CNPJ ou senha incorretos.");
    } catch {
      setError("Erro ao conectar com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!validateDocumentAndPassword()) return;
    setLoginKind("customer");
    if (!name.trim() || !email.trim()) {
      setError("Preencha nome e email para cadastrar.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: cleanDoc,
          name: name.trim(),
          email: email.trim(),
          address: address.trim(),
          cep: cep.trim(),
          phone: phone.trim(),
          password: password.trim(),
          role: "customer",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.user) {
        await handleLoginSuccess(data.user, data.token);
        return;
      }
      setError(data.error || data.message || "Erro ao cadastrar.");
    } catch {
      setError("Erro de rede ao cadastrar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-screen animated-gradient">
      <PlushBackground />
      <section className="login-glass-card w-full max-w-md rounded-2xl p-7 shadow-2xl sm:p-9">
        <div className="mb-7 text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.22em] text-amber-100">
            Point&Point
          </p>
          <h1 className="text-3xl font-bold text-white">
            {mode === "login"
              ? loginKind === "employee"
                ? "Entrar como funcionario"
                : "Entrar na loja"
              : "Criar cadastro"}
          </h1>
          <p className="mt-2 text-sm text-amber-100/90">
            Pelucias, presentes e fofura em poucos cliques.
          </p>
        </div>

        <form
          onSubmit={mode === "login" ? handleLogin : handleRegister}
          className="space-y-4"
        >
          {mode === "login" && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/10 p-1">
              <button
                type="button"
                onClick={() => {
                  setLoginKind("customer");
                  setDocumentInput("");
                  setError("");
                }}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                  loginKind === "customer"
                    ? "bg-purple-700 text-white"
                    : "text-amber-100 hover:bg-white/10"
                }`}
              >
                Cliente
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginKind("employee");
                  setDocumentInput("");
                  setError("");
                }}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                  loginKind === "employee"
                    ? "bg-purple-700 text-white"
                    : "text-amber-100 hover:bg-white/10"
                }`}
              >
                Funcionario
              </button>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-amber-50">
              {mode === "login" && loginKind === "employee"
                ? "Nome de usuario"
                : "CPF ou CNPJ"}
            </span>
            <input
              type="text"
              value={documentInput}
              onChange={(event) => {
                setDocumentInput(
                  mode === "login" && loginKind === "employee"
                    ? event.target.value
                    : formatDocument(event.target.value),
                );
                setError("");
              }}
              placeholder={
                mode === "login" && loginKind === "employee"
                  ? "usuario"
                  : "000.000.000-00"
              }
              autoComplete="username"
              className="login-input w-full rounded-lg border-2 px-4 py-3 text-base transition-colors focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-amber-50">
              Senha
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              placeholder="Sua senha"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className="login-input w-full rounded-lg border-2 px-4 py-3 text-base transition-colors focus:outline-none"
            />
          </label>

          {mode === "register" && (
            <div className="grid gap-3">
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome completo"
                autoComplete="name"
                className="login-input w-full rounded-lg border px-4 py-2.5"
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                autoComplete="email"
                className="login-input w-full rounded-lg border px-4 py-2.5"
              />
              <input
                type="text"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Telefone"
                autoComplete="tel"
                className="login-input w-full rounded-lg border px-4 py-2.5"
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_0.6fr]">
                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Endereco"
                  autoComplete="street-address"
                  className="login-input w-full rounded-lg border px-4 py-2.5"
                />
                <input
                  type="text"
                  value={cep}
                  onChange={(event) => setCep(event.target.value)}
                  placeholder="CEP"
                  autoComplete="postal-code"
                  className="login-input w-full rounded-lg border px-4 py-2.5"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-300/40 bg-red-950/35 px-3 py-2 text-sm font-semibold text-red-100">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-purple-700 py-3 font-bold text-white shadow-lg shadow-purple-950/40 transition-colors hover:bg-purple-800 disabled:bg-purple-300"
          >
            {isLoading
              ? "Carregando..."
              : mode === "login"
                ? "Entrar"
                : "Cadastrar"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((current) => {
              const next = current === "login" ? "register" : "login";
              if (next === "register") setLoginKind("customer");
              return next;
            });
            setDocumentInput("");
            setError("");
          }}
          className="mt-5 w-full text-sm font-semibold text-amber-100 hover:text-white"
        >
          {mode === "login"
            ? "Ainda nao tenho cadastro"
            : "Ja tenho cadastro"}
        </button>
      </section>
    </main>
  );
};

export default LoginPage;

