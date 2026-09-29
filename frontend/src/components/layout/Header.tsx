import { useEffect, useRef, useState } from "react";
import { Menu, User, Sun, Moon, ChevronDown, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getUser, logout } from "../../services/authService";
import {
  getResolvedTheme,
  subscribeTheme,
  toggleTheme,
} from "../../services/themeService";

interface Props {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  title: string;
}

export default function Header({ isOpen, setIsOpen, title }: Props) {
  const user = getUser();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(getResolvedTheme() === "dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setIsDark(getResolvedTheme() === "dark");
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="h-16 bg-white dark:bg-slate-100 border-b border-slate-100 dark:border-slate-200 px-4 sm:px-6 flex items-center justify-between z-20 shadow-sm gap-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-200 hover:text-teal-700 dark:hover:text-teal-400 transition-colors shrink-0"
      >
        <Menu size={22} />
      </button>

      <div className="flex-1 text-center text-sm sm:text-base text-slate-800 font-bold tracking-wide truncate px-2">
        {title}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => toggleTheme()}
          title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-200 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((value) => !value)}
            title="Menu do usuário"
            className="flex items-center gap-2 bg-slate-50 dark:bg-slate-200 px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-300 hover:border-teal-200 dark:hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-slate-200 transition-colors max-w-[160px] sm:max-w-none"
          >
            <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center text-[#fff] shrink-0">
              <User size={12} />
            </div>
            <span className="text-xs font-medium text-slate-700 truncate">
              <span className="hidden xs:inline">Bem vindo, </span>
              {user?.first_name || user?.email}
            </span>
            <ChevronDown
              size={13}
              className={`text-slate-400 transition-transform ${
                menuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-100 border border-slate-100 dark:border-slate-400 rounded-xl shadow-lg py-1.5 animate-in fade-in zoom-in-95 duration-150">
              <Link
                to="/perfil"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-300 transition-colors"
              >
                <User size={14} className="text-slate-400" />
                Meu Perfil
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-100/40 transition-colors"
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}