import { useEffect, useState } from "react";
import {
  X,
  ShoppingCart,
  ArrowLeft,
  User as UserIcon,
  FileText,
  Ban,
  Package,
} from "lucide-react";
import { getCustomerPurchaseHistory } from "../../../services/customerService";
import type { Customer } from "../../../types/Customer";
import type { PurchaseHistoryItem } from "../../../types/Sale";
import { saleStatusLabel } from "../../../utils/format";

interface PurchaseHistoryModalProps {
  customer: Customer | null;
  onClose: () => void;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function StatusBadge({ status }: { status: "COMPLETED" | "CANCELLED" }) {
  const cancelled = status === "CANCELLED";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
        cancelled
          ? "bg-rose-50 text-rose-600 border border-rose-100"
          : "bg-emerald-50 text-emerald-600 border border-emerald-100"
      }`}
    >
      {cancelled && <Ban size={10} />}
      {saleStatusLabel(status)}
    </span>
  );
}

export default function PurchaseHistoryModal({
  customer,
  onClose,
}: PurchaseHistoryModalProps) {
  const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
  const [selected, setSelected] = useState<PurchaseHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;

    let active = true;

    getCustomerPurchaseHistory(customer.id)
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar o histórico de compras.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [customer]);

  if (!customer) return null;

  if (selected) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
        <div className="bg-white w-full max-w-[560px] rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-teal-50 text-teal-600 shrink-0">
                <FileText size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 leading-none">
                  Venda Nº {selected.invoice_number}
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">
                  Detalhes da compra
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

          <div className="max-h-96 overflow-y-auto custom-scroll p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <UserIcon size={12} className="text-slate-400" />
                <span className="font-medium text-slate-700">
                  {selected.seller_name}
                </span>
              </div>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">{formatDate(selected.date)}</span>
              <span className="ml-auto">
                <StatusBadge status={selected.status} />
              </span>
            </div>

            <div className="border border-slate-100 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-slate-400 font-semibold text-[10px] uppercase">
                    <th className="p-2 w-[46%] text-left">Produto</th>
                    <th className="p-2 w-[12%] text-center">Qtd.</th>
                    <th className="p-2 w-[18%] text-center">Unitário</th>
                    <th className="p-2 px-2 w-[24%] text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selected.items.map((item) => (
                    <tr key={item.id}>
                      <td className="p-2 font-medium text-slate-700">
                        {item.product_description}
                      </td>
                      <td className="p-2 text-center text-slate-800 font-medium">
                        {item.quantity}
                      </td>
                      <td className="p-2 text-center text-slate-500">
                        {currencyFormatter.format(item.unit_price)}
                      </td>
                      <td className="p-2 px-2 text-right font-semibold text-slate-900">
                        {currencyFormatter.format(item.total_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-100 text-xs font-bold text-slate-800">
                    <td
                      colSpan={3}
                      className="p-2 pt-2 text-right pr-3 text-[11px] text-slate-400 uppercase tracking-wider font-semibold"
                    >
                      Total da compra:
                    </td>
                    <td className="p-2 px-2 text-right text-teal-700 font-black">
                      {currencyFormatter.format(selected.total_value)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {selected.status === "CANCELLED" && (
              <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                  <Ban size={13} />
                  Venda cancelada
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <UserIcon size={11} className="text-slate-400" />
                  <span className="text-slate-400">Cancelada por:</span>
                  <span className="font-medium text-slate-700">
                    {selected.cancelled_by_name || "—"}
                  </span>
                </div>
                {selected.cancelled_at && (
                  <div className="text-[11px] text-slate-600">
                    <span className="text-slate-400">Data/hora: </span>
                    <span className="font-medium text-slate-700">
                      {formatDate(selected.cancelled_at)}
                    </span>
                  </div>
                )}
                {selected.cancellation_reason && (
                  <div className="text-[11px] text-slate-600">
                    <span className="text-slate-400">Justificativa: </span>
                    <span className="font-medium text-slate-700">
                      {selected.cancellation_reason}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft size={13} />
                Voltar ao histórico
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[560px] rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-teal-50 text-teal-600 shrink-0">
              <ShoppingCart size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 leading-none">
                Histórico de Compras
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                {customer.name}
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

          {!loading && !error && history.length === 0 && (
            <p className="text-center text-xs italic text-slate-400 py-6">
              Nenhuma compra registrada para este cliente.
            </p>
          )}

          {!loading &&
            !error &&
            history.map((purchase) => (
              <button
                key={purchase.id}
                onClick={() => setSelected(purchase)}
                className="w-full text-left bg-slate-50 border border-slate-100 rounded-lg p-2.5 hover:border-teal-200 hover:bg-teal-50/40 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Package size={12} className="text-slate-400 shrink-0" />
                    Venda #{purchase.invoice_number}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(purchase.date).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="ml-auto">
                    <StatusBadge status={purchase.status} />
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <UserIcon size={11} className="text-slate-400" />
                    {purchase.seller_name}
                  </span>
                  <span>
                    {purchase.item_count}{" "}
                    {purchase.item_count === 1 ? "item" : "itens"}
                  </span>
                  <span className="font-bold text-teal-700">
                    {currencyFormatter.format(purchase.total_value)}
                  </span>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}