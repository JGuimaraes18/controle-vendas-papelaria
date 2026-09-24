import { useState } from "react";
import { X, Ban, AlertCircle } from "lucide-react";
import type { AxiosError } from "axios";
import { cancelSale } from "../../../services/salesService";
import type { Sale } from "../../../types/Sale";

interface CancelSaleModalProps {
  sale: Sale | null;
  onClose: () => void;
  onSuccess: (updated: Sale) => void;
}

const MIN_REASON_LENGTH = 10;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function CancelSaleModal({
  sale,
  onClose,
  onSuccess,
}: CancelSaleModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!sale) return null;

  const currentSale = sale;

  const stripped = reason.trim();
  const tooShort = stripped.length > 0 && stripped.length < MIN_REASON_LENGTH;

  async function handleCancel() {
    if (stripped.length < MIN_REASON_LENGTH) {
      setError(
        "Informe uma justificativa com no mínimo 10 caracteres."
      );
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const updated = await cancelSale(currentSale.id, stripped);
      onSuccess(updated);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      const detail = axiosError.response?.data?.detail;

      setError(
        detail ||
          "Não foi possível cancelar a venda. Tente novamente."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[400px] rounded-xl shadow-xl border border-slate-100 p-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-rose-50 text-rose-600 shrink-0">
              <Ban size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 leading-none">
                Cancelar venda
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                Venda #{sale.invoice_number} ·{" "}
                {currencyFormatter.format(sale.total_value)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-50 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
          Justificativa <span className="text-rose-500">*</span>
        </label>

        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          rows={4}
          placeholder="Informe o motivo do cancelamento (mínimo 10 caracteres)..."
          maxLength={500}
          className={`w-full text-xs border rounded-lg px-3 py-2 outline-none bg-slate-50/50 focus:border-rose-500 transition-all ${
            error || tooShort
              ? "border-rose-400 bg-rose-50/50"
              : "border-slate-200"
          }`}
        />

        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-slate-400">
            {reason.length}/{500} caracteres
          </p>
          {tooShort && (
            <p className="text-[10px] text-rose-500 font-medium">
              Mínimo de 10 caracteres.
            </p>
          )}
        </div>

        {error && (
          <div className="mt-2 flex items-start gap-1.5 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2 text-[11px] text-rose-600 font-medium">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200 disabled:opacity-50"
          >
            Voltar
          </button>

          <button
            onClick={handleCancel}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 active:scale-95 transition-all shadow-sm shadow-rose-600/10 disabled:opacity-50"
          >
            {submitting ? "Cancelando..." : "Cancelar venda"}
          </button>
        </div>
      </div>
    </div>
  );
}