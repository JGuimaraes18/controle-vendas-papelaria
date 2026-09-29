import { useEffect, useState } from "react";
import {
  X,
  History,
  Plus,
  Pencil,
  Ban,
  User as UserIcon,
  CalendarClock,
} from "lucide-react";

import { getSaleHistory } from "../../../services/salesService";
import type {
  FieldChange,
  Sale,
  SaleChangeLog,
} from "../../../types/Sale";
import { saleStatusLabel } from "../../../utils/format";

interface SaleHistoryModalProps {
  sale: Sale | null;
  onClose: () => void;
}

function isItemChange(
  value: FieldChange
): value is Extract<
  FieldChange,
  { added: unknown[]; removed: unknown[]; updated: unknown[] }
> {
  return "added" in value;
}

const FIELD_LABELS: Record<string, string> = {
  customer: "Cliente",
  seller: "Vendedor",
  items: "Itens",
  status: "Status",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatReference(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    const ref = value as { id?: unknown; name?: unknown };

    if (typeof ref.name === "string" && ref.name !== "") {
      return ref.name;
    }

    if (typeof ref.id === "number") {
      return String(ref.id);
    }
  }

  return String(value);
}

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

  return formatReference(value);
}

type LogEventKind = "created" | "cancelled" | "updated";

function logEventKind(log: SaleChangeLog): LogEventKind {
  const fields = log.fields_changed;

  if (fields.created) {
    return "created";
  }

  const status = fields.status as
    | { before?: unknown; after?: unknown }
    | undefined;

  if (
    status &&
    status.before === "COMPLETED" &&
    status.after === "CANCELLED"
  ) {
    return "cancelled";
  }

  return "updated";
}

function ItemLine({
  description,
  quantity,
  unitPrice,
}: {
  description: string;
  quantity: number;
  unitPrice: string;
}) {
  return (
    <p className="text-[11px] text-slate-600 leading-snug">
      <span className="font-semibold text-slate-800">{description}</span>
      <span className="text-slate-400"> · Quantidade: </span>
      {quantity}
      <span className="text-slate-400"> · Unitário: </span>
      {currencyFormatter.format(Number(unitPrice))}
    </p>
  );
}

function EventContent({ log }: { log: SaleChangeLog }) {
  const event = logEventKind(log);

  if (event === "created") {
    return (
      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
        Registro inicial da venda.
      </p>
    );
  }

  if (Object.keys(log.fields_changed).length === 0) {
    return (
      <p className="text-[11px] text-slate-500 mt-1.5">
        Venda atualizada.
      </p>
    );
  }

  return (
    <div className="mt-1.5 space-y-0.5">
      {Object.entries(log.fields_changed).map(([field, change]) => {
        if (field === "items" && isItemChange(change)) {
          return (
            <div key={field} className="space-y-1 pt-0.5">
              <p className="text-[11px] font-semibold text-slate-600">
                Itens
              </p>

              {change.added.length > 0 && (
                <div className="space-y-0.5 border-l-2 border-emerald-200 pl-2">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
                    Itens adicionados
                  </p>
                  {change.added.map((item) => (
                    <ItemLine
                      key={item.product}
                      description={item.product_description}
                      quantity={item.quantity}
                      unitPrice={item.unit_price}
                    />
                  ))}
                </div>
              )}

              {change.removed.length > 0 && (
                <div className="space-y-0.5 border-l-2 border-rose-200 pl-2">
                  <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide">
                    Itens removidos
                  </p>
                  {change.removed.map((item) => (
                    <ItemLine
                      key={item.product}
                      description={item.product_description}
                      quantity={item.quantity}
                      unitPrice={item.unit_price}
                    />
                  ))}
                </div>
              )}

              {change.updated.length > 0 && (
                <div className="space-y-0.5 border-l-2 border-teal-200 pl-2">
                  <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide">
                    Quantidade alterada
                  </p>
                  {change.updated.map((item) => {
                    const priceChanged =
                      item.before.unit_price !== item.after.unit_price;

                    return (
                      <div key={item.product}>
                        <p className="text-[11px] leading-snug">
                          <span className="font-semibold text-slate-800">
                            {item.product_description}
                          </span>{" "}
                          <span className="line-through decoration-rose-400 decoration-1 text-slate-400">
                            {item.before.quantity}
                          </span>{" "}
                          <span>→</span>{" "}
                          <span className="font-medium text-teal-700">
                            {item.after.quantity}
                          </span>
                        </p>
                        {priceChanged && (
                          <p className="text-[10px] text-slate-500">
                            Unitário:{" "}
                            <span className="line-through decoration-rose-400 decoration-1">
                              {currencyFormatter.format(
                                Number(item.before.unit_price)
                              )}
                            </span>{" "}
                            →{" "}
                            <span className="font-medium text-teal-700">
                              {currencyFormatter.format(
                                Number(item.after.unit_price)
                              )}
                            </span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        const simple = change as { before?: unknown; after?: unknown };

        return (
          <div
            key={field}
            className="flex items-center gap-1.5 text-[11px] text-slate-500"
          >
            <span className="font-semibold text-slate-600">
              {FIELD_LABELS[field] || field}:
            </span>
            <span className="line-through decoration-rose-400 decoration-1">
              {formatChangedField(field, simple.before)}
            </span>
            <span>→</span>
            <span className="font-medium text-teal-700">
              {formatChangedField(field, simple.after)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const EVENT_META: Record<
  LogEventKind,
  { label: string; dot: string; icon: React.ReactNode }
> = {
  created: {
    label: "Venda criada",
    dot: "bg-teal-500",
    icon: <Plus size={11} />,
  },
  cancelled: {
    label: "Venda cancelada",
    dot: "bg-rose-500",
    icon: <Ban size={11} />,
  },
  updated: {
    label: "Venda atualizada",
    dot: "bg-amber-400",
    icon: <Pencil size={11} />,
  },
};

function TimelineEntry({
  log,
  isLast,
}: {
  log: SaleChangeLog;
  isLast: boolean;
}) {
  const event = logEventKind(log);
  const meta = EVENT_META[event];

  return (
    <li className={`relative pl-6 ${isLast ? "" : "pb-3"}`}>
      <span
        className={`absolute left-0 top-4 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${meta.dot} shadow-sm`}
      />
      {!isLast && (
        <span className="absolute left-[6.5px] top-6 bottom-0 w-px bg-slate-200" />
      )}

      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <span className="text-teal-600 shrink-0">{meta.icon}</span>
            {meta.label}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
            <CalendarClock size={11} />
            {new Date(log.changed_at).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
          <UserIcon size={11} />
          {log.user_name}
        </div>

        <EventContent log={log} />
      </div>
    </li>
  );
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[520px] rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-teal-50 text-teal-600 shrink-0">
              <History size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 leading-none">
                Histórico da Venda
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

        <div className="max-h-96 overflow-y-auto custom-scroll p-4">
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

          <ul className="space-y-2.5">
            {logs.map((log, index) => (
              <TimelineEntry
                key={log.id}
                log={log}
                isLast={index === logs.length - 1}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}