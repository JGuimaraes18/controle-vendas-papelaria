import { NavLink, useNavigate } from "react-router-dom";
import { ChevronRight, Percent, ShoppingCart, LogOut, Users, Package, UserRound } from "lucide-react";
import { isAdmin, logout } from "../../services/authService";

interface Props {
  isOpen: boolean;
}

export default function Sidebar({ isOpen }: Props) {
  const navigate = useNavigate();

  const baseClass =
    "mx-2 my-1 text-xs flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200";

  const activeClass = "bg-teal-50 text-teal-700 font-semibold border-l-4 border-teal-600 rounded-l-none";
  const inactiveClass = "text-slate-600 hover:bg-slate-50 hover:text-slate-900";

  const items = [
    { label: "Vendas", icones: ShoppingCart, to: "/" },
    { label: "Clientes", icones: Users, to: "/clientes" },
    { label: "Produtos", icones: Package, to: "/produtos" },
    ...(isAdmin()
      ? [
          { label: "Vendedores", icones: UserRound, to: "/vendedores" },
          { label: "Comissões", icones: Percent, to: "/comissoes" },
        ]
      : []),
  ];

  return (
    <div
      className={`
        bg-white border-r border-slate-100
        transition-all duration-300 ease-in-out
        ${isOpen ? "w-48" : "w-16"}
        flex flex-col h-full z-10
      `}
    >
      <nav className="flex flex-col flex-1 py-4 justify-between">
        <div className="space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${baseClass} ${isActive ? activeClass : inactiveClass}`
              }
            >
              <div className="flex items-center gap-3">
                <item.icones size={18} className={isOpen ? "" : "mx-auto"} />
                {isOpen && <span>{item.label}</span>}
              </div>

              {isOpen && <ChevronRight size={14} className="opacity-50" />}
            </NavLink>
          ))}
        </div>

        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="mx-2 p-2.5 text-xs flex items-center justify-start gap-2 bg-slate-50 text-rose-600 rounded-lg hover:bg-rose-50 hover:text-rose-700 transition-all font-medium border border-slate-100"
        >
          <LogOut size={16} />
          {isOpen && <span>Sair</span>}
        </button>
      </nav>
    </div>
  );
}