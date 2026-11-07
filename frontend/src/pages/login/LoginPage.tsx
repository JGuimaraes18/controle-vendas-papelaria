import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../services/authService";
import { DEMO_ACCOUNTS } from "../../services/demoAccounts";
import { Mail, Lock, AlertCircle, Shield, User } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Preencha email e senha.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login({ email, password });

      navigate("/");
    } catch (err: any) {
      console.error(err);
      setError("Credenciais inválidas. Verifique seus dados.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoId: "ADMIN" | "SELLER") => {
    const demo = DEMO_ACCOUNTS[demoId];
    setEmail(demo.email);
    setPassword(demo.password);
    setActiveDemo(demoId);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-[380px] bg-white border border-slate-100 rounded-2xl shadow-xl p-8 transition-all">

        <div className="flex flex-col items-center mb-6 text-center">
          <div className="text-lg font-bold text-slate-800">CIVEN – Centralização e Inteligência de Vendas e Negócios</div>
          <p className="text-xs text-slate-400 mt-0.5">Faça login para acessar o painel</p>
        </div>

        <div className="mb-6 rounded-xl bg-slate-50 border border-slate-100 p-4">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-3">
            Experimente o CIVEN
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fillDemo("ADMIN")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all active:scale-[0.99] ${
                activeDemo === "ADMIN"
                  ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-black"
              }`}
            >
              <div
                className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${
                  activeDemo === "ADMIN" ? "bg-teal-600 text-teal-900" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Shield size={15} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-700">Acessar como Administrador</div>
                <div className="text-[10px] text-slate-400 truncate">
                  Visão geral e gestão completa do sistema
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => fillDemo("SELLER")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all active:scale-[0.99] ${
                activeDemo === "SELLER"
                  ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div
                className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${
                  activeDemo === "SELLER" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                <User size={15} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-700">Acessar como Vendedor</div>
                <div className="text-[10px] text-slate-400 truncate">
                  Experiência do vendedor com acesso restrito
                </div>
              </div>
            </button>
          </div>
          <p className="text-[9px] text-slate-400 mt-2.5">
            As credenciais serão preenchidas no formulário. Clique em "Acessar Conta" para entrar.
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2.5 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
          className="space-y-4"
        >
          <div className="flex flex-col">
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
              E-mail
            </label>
            <div className="relative flex items-center">
              <Mail size={14} className="absolute left-0.5 text-slate-400" />
              <input
                type="email"
                className="w-full border-b border-slate-200 pl-6 py-2 text-xs text-slate-700 placeholder-slate-300 bg-transparent outline-none focus:border-teal-600 transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                required
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
              Senha
            </label>
            <div className="relative flex items-center">
              <Lock size={14} className="absolute left-0.5 text-slate-400" />
              <input
                type="password"
                className="w-full border-b border-slate-200 pl-6 py-2 text-xs text-slate-700 placeholder-slate-300 bg-transparent outline-none focus:border-teal-600 transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-700 hover:bg-teal-800 text-[#fff] py-2 rounded-xl text-xs font-semibold shadow-md shadow-teal-700/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 h-9"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/20 border-b-white"></div>
                  <span>Autenticando...</span>
                </>
              ) : (
                <span>Acessar Conta</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
