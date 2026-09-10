import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone } from "lucide-react";
import type { Customer } from "../../../types/Customer";

interface CustomerFormProps {
  initialData?: Customer | null;
  onSave: (payload: Omit<Customer, "id">) => Promise<void>;
  title: string;
}

export default function CustomerForm({
  initialData,
  onSave,
  title,
}: CustomerFormProps) {
  const navigate = useNavigate();

  const [name, setName] = useState(initialData?.name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [formError, setFormError] = useState(false);

  useEffect(() => {
    setName(initialData?.name || "");
    setEmail(initialData?.email || "");
    setPhone(initialData?.phone || "");
  }, [initialData]);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setFormError(true);
      return;
    }

    setFormError(false);

    await onSave({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
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
          <User className="text-teal-600" size={16} />
          <h3 className="text-sm font-bold text-slate-800">
            Dados do Cliente
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Nome
            </label>

            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
                className={`w-full text-xs border rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all ${
                  formError && !name.trim()
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

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              E-mail
            </label>

            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Telefone
            </label>

            <div className="relative">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className={`w-full text-xs border rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all ${
                  formError && !phone.trim()
                    ? "border-rose-400 bg-rose-50/50"
                    : "border-slate-200"
                }`}
              />

              <Phone
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
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
              onClick={() => navigate("/clientes")}
              className="px-5 border border-slate-200 text-slate-600 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleSubmit}
              className="px-5 bg-teal-600 text-white py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-teal-700 active:scale-[0.98] transition-all"
            >
              {initialData ? "Alterar Cliente" : "Gravar Cliente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}