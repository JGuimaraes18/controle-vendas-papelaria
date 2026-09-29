import { useEffect, useState } from "react";
import {
  Mail,
  Phone,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  LogIn,
  Palette,
} from "lucide-react";
import { getMe, changePassword } from "../../services/userService";
import type { Profile } from "../../services/userService";
import {
  ACCENTS,
  getAccent,
  getTheme,
  setAccent,
  setTheme,
  subscribeTheme,
} from "../../services/themeService";
import type { AccentName, ThemePreference } from "../../services/themeService";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [theme, setThemePreference] = useState<ThemePreference>(getTheme());
  const [accent, setAccentPreference] = useState<AccentName>(getAccent());

  useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setThemePreference(getTheme());
      setAccentPreference(getAccent());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;

    getMe()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setSuccess(null);
    setErrors({});
    setGeneralError(null);

    try {
      await changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Senha alterada com sucesso.");
    } catch (err: any) {
      const data = err?.response?.data;

      if (typeof data === "object" && data !== null) {
        if (data.detail) {
          setGeneralError(data.detail);
        } else {
          setErrors(data);
        }
      } else {
        setGeneralError("Não foi possível alterar a senha. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const initials = profile
    ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.trim()
        .toUpperCase() || profile.email?.[0]?.toUpperCase()
    : "";

  const roleLabel =
    profile?.groups.includes("ADMIN") === true ? "Administrador" : "Vendedor";

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="text-base font-semibold text-teal-700">Meu Perfil</div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          {loadingProfile ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-teal-600/20 border-b-teal-600"></div>
            </div>
          ) : profile ? (
            <>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-teal-600 flex items-center justify-center text-[#fff] text-xl font-bold shadow-md shadow-teal-700/10">
                  {initials}
                </div>

                <div>
                  <div className="text-sm font-bold text-slate-800">
                    {profile.first_name} {profile.last_name}
                  </div>
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={11} />
                    {roleLabel}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </div>

                {profile.phone && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <Phone size={14} className="text-slate-400 shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 text-center py-8">
              Não foi possível carregar o perfil.
            </div>
          )}
        </div>

        <div className="md:col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={15} className="text-teal-600" />
            <h2 className="text-sm font-bold text-slate-800">
              Alterar Senha
            </h2>
          </div>

          {success && (
            <div className="mb-4 flex items-start gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2.5 rounded-xl">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {generalError && (
            <div className="mb-4 flex items-start gap-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2.5 rounded-xl">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                Senha atual
              </label>
              <div className="relative flex items-center">
                <Lock size={14} className="absolute left-0.5 text-slate-400" />
                <input
                  type="password"
                  className="w-full border-b border-slate-200 pl-6 py-2 text-xs text-slate-700 placeholder-slate-300 bg-transparent outline-none focus:border-teal-600 transition-colors"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {errors.old_password && (
                <p className="mt-1 text-[10px] text-rose-600">
                  {errors.old_password[0]}
                </p>
              )}
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                Nova senha
              </label>
              <div className="relative flex items-center">
                <LogIn size={14} className="absolute left-0.5 text-slate-400" />
                <input
                  type="password"
                  className="w-full border-b border-slate-200 pl-6 py-2 text-xs text-slate-700 placeholder-slate-300 bg-transparent outline-none focus:border-teal-600 transition-colors"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>
              {errors.new_password && (
                <p className="mt-1 text-[10px] text-rose-600">
                  {errors.new_password[0]}
                </p>
              )}
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                Confirmar nova senha
              </label>
              <div className="relative flex items-center">
                <LogIn size={14} className="absolute left-0.5 text-slate-400" />
                <input
                  type="password"
                  className="w-full border-b border-slate-200 pl-6 py-2 text-xs text-slate-700 placeholder-slate-300 bg-transparent outline-none focus:border-teal-600 transition-colors"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                />
              </div>
              {errors.confirm_new_password && (
                <p className="mt-1 text-[10px] text-rose-600">
                  {errors.confirm_new_password[0]}
                </p>
              )}
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:pointer-events-none text-[#fff] px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-teal-700/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 h-9"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/20 border-b-white"></div>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Alterar Senha</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={15} className="text-teal-600" />
          <h2 className="text-sm font-bold text-slate-800">Aparência</h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">
              Tema
            </p>
            <div className="flex flex-wrap gap-2">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    theme === option.value
                      ? "bg-teal-50 text-teal-700 border-teal-200"
                      : "text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">
              Cor de destaque
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENTS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  title={item.label}
                  onClick={() => setAccent(item.name)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                    accent === item.name
                      ? "ring-2 ring-offset-2 ring-slate-400 scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: item.color }}
                  aria-label={item.label}
                >
                  {accent === item.name && (
                    <span className="text-[#fff] text-[10px]">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}