import { useState, useMemo } from "react";
import { Search, Calendar } from "lucide-react";
import { getCommissionReport } from "../../services/commissionService";
import type { CommissionReport } from "../../types/Commission";

const todayISO = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export default function CommissionPage() {
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [reportData, setReportData] = useState<CommissionReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [dateError, setDateError] = useState(false);

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      setDateError(true);
      return;
    }

    setDateError(false);
    setLoading(true);
    try {
      const data = await getCommissionReport(startDate, endDate);
      setReportData(data);
      setHasSearched(true);
    } catch (error) {
      console.error("Erro ao buscar comissões:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalComissoes = reportData.reduce(
    (acc, curr) => acc + Number(curr.total_commission), 
    0
  );

  const sortedCommissions = useMemo(() => {
    return [...reportData].sort((a, b) => {
      return Number(b.seller_id) - Number(a.seller_id);
    });
  }, [reportData]);

  // Auxiliar para formatar a data do input (AAAA-MM-DD) para PT-BR (DD/MM/AAAA) no resumo
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 mb-4 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          Relatório de Comissões
        </div>
        
        <div className="flex gap-3 items-end mt-3 sm:mt-0 w-full sm:w-auto">
          <div className="flex flex-col flex-1 sm:flex-initial">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Data Inicial</label>
            <input 
              type="date" 
              className={`border-b outline-none transition-colors py-1 px-0.5 text-xs text-slate-700 bg-transparent
                [&::-webkit-calendar-picker-indicator]:invert-[0.5] 
                ${dateError && !startDate
                  ? "border-rose-500"
                  : "border-slate-200 focus:border-teal-600"
                }
              `}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col flex-1 sm:flex-initial">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Data Final</label>
            <input 
              type="date" 
              className={`border-b outline-none transition-colors py-1 px-0.5 text-xs text-slate-700 bg-transparent
                [&::-webkit-calendar-picker-indicator]:invert-[0.5] 
                ${dateError && !endDate
                  ? "border-rose-500"
                  : "border-slate-200 focus:border-teal-600"
                }
              `}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button 
            onClick={handleSearch}
            className="bg-teal-700 text-white p-1.5 rounded transition-colors hover:bg-teal-800 active:scale-95 flex items-center justify-center shrink-0"
            title="Buscar comissões"
          >
            <Search size={15} />
          </button>
        </div>
      </header>

      {!hasSearched ? (
        <div className="flex flex-col items-center justify-center h-56 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Calendar size={24} className="text-slate-300 mb-2" />
          <p className="text-xs font-medium text-slate-500">Selecione um período acima para gerar o relatório.</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center h-56">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-b-teal-600"></div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300 overflow-x-auto custom-scroll w-full">
          <table className="w-full text-left text-xs border-collapse table-fixed min-w-[650px] sm:min-w-full">
            <thead>
              <tr className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="pb-2 w-[12%] text-center">Cód.</th>
                <th className="pb-2 w-[38%]">Vendedor</th>
                <th className="pb-2 w-[15%] text-center">Qtd. Vendas</th>
                <th className="pb-2 w-[18%] text-center">Total Vendas</th>
                <th className="pb-2 w-[17%] text-right pr-2">Comissão Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedCommissions.map((item) => (
                <tr key={item.seller_id} className="hover:bg-slate-50/60 transition-colors h-9">
                  <td className="py-2 text-center text-slate-400 font-mono text-[11px] leading-none">
                    {String(item.seller_id).padStart(4, '0')}
                  </td>
                  <td className="py-2 font-medium text-slate-800 max-w-[200px] leading-none">
                    <div className="truncate" title={item.seller_name}>
                      {item.seller_name}
                    </div>
                  </td>
                  <td className="py-2 text-center text-slate-600 font-medium leading-none">{item.sale_count}</td>
                  <td className="py-2 text-center text-slate-500 whitespace-nowrap leading-none">
                    R$ {Number(item.total_sales).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 text-right font-semibold text-slate-900 pr-2 whitespace-nowrap leading-none">
                    R$ {Number(item.total_commission).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            
            {sortedCommissions.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold h-10">
                  <td colSpan={3} className="text-right text-[10px] text-slate-400 uppercase tracking-wider pr-4">
                    Total do Período ({formatDateBR(startDate)} - {formatDateBR(endDate)}):
                  </td>
                  <td colSpan={2} className="text-right pr-2 font-black text-teal-700 text-sm whitespace-nowrap">
                    R$ {totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          
          {sortedCommissions.length === 0 && (
            <p className="text-center py-10 text-slate-400 italic text-[11px]">
              Nenhuma venda registrada para este período.
            </p>
          )}
        </div>
      )}
    </div>
  );
}