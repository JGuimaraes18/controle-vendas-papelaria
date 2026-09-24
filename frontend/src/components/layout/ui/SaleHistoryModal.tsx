import { useEffect, useState } from "react";
import { X, History, User as UserIcon, CalendarClock } from "lucide-react";

import { getSaleHistory } from "../../../services/salesService";
import type { Sale, SaleChangeLog } from "../../../types/Sale";
import { saleStatusLabel } from "../../../utils/format";

interface SaleHistoryModalProps {
  sale: Sale | null;
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  customer: "Cliente",
  seller: "Vendedor",
  items: "Itens",
  status: "Status",
};

function formatChangedField(key: string, value: unknown): string {
  if (key === "items" && Array.isArray(value)) {
    return String(value.length);
  }

  if (key === "status") {
    return saleStatusLabel(String(value));
  }

  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

export default function SaleHistoryModal({
  sale,
  onClose,
}: SaleHistoryModalProps) {
  const [logs, setLogs] = useState<SaleChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sale) return;

    let active = true;

    getSaleHistory(sale.id)
      .then((data) => {
        if (active) setLogs(data);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar o histórico.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sale]);

  if (!sale) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[520px] rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-teal-50 text-teal-600 shrink-0">
              <History size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 leading-none">
                Histórico de Alterações
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                Venda Nº {sale.invoice_number}
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

        <div className="max-h-96 overflow-y-auto custom-scroll p-4 space-y-2.5">
          {loading && (
            <p className="text-center text-xs font-medium text-slate-500 py-6">
              Carregando histórico...
            </p>
          )}

          {error && (
            <p className="text-center text-xs font-medium text-rose-500 py-6">
              {error}
            </p>
          )}

          {!loading && !error && logs.length === 0 && (
            <p className="text-center text-xs italic text-slate-400 py-6">
              Nenhuma alteração registrada nesta venda.
            </p>
          )}

          {!loading &&
            !error &&
            logs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-50 border border-slate-100 rounded-lg p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <UserIcon size={12} className="text-teal-600 shrink-0" />
                    {log.user_name}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                    <CalendarClock size={11} />
                    {new Date(log.changed_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </div>
                </div>

                {Object.keys(log.fields_changed).length === 0 ? (
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Venda atualizada.
                  </p>
                ) : (
                  <div className="mt-1.5 space-y-0.5">
                    {Object.entries(log.fields_changed).map(
                      ([field, change]) => (
                        <div
                          key={field}
                          className="flex items-center gap-1.5 text-[11px] text-slate-500"
                        >
                          <span className="font-semibold text-slate-600">
                            {FIELD_LABELS[field] || field}:
                          </span>
                          <span className="line-through decoration-rose-400 decoration-1">
                            {formatChangedField(
                              field,
                              change.before
                            )}
                          </span>
                          <span>→</span>
                          <span className="font-medium text-teal-700">
                            {formatChangedField(field, change.after)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}