import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { employeeLogin, isEmployeeAuthenticated } from "../services/apiService";
import logo from "../assets/pointpointcorrect.jpg";

const EmployeeLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedMessage = sessionStorage.getItem("employeeAuthMessage");
    if (storedMessage) {
      setMessage(storedMessage);
      sessionStorage.removeItem("employeeAuthMessage");
    }
    if (isEmployeeAuthenticated()) {
      navigate("/employee", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const success = await employeeLogin(username.trim(), password);
      if (!success) {
        setMessage("Usuario ou senha invalidos.");
        return;
      }
      navigate("/employee", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#3b2418] px-4 py-8 text-stone-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <form
          onSubmit={handleSubmit}
          className="w-full rounded-xl border border-purple-200 bg-[#fff6e5] p-7 shadow-2xl"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <img
              src={logo}
              alt="Point&Point"
              className="mb-3 h-20 w-20 rounded-xl object-cover"
            />
            <p className="text-sm font-bold uppercase tracking-wide text-purple-700">
              Point&Point
            </p>
            <h1 className="text-2xl font-bold text-stone-900">
              Acesso de funcionario
            </h1>
          </div>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-semibold text-stone-700">
              Usuario
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoComplete="username"
              className="w-full rounded-lg border border-stone-300 px-4 py-3 focus:border-purple-700 focus:outline-none"
              placeholder="usuario"
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-semibold text-stone-700">
              Senha
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-stone-300 px-4 py-3 focus:border-purple-700 focus:outline-none"
              placeholder="senha"
            />
          </label>

          {message && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full rounded-lg bg-purple-700 px-5 py-3 font-bold text-white shadow hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmployeeLoginPage;
