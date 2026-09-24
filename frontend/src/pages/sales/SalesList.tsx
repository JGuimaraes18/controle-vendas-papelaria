import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import { getSales } from "../../services/salesService";
import { getCustomers } from "../../services/customerService";
import { getSellers } from "../../services/sellerService";
import type { Sale } from "../../types/Sale";
import type { Customer } from "../../types/Customer";
import type { Seller } from "../../types/Seller";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  History,
  FileText,
  Ban,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import SaleHistoryModal from "../../components/layout/ui/SaleHistoryModal";
import CancelSaleModal from "../../components/layout/ui/CancelSaleModal";
import SortableTh from "../../components/layout/ui/SortableTh";
import type { SortDirection } from "../../components/layout/ui/SortableTh";
import { getUser, isSeller as isSellerRole, isAdmin } from "../../services/authService";
import { saleStatusLabel } from "../../utils/format";

interface SalesListProps {
  searchTerm: string;
}

type SaleSortKey =
  | "invoice_number"
  | "customer"
  | "seller"
  | "date"
  | "total_value"
  | "status";

export default function SalesList({ searchTerm }: SalesListProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);
  const [historySale, setHistorySale] = useState<Sale | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SaleSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const navigate = useNavigate();

  const admin = isAdmin();

  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  function toggleSort(key: SaleSortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = getUser();
      const isSellerUser = isSellerRole();

      const [salesData, customersData, sellersData] = await Promise.all([
        getSales(),
        getCustomers(),
        // SELLER has no access to /api/sellers/ (403); uses own data from login
        isSellerUser ? Promise.resolve([] as Seller[]) : getSellers(),
      ]);

      setSales(salesData);
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
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar vendas.");
    } finally {
      setLoading(false);
    }
  }, []);

  function toggleExpand(id: number) {
    setExpandedSaleId((prev) => (prev === id ? null : id));
  }

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const customerMap = useMemo(() => new Map(
    customers.map((c) => [c.id, c.name])
  ), [customers]);

  const sellerMap = useMemo(() => new Map(
    sellers.map((s) => [s.id, s.full_name])
  ), [sellers]);

  const sortedSales = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();

    const filtered = searchLower
      ? sales.filter((sale) => {
          const customerName = customerMap.get(sale.customer)?.toLowerCase() || "";
          const sellerName = sellerMap.get(sale.seller)?.toLowerCase() || "";
          const invoiceNumber = String(sale.invoice_number).toLowerCase();
          const saleDate = new Date(sale.date).toLocaleString("pt-BR").toLowerCase();

          return (
            customerName.includes(searchLower) ||
            sellerName.includes(searchLower) ||
            invoiceNumber.includes(searchLower) ||
            saleDate.includes(searchLower)
          );
        })
      : [...sales];

    return filtered.sort((a, b) => {
      let cmp = 0;

      switch (sortKey) {
        case "invoice_number":
          cmp = String(a.invoice_number).localeCompare(String(b.invoice_number));
          break;
        case "customer":
          cmp = (customerMap.get(a.customer) ?? "").localeCompare(
            customerMap.get(b.customer) ?? ""
          );
          break;
        case "seller":
          cmp = (sellerMap.get(a.seller) ?? "").localeCompare(
            sellerMap.get(b.seller) ?? ""
          );
          break;
        case "date":
          cmp =
            new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "total_value":
          cmp = a.total_value - b.total_value;
          break;
        case "status":
          cmp = String(a.status).localeCompare(String(b.status));
          break;
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sales, searchTerm, customerMap, sellerMap, sortKey, sortDir]);

  const handleCancelSuccess = (updated: Sale) => {
    setSales((current) =>
      current.map((sale) =>
        sale.id === updated.id ? { ...sale, ...updated } : sale
      )
    );
    setSaleToCancel(null);
  };

  if (loading) return <p className="p-4 text-xs font-medium text-slate-500">Carregando vendas...</p>;
  if (error) return <p className="p-4 text-xs font-medium text-rose-500">{error}</p>;

  return (
    <>
      <div className="w-full bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
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
              {sortedSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic text-[11px]">
                    Nenhuma venda encontrada para o termo pesquisado.
                  </td>
                </tr>
              ) : (
                sortedSales.map((sale) => (
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