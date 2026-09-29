import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calendar,
  CheckCircle2,
  Package,
  Receipt,
  Search,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { getDashboard } from "../../services/dashboardService";
import type { DashboardData } from "../../types/Dashboard";

const todayISO = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const monthStartISO = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}-01`;
};

const formatDateBR = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const formatDayBR = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const brl = (value: string | number) =>
  Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-100 rounded-xl border border-slate-100 dark:border-slate-200 shadow-sm p-4 flex items-center gap-3 min-h-[76px]">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          accent
            ? "bg-teal-600 text-[#fff]"
            : "bg-slate-50 dark:bg-slate-200 text-teal-600"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
          {label}
        </div>
        <div className="text-base font-bold text-slate-800 truncate mt-1">
          {value}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-100 rounded-xl border border-slate-100 dark:border-slate-200 shadow-sm h-[76px] animate-pulse"
          />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-100 rounded-xl border border-slate-100 dark:border-slate-200 shadow-sm h-72 animate-pulse" />
        <div className="bg-white dark:bg-slate-100 rounded-xl border border-slate-100 dark:border-slate-200 shadow-sm h-72 animate-pulse" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [startDate, setStartDate] = useState(monthStartISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState(false);

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      setDateError(true);
      return;
    }

    if (startDate > endDate) {
      setDateError(true);
      return;
    }

    setDateError(false);
    setLoading(true);
    setError("");

    try {
      const result = await getDashboard(startDate, endDate);
      setData(result);
    } catch (err) {
      console.error("Erro ao buscar dados do dashboard:", err);
      setError("Não foi possível carregar os dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    if (!startDate || !endDate || startDate > endDate) {
      return;
    }

    getDashboard(startDate, endDate)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar os dados. Tente novamente.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxDaily = useMemo(() => {
    if (!data || data.daily.length === 0) return 0;
    return Math.max(...data.daily.map((point) => Number(point.revenue)));
  }, [data]);

  const hasSales =
    data &&
    data.summary.completed_sales + data.summary.cancelled_sales > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="text-base font-semibold text-teal-700 dark:text-teal-500">
          Dashboard
        </div>

        <div className="flex gap-3 items-end w-full sm:w-auto">
          <div className="flex flex-col flex-1 sm:flex-initial">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Data Inicial
            </label>
            <input
              type="date"
              className={`border-b outline-none transition-colors py-1 px-0.5 text-xs text-slate-700 bg-transparent [&::-webkit-calendar-picker-indicator]:invert-[0.5] ${
                dateError
                  ? "border-rose-500"
                  : "border-slate-200 focus:border-teal-600"
              }`}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col flex-1 sm:flex-initial">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Data Final
            </label>
            <input
              type="date"
              className={`border-b outline-none transition-colors py-1 px-0.5 text-xs text-slate-700 bg-transparent [&::-webkit-calendar-picker-indicator]:invert-[0.5] ${
                dateError
                  ? "border-rose-500"
                  : "border-slate-200 focus:border-teal-600"
              }`}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button
            onClick={handleSearch}
            className="bg-teal-700 text-[#fff] p-1.5 rounded transition-colors hover:bg-teal-800 active:scale-95 flex items-center justify-center shrink-0"
            title="Buscar dados do período"
          >
            <Search size={15} />
          </button>
        </div>
      </div>

      {dateError && (
        <div className="text-[11px] text-rose-600 font-medium">
          Informe um período válido (data inicial não pode ser posterior à
          final).
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-100/30 border border-rose-100 rounded-xl p-4 text-xs font-medium text-rose-600">
          {error}
        </div>
      )}

      {loading && <Skeleton />}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={<Banknote size={20} />}
              label="Receita"
              value={`R$ ${brl(data.summary.revenue)}`}
              accent
            />
            <KpiCard
              icon={<CheckCircle2 size={20} />}
              label="Concluídas"
              value={String(data.summary.completed_sales)}
            />
            <KpiCard
              icon={<XCircle size={20} />}
              label="Canceladas"
              value={String(data.summary.cancelled_sales)}
            />
            <KpiCard
              icon={<Receipt size={20} />}
              label="Ticket Médio"
              value={`R$ ${brl(data.summary.average_ticket)}`}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white dark:bg-slate-100 rounded-xl border border-slate-100 dark:border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-4">
                <TrendingUp size={14} className="text-teal-600" />
                Receita por dia
              </div>

              {data.daily.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 dark:bg-slate-200/40">
                  <Calendar size={22} className="text-slate-300 mb-2" />
                  <p className="text-xs font-medium text-slate-500">
                    Sem vendas concluídas no período.
                  </p>
                </div>
              ) : (
                <div className="flex gap-1.5 sm:gap-3 h-48 px-1 overflow-x-auto custom-scroll">
                  {data.daily.map((point) => {
                    const value = Number(point.revenue);
                    const height =
                      maxDaily > 0 && value > 0
                        ? Math.max(6, Math.round((value / maxDaily) * 100))
                        : 0;

                    return (
                      <div
                        key={point.date}
                        className="flex flex-col items-center gap-1.5 flex-1 min-w-[34px]"
                        title={`${formatDateBR(point.date)} — R$ ${brl(value)}`}
                      >
                        <div className="flex-1 w-full flex items-end">
                          {value > 0 && (
                            <div
                              className="w-full rounded-t bg-teal-600/90 hover:bg-teal-500 transition-colors"
                              style={{ height: `${height}%` }}
                            />
                          )}
                        </div>
                        <span className="text-[9px] font-medium text-slate-400 whitespace-nowrap">
                          {formatDayBR(point.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-100 rounded-xl border border-slate-100 dark:border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-4">
                <Package size={14} className="text-teal-600" />
                Top produtos
              </div>

              {data.top_products.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 dark:bg-slate-200/40">
                  <p className="text-xs font-medium text-slate-500">
                    Sem produtos no período.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {data.top_products.map((product, index) => (
                    <li
                      key={product.description}
                      className="flex items-center gap-3"
                    >
                      <span className="w-5 h-5 rounded-md bg-teal-50 dark:bg-teal-100/40 text-teal-700 dark:text-teal-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-800 truncate">
                          {product.description}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {product.quantity} un
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                        R$ {brl(product.revenue)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {data.top_sellers.length > 0 && (
            <div className="bg-white dark:bg-slate-100 rounded-xl border border-slate-100 dark:border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-4">
                <Users size={14} className="text-teal-600" />
                Top vendedores
              </div>

              <div className="overflow-x-auto custom-scroll">
                <table className="w-full text-left text-xs border-collapse min-w-[480px]">
                  <thead>
                    <tr className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-200">
                      <th className="pb-2">Vendedor</th>
                      <th className="pb-2 text-center">Vendas</th>
                      <th className="pb-2 text-right pr-2">Receita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-200 text-slate-700">
                    {data.top_sellers.map((seller) => (
                      <tr key={seller.seller_id} className="h-9">
                        <td className="py-2 font-medium text-slate-800 max-w-[260px]">
                          <div className="truncate" title={seller.name}>
                            {seller.name}
                          </div>
                        </td>
                        <td className="py-2 text-center text-slate-600 font-medium leading-none">
                          {seller.sales}
                        </td>
                        <td className="py-2 text-right pr-2 font-semibold text-slate-700 whitespace-nowrap leading-none">
                          R$ {brl(seller.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!hasSales && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 dark:bg-slate-200/40">
              <Calendar size={22} className="text-slate-300 mb-2" />
              <p className="text-xs font-medium text-slate-500">
                Nenhuma venda registrada no período ({formatDateBR(startDate)} a{" "}
                {formatDateBR(endDate)}).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}