import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  DollarSign,
  Percent,
  Hash,
  FileText,
  Boxes,
} from "lucide-react";

import type { Product } from "../../../types/Product";
import {
  formatCurrencyInput,
  parseCurrencyInput,
} from "../../../utils/format";

interface ProductFormProps {
  initialData?: Product | null;
  onSave: (
    payload: Omit<Product, "id" | "code">
  ) => Promise<void>;
  title: string;
}

export default function ProductForm({
  initialData,
  onSave,
  title,
}: ProductFormProps) {
  const navigate = useNavigate();

  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [unitPrice, setUnitPrice] = useState(
    formatCurrencyInput(initialData?.unit_price || "")
  );
  const [commissionPercent, setCommissionPercent] = useState(
    initialData?.commission_percent || ""
  );
  const [stockQuantity, setStockQuantity] = useState(
    initialData?.stock_quantity != null
      ? String(initialData.stock_quantity)
      : ""
  );

  const [formError, setFormError] = useState(false);

  useEffect(() => {
    setDescription(initialData?.description || "");
    setUnitPrice(formatCurrencyInput(initialData?.unit_price || ""));
    setCommissionPercent(
      initialData?.commission_percent || ""
    );
    setStockQuantity(
      initialData?.stock_quantity != null
        ? String(initialData.stock_quantity)
        : ""
    );
  }, [initialData]);

  const handleSubmit = async () => {
    if (
      !description.trim() ||
      !unitPrice.trim() ||
      !commissionPercent.trim() ||
      !stockQuantity.trim()
    ) {
      setFormError(true);
      return;
    }

    setFormError(false);

    await onSave({
      description: description.trim(),
      unit_price: parseCurrencyInput(unitPrice),
      commission_percent: commissionPercent.trim(),
      stock_quantity: Number(stockQuantity),
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
          <Package className="text-teal-600" size={16} />

          <h3 className="text-sm font-bold text-slate-800">
            Dados do Produto
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {initialData && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Código
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={initialData.code}
                  disabled
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 pl-8 outline-none bg-slate-100 text-slate-500"
                />

                <Hash
                  size={14}
                  className="absolute left-2.5 top-2.5 text-slate-400"
                />
              </div>
            </div>
          )}

          <div className={initialData ? "" : "md:col-span-2"}>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Descrição
            </label>

            <div className="relative">
              <input
                type="text"
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="Descrição do produto"
                className={`w-full text-xs border rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all ${
                  formError && !description.trim()
                    ? "border-rose-400 bg-rose-50/50"
                    : "border-slate-200"
                }`}
              />

              <FileText
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Preço Unitário
            </label>

            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) =>
                  setUnitPrice(formatCurrencyInput(e.target.value))
                }
                placeholder="0,00"
                className={`w-full text-xs border rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all ${
                  formError && !unitPrice.trim()
                    ? "border-rose-400 bg-rose-50/50"
                    : "border-slate-200"
                }`}
              />

              <DollarSign
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Comissão (%)
            </label>

            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={commissionPercent}
                onChange={(e) =>
                  setCommissionPercent(e.target.value)
                }
                placeholder="0.00"
                className={`w-full text-xs border rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all ${
                  formError && !commissionPercent.trim()
                    ? "border-rose-400 bg-rose-50/50"
                    : "border-slate-200"
                }`}
              />

              <Percent
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Estoque Inicial
            </label>

            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={stockQuantity}
                onChange={(e) =>
                  setStockQuantity(e.target.value)
                }
                placeholder="0"
                className={`w-full text-xs border rounded-lg px-3 py-2 pl-8 outline-none bg-slate-50/50 focus:border-teal-600 transition-all ${
                  formError && !stockQuantity.trim()
                    ? "border-rose-400 bg-rose-50/50"
                    : "border-slate-200"
                }`}
              />

              <Boxes
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
              onClick={() => navigate("/produtos")}
              className="px-5 border border-slate-200 text-slate-600 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleSubmit}
              className="px-5 bg-teal-600 text-white py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-teal-700 active:scale-[0.98] transition-all"
            >
              {initialData
                ? "Alterar Produto"
                : "Gravar Produto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}