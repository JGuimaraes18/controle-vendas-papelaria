import { useState } from "react";
import type { UserGroup } from "../../../types/User";

interface UserFormData {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  is_active: boolean;
  group: UserGroup;
}

interface UserFormProps {
  title: string;
  initialData?: Partial<UserFormData>;
  onSave: (data: UserFormData) => Promise<void>;
}

export default function UserForm({
  title,
  initialData,
  onSave,
}: UserFormProps) {
  const [form, setForm] = useState<UserFormData>({
    email: initialData?.email ?? "",
    first_name: initialData?.first_name ?? "",
    last_name: initialData?.last_name ?? "",
    password: "",
    is_active: initialData?.is_active ?? true,
    group: initialData?.group ?? "SELLER",
  });

  const [error, setError] = useState("");

  function handleChange(
    field: keyof UserFormData,
    value: string | boolean
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    if (!form.email || !form.first_name || !form.last_name) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (!initialData && !form.password) {
      setError("Informe uma senha.");
      return;
    }

    try {
      await onSave(form);
    } catch {
      setError("Erro ao salvar usuário.");
    }
  }

  return (
    <div className="p-4">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 max-w-2xl mx-auto">
        <h1 className="text-base font-semibold text-slate-800 mb-4">
          {title}
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nome
            </label>

            <input
              value={form.first_name}
              onChange={(e) =>
                handleChange("first_name", e.target.value)
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Sobrenome
            </label>

            <input
              value={form.last_name}
              onChange={(e) =>
                handleChange("last_name", e.target.value)
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              E-mail
            </label>

            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                handleChange("email", e.target.value)
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Senha
            </label>

            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                handleChange("password", e.target.value)
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              required={!initialData}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Perfil
            </label>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="radio"
                  value="SELLER"
                  checked={form.group === "SELLER"}
                  onChange={() =>
                    handleChange("group", "SELLER")
                  }
                />

                Vendedor
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="radio"
                  value="ADMIN"
                  checked={form.group === "ADMIN"}
                  onChange={() =>
                    handleChange("group", "ADMIN")
                  }
                />

                Administrador
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                handleChange("is_active", e.target.checked)
              }
            />

            Usuário ativo
          </label>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              Salvar
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}