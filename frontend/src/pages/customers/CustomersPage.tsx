import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import CustomerList from "./CustomerList";

export default function CustomersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<"success" | "error" | "warning">("success");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
      setType(location.state.type || "success");

      window.history.replaceState({}, document.title);

      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  }, [location]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="text-base font-semibold text-teal-700 order-1">
          Clientes
        </div>

        <div className="relative w-full xs:flex-1 max-w-[480px] min-w-[160px] order-2 xs:order-2 transition-all">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone..."
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-teal-600 transition-colors"
          />

          <Search
            size={14}
            className="absolute left-2.5 top-2.5 text-slate-400"
          />
        </div>

        <button
          onClick={() => navigate("/clientes/novo")}
          className="bg-teal-700 text-white px-4 py-1.5 text-xs rounded hover:bg-teal-800 order-3 xs:order-3 transition-colors shrink-0"
        >
          Novo Cliente
        </button>
      </div>

      {message && (
        <div className="absolute right-0 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div
            className={`w-fit max-w-sm px-3.5 py-2 rounded-xl text-xs font-medium border shadow-lg backdrop-blur-sm ${
              type === "error"
                ? "bg-rose-50/95 border-rose-100 text-rose-800 shadow-rose-500/5"
                : type === "warning"
                ? "bg-amber-50/95 border-amber-100 text-amber-800 shadow-amber-500/5"
                : "bg-emerald-50/95 border-emerald-100 text-emerald-800 shadow-emerald-500/5"
            }`}
          >
            {message}
          </div>
        </div>
      )}

      <CustomerList searchTerm={searchTerm} />
    </div>
  );
}