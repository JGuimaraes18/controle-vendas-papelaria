import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { getSales } from "../../services/salesService";
import { getCustomers } from "../../services/customerService";
import { getSellers } from "../../services/sellerService";
import type { Sale, SaleListParams, SaleStatus } from "../../types/Sale";
import type { Customer } from "../../types/Customer";
import type { Seller } from "../../types/Seller";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  History,
  FileText,
  Ban,
  Search,
  Filter,
  X,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import SaleHistoryModal from "../../components/layout/ui/SaleHistoryModal";
import CancelSaleModal from "../../components/layout/ui/CancelSaleModal";
import SortableTh from "../../components/layout/ui/SortableTh";
import type { SortDirection } from "../../components/layout/ui/SortableTh";
import Pagination from "../../components/ui/Pagination";
import type { PageSize } from "../../components/ui/Pagination";
import { getUser, isSeller as isSellerRole, isAdmin } from "../../services/authService";
import { saleStatusLabel } from "../../utils/format";

type SaleSortKey =
  | "invoice_number"
  | "customer"
  | "seller"
  | "date"
  | "total_value"
  | "status";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 25;

function parsePageSize(raw: string | null): PageSize {
  const value = Number(raw);
  return PAGE_SIZE_OPTIONS.includes(value)
    ? (value as PageSize)
    : DEFAULT_PAGE_SIZE;
}

export default function SalesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);
  const [historySale, setHistorySale] = useState<Sale | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [showFilters, setShowFilters] = useState(false);

  const [startDate, setStartDate] = useState(searchParams.get("start_date") ?? "");
  const [endDate, setEndDate] = useState(searchParams.get("end_date") ?? "");
  const [minValue, setMinValue] = useState(searchParams.get("min_value") ?? "");
  const [maxValue, setMaxValue] = useState(searchParams.get("max_value") ?? "");

  const navigate = useNavigate();
  const admin = isAdmin();

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
    []
  );

  const updateParams = useCallback(
    (
      updates: Record<string, string | number | null | undefined>,
      options?: { resetPage?: boolean }
    ) => {
      const next = new URLSearchParams(searchParams);
      const resetPage = options?.resetPage ?? true;

      if (resetPage) {
        next.delete("page");
      }

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const pageSize = parsePageSize(searchParams.get("page_size"));
  const rawPage = Number(searchParams.get("page") || "1");
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const ordering = searchParams.get("ordering") ?? "-date";
  const sortKey = (ordering.replace(/^-/, "") as SaleSortKey) || "date";
  const sortDir: SortDirection = ordering.startsWith("-") ? "desc" : "asc";

  const queryParams = useMemo<SaleListParams>(() => {
    const params: SaleListParams = {
      page,
      page_size: pageSize,
    };

    const q = searchParams.get("q");
    if (q) params.search = q;

    const status = searchParams.get("status");
    if (status) params.status = status as SaleStatus;

    const customer = searchParams.get("customer");
    if (customer) params.customer = Number(customer);

    const seller = searchParams.get("seller");
    if (seller) params.seller = Number(seller);

    const start = searchParams.get("start_date");
    if (start) params.start_date = start;

    const end = searchParams.get("end_date");
    if (end) params.end_date = end;

    const min = searchParams.get("min_value");
    if (min) params.min_value = min;

    const max = searchParams.get("max_value");
    if (max) params.max_value = max;

    const sort = searchParams.get("ordering");
    if (sort) params.ordering = sort;

    return params;
  }, [searchParams, page, pageSize]);

  const queryKey = useMemo(() => JSON.stringify(queryParams), [queryParams]);

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSales(queryParams);
      setSales(data.results);
      setTotal(data.count);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar vendas.");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales, queryKey]);

  useEffect(() => {
    let active = true;

    const currentUser = getUser();
    const isSellerUser = isSellerRole();

    Promise.all([
      getCustomers(),
      // SELLER has no access to /api/sellers/ (403); uses own data from login
      isSellerUser ? Promise.resolve([] as Seller[]) : getSellers(),
    ])
      .then(([customersData, sellersData]) => {
        if (!active) return;

        setCustomers(customersData);

        if (isSellerUser && currentUser?.seller_id) {
          setSellers([
            {
              id: currentUser.seller_id,
              user: currentUser.id,
              first_name: currentUser.first_name ?? "",
              last_name: currentUser.last_name ?? "",
              full_name: `${currentUser.first_name ?? ""} ${currentUser.last_name ?? ""}`.trim(),
              email: currentUser.email ?? "",
              phone: "",
              group: "SELLER",
              is_active: true,
            },
          ]);
        } else {
          setSellers(sellersData);
        }
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const q = searchInput.trim();
      updateParams({ q });
    }, 400);

    return () => window.clearTimeout(handle);
  }, [searchInput, updateParams]);

  useEffect(() => {
    setStartDate(searchParams.get("start_date") ?? "");
    setEndDate(searchParams.get("end_date") ?? "");
    setMinValue(searchParams.get("min_value") ?? "");
    setMaxValue(searchParams.get("max_value") ?? "");
  }, [searchParams]);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  const sellerMap = useMemo(
    () => new Map(sellers.map((s) => [s.id, s.full_name])),
    [sellers]
  );

  function toggleSort(key: SaleSortKey) {
    let next: string;

    if (sortKey === key) {
      next = sortDir === "asc" ? `-${key}` : key;
    } else {
      next = key === "date" ? `-${key}` : key;
    }

    updateParams({ ordering: next }, { resetPage: false });
  }

  function toggleExpand(id: number) {
    setExpandedSaleId((prev) => (prev === id ? null : id));
  }

  function applyDateRange() {
    updateParams({ start_date: startDate, end_date: endDate });
  }

  function applyValueRange() {
    updateParams({ min_value: minValue, max_value: maxValue });
  }

  function clearFilters() {
    setSearchInput("");
    updateParams({
      q: null,
      status: null,
      customer: null,
      seller: null,
      start_date: null,
      end_date: null,
      min_value: null,
      max_value: null,
    });
    setShowFilters(false);
  }

  const handleCancelSuccess = () => {
    setSaleToCancel(null);
    fetchSales();
  };

  const filterCount = [
    "status",
    "customer",
    "seller",
    "start_date",
    "end_date",
    "min_value",
    "max_value",
  ].filter((key) => searchParams.get(key)).length;

  return (
    <>
      <div className="w-full bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por cliente, vendedor ou nota..."
              className="w-full text-xs pl-8 pr-8 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-teal-600 transition-colors"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              filterCount > 0 || showFilters
                ? "bg-teal-700 text-[#fff] hover:bg-teal-800"
                : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Filter size={13} />
            Filtros
            {filterCount > 0 && ` (${filterCount})`}
          </button>

          {(filterCount > 0 || searchParams.get("q")) && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <RotateCcw size={13} />
              Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Status
              </span>
              <select
                value={searchParams.get("status") ?? ""}
                onChange={(e) =>
                  updateParams({ status: e.target.value || null })
                }
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-teal-600"
              >
                <option value="">Todos</option>
                <option value="COMPLETED">Concluídas</option>
                <option value="CANCELLED">Canceladas</option>
              </select>
            </label>

            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Cliente
              </span>
              <select
                value={searchParams.get("customer") ?? ""}
                onChange={(e) =>
                  updateParams({ customer: e.target.value || null })
                }
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-teal-600"
              >
                <option value="">Todos</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Vendedor
              </span>
              <select
                value={searchParams.get("seller") ?? ""}
                onChange={(e) =>
                  updateParams({ seller: e.target.value || null })
                }
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-teal-600"
              >
                <option value="">Todos</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Período
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                  onBlur={applyDateRange}
                  className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-teal-600"
                />
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  onBlur={applyDateRange}
                  className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-teal-600"
                />
              </div>
            </label>

            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Valor mínimo
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                onBlur={applyValueRange}
                placeholder="0,00"
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-teal-600"
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Valor máximo
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                onBlur={applyValueRange}
                placeholder="0,00"
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-teal-600"
              />
            </label>
          </div>
        )}

        <div className="w-full overflow-x-auto custom-scroll">
          <table className="w-full text-left text-xs table-fixed border-collapse min-w-[760px] lg:min-w-full">
            <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 border-b border-slate-100">
              <tr className="font-semibold text-[11px] uppercase tracking-wider">
                <SortableTh
                  label="Nota Fiscal"
                  active={sortKey === "invoice_number"}
                  direction={sortDir}
                  onSort={() => toggleSort("invoice_number")}
                  className="p-3 w-[10%]"
                />
                <SortableTh
                  label="Cliente"
                  active={sortKey === "customer"}
                  direction={sortDir}
                  onSort={() => toggleSort("customer")}
                  className="p-3 w-[21%]"
                />
                <SortableTh
                  label="Vendedor"
                  active={sortKey === "seller"}
                  direction={sortDir}
                  onSort={() => toggleSort("seller")}
                  className="p-3 w-[21%]"
                />
                <SortableTh
                  label="Data"
                  active={sortKey === "date"}
                  direction={sortDir}
                  onSort={() => toggleSort("date")}
                  className="p-3 text-center w-[13%]"
                />
                <SortableTh
                  label="Valor Total"
                  active={sortKey === "total_value"}
                  direction={sortDir}
                  onSort={() => toggleSort("total_value")}
                  className="p-3 text-center w-[12%]"
                />
                <SortableTh
                  label="Status"
                  active={sortKey === "status"}
                  direction={sortDir}
                  onSort={() => toggleSort("status")}
                  className="p-3 text-center w-[13%]"
                />
                <th className="p-3 text-center w-[10%]">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                Array.from({ length: 6 }).map((_, row) => (
                  <tr key={row} className="animate-pulse">
                    <td className="p-2.5">
                      <div className="h-3.5 bg-slate-200 rounded w-16" />
                    </td>
                    <td className="p-2.5">
                      <div className="h-3.5 bg-slate-200 rounded w-28" />
                    </td>
                    <td className="p-2.5">
                      <div className="h-3.5 bg-slate-200 rounded w-24" />
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="h-3.5 bg-slate-200 rounded w-20 mx-auto" />
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="h-3.5 bg-slate-200 rounded w-20 mx-auto" />
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="h-3.5 bg-slate-200 rounded-full w-16 mx-auto" />
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="h-3.5 bg-slate-200 rounded w-14 mx-auto" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-rose-500 text-xs font-medium">
                    {error}
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Search size={22} className="text-slate-400" />
                      </div>
                      <p className="text-xs font-semibold text-slate-600">
                        Nenhuma venda encontrada
                      </p>
                      <p className="text-[11px] text-slate-400 italic max-w-xs">
                        {filterCount > 0 || searchParams.get("q")
                          ? "Ajuste ou limpe os filtros para ver mais resultados."
                          : "Cadastre uma nova venda para começar a registrar seu histórico."}
                      </p>
                      {(filterCount > 0 || searchParams.get("q")) && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 hover:bg-teal-100 transition-colors"
                        >
                          <RotateCcw size={13} />
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <Fragment key={sale.id}>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-900">
                          <FileText size={13} className="text-slate-400 shrink-0" />
                          <span>{sale.invoice_number}</span>
                        </div>
                      </td>

                      <td className="p-2.5 truncate font-medium text-slate-800">
                        {customerMap.get(sale.customer) ?? "—"}
                      </td>

                      <td className="p-2.5 truncate text-slate-500">
                        {sellerMap.get(sale.seller) ?? "—"}
                      </td>

                      <td className="text-center p-2.5 text-slate-500">
                        {new Date(sale.date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </td>

                      <td className="p-2.5 text-center font-bold text-slate-900">
                        {currencyFormatter.format(sale.total_value)}
                      </td>

                      <td className="p-2.5 text-center">
                        {sale.status === "CANCELLED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-rose-50 text-rose-600 border border-rose-100">
                            <Ban size={10} />
                            {saleStatusLabel(sale.status)}
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600 border border-emerald-100">
                            {saleStatusLabel(sale.status)}
                          </span>
                        )}
                      </td>

                      <td className="p-2.5">
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            onClick={() => toggleExpand(sale.id)}
                            className={`p-1 rounded transition-colors ${
                              expandedSaleId === sale.id
                                ? "bg-teal-50 text-teal-700"
                                : "text-slate-400 hover:text-teal-600 hover:bg-slate-100"
                            }`}
                            title={expandedSaleId === sale.id ? "Fechar itens" : "Ver itens"}
                          >
                            {expandedSaleId === sale.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {sale.status !== "CANCELLED" && (
                            <button
                              onClick={() => navigate(`/vendas/editar/${sale.id}`)}
                              className="p-1 rounded transition-colors text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                              title="Editar venda"
                            >
                              <Pencil size={14} />
                            </button>
                          )}

                          <button
                            onClick={() => setHistorySale(sale)}
                            className="p-1 rounded transition-colors text-slate-400 hover:text-teal-600 hover:bg-slate-100"
                            title="Histórico de alterações"
                          >
                            <History size={14} />
                          </button>

                          {admin && sale.status !== "CANCELLED" && (
                            <button
                              onClick={() => setSaleToCancel(sale)}
                              className="p-1 rounded transition-colors text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                              title="Cancelar venda"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expandedSaleId === sale.id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="p-3 border-t border-b border-slate-100">
                          <div className="bg-white rounded-lg border border-slate-100 p-2.5 shadow-inner">
                            <table className="w-full text-[11px] text-slate-600 table-fixed border-collapse">
                              <thead>
                                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                                  <th className="pb-1.5 px-2 w-[55%] text-left">Produto/Serviço</th>
                                  <th className="pb-1.5 w-[15%] text-center">Qtd</th>
                                  <th className="pb-1.5 w-[15%] text-center">Preço Unit.</th>
                                  <th className="pb-1.5 px-2 w-[15%] text-right">Total</th>
                                </tr>
                              </thead>

                              <tbody className="divide-y divide-slate-50">
                                {sale.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-1.5 px-2 truncate font-medium text-slate-700">
                                      {item.product_description}
                                    </td>
                                    <td className="py-1.5 text-center text-slate-800 font-medium">
                                      {item.quantity}
                                    </td>
                                    <td className="py-1.5 text-center text-slate-500">
                                      {currencyFormatter.format(item.unit_price)}
                                    </td>
                                    <td className="py-1.5 px-2 text-right font-semibold text-slate-900">
                                      {currencyFormatter.format(item.total_value)}
                                    </td>
                                  </tr>
                                ))}

                                <tr className="text-xs font-bold text-slate-800">
                                  <td colSpan={3} className="pt-2 text-right pr-4 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                                    Total da Venda:
                                  </td>
                                  <td className="pt-2 pr-2 text-right text-teal-700 font-black text-sm">
                                    {currencyFormatter.format(sale.total_value)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          count={total}
          onPageChange={(nextPage) => updateParams({ page: nextPage })}
          onPageSizeChange={(size) => updateParams({ page_size: size })}
        />
      </div>

      <SaleHistoryModal
        key={historySale?.id ?? "none"}
        sale={historySale}
        onClose={() => setHistorySale(null)}
      />

      <CancelSaleModal
        key={saleToCancel?.id ?? "none"}
        sale={saleToCancel}
        onClose={() => setSaleToCancel(null)}
        onSuccess={handleCancelSuccess}
      />
    </>
  );
}