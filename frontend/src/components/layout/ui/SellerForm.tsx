import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserRound,
  User,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  ToggleLeft,
} from "lucide-react";

type SellerGroup = "ADMIN" | "SELLER";

export interface SellerFormData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone: string;
  is_active: boolean;
  group: SellerGroup;
}

interface SellerFormProps {
  title: string;
  initialData?: Partial<SellerFormData>;
  onSave: (data: SellerFormData) => Promise<void>;
}

export default function SellerForm({
  title,
  initialData,
  onSave,
}: SellerFormProps) {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(
    initialData?.first_name || ""
  );

  const [lastName, setLastName] = useState(
    initialData?.last_name || ""
  );

  const [email, setEmail] = useState(
    initialData?.email || ""
  );

  const [password, setPassword] = useState("");

  const [phone, setPhone] = useState(
    initialData?.phone || ""
  );

  const [group, setGroup] = useState<SellerGroup>(
    initialData?.group || "SELLER"
  );

  const [isActive, setIsActive] = useState(
    initialData?.is_active ?? true
  );

  const [formError, setFormError] = useState(false);

  useEffect(() => {
    setFirstName(initialData?.first_name || "");
    setLastName(initialData?.last_name || "");
    setEmail(initialData?.email || "");
    setPassword("");
    setPhone(initialData?.phone || "");
    setGroup(initialData?.group || "SELLER");
    setIsActive(initialData?.is_active ?? true);
  }, [initialData]);

  const handleSubmit = async () => {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim()
    ) {
      setFormError(true);
      return;
    }

    setFormError(false);

    await onSave({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      password,
      phone: phone.trim(),
      group,
      is_active: isActive,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 p-1">
      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
        <div className="text-2xl font-bold text-slate-900">
          {title}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2 mb-4">
          <UserRound
            className="text-teal-600"
            size={16}
          />

          <h3 className="text-sm font-bold text-slate-800">
            Dados do Vendedor
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nome */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Nome
            </label>

            <div className="relative">
              <input
                type="text"
                value={firstName}
                onChange={(e) =>
                  setFirstName(e.target.value)
                }
                placeholder="Nome do vendedor"
                className={`w-full text-xs border rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all ${
                  formError && !firstName.trim()
                    ? "border-rose-400 bg-rose-50/50"
                    : "border-slate-200"
                }`}
              />

              <User
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
              />
            </div>
          </div>

          {/* Sobrenome */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Sobrenome
            </label>

            <div className="relative">
              <input
                type="text"
                value={lastName}
                onChange={(e) =>
                  setLastName(e.target.value)
                }
                placeholder="Sobrenome do vendedor"
                className={`w-full text-xs border rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all ${
                  formError && !lastName.trim()
                    ? "border-rose-400 bg-rose-50/50"
                    : "border-slate-200"
                }`}
              />

              <User
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
              />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              E-mail
            </label>

            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="email@exemplo.com"
                className={`w-full text-xs border rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all ${
                  formError && !email.trim()
                    ? "border-rose-400 bg-rose-50/50"
                    : "border-slate-200"
                }`}
              />

              <Mail
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Telefone
            </label>

            <div className="relative">
              <input
                type="text"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value)
                }
                placeholder="Telefone"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all"
              />

              <Phone
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {initialData
                ? "Nova senha"
                : "Senha"}
            </label>

            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder={
                  initialData
                    ? "Deixe em branco para manter"
                    : "Senha do usuário"
                }
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all"
              />

              <Lock
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
              />
            </div>
          </div>

          {/* Perfil */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Perfil
            </label>

            <div className="relative">
              <select
                value={group}
                onChange={(e) =>
                  setGroup(
                    e.target.value as SellerGroup
                  )
                }
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all appearance-none"
              >
                <option value="SELLER">
                  Vendedor
                </option>

                <option value="ADMIN">
                  Administrador
                </option>
              </select>

              <ShieldCheck
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
              />
            </div>
          </div>

          {/* Status */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Status
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setIsActive(!isActive)
                }
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isActive
                    ? "bg-teal-600"
                    : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    isActive
                      ? "translate-x-4"
                      : "translate-x-1"
                  }`}
                />
              </button>

              <span className="text-xs text-slate-600">
                {isActive
                  ? "Usuário ativo"
                  : "Usuário inativo"}
              </span>

              <ToggleLeft
                size={14}
                className="text-slate-400"
              />
            </div>
          </div>
        </div>

        {formError && (
          <p className="text-[11px] text-rose-500 font-medium mt-3">
            * Preencha todos os campos obrigatórios.
          </p>
        )}

        <div className="pt-4 mt-4 border-t border-slate-100">
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() =>
                navigate("/vendedores")
              }
              className="px-5 border border-slate-200 text-slate-600 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 bg-teal-600 text-white py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-teal-700 active:scale-[0.98] transition-all"
            >
              {initialData
                ? "Alterar Vendedor"
                : "Gravar Vendedor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}