import { useNavigate } from "react-router-dom";
import SalesList from "./SalesList";

export default function SalesPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="text-base font-semibold text-teal-700 order-1">
          Vendas Realizadas
        </div>

        <button
          onClick={() => navigate(`/vendas/nova`)}
          className="bg-teal-700 text-[#fff] px-4 py-1.5 text-xs rounded hover:bg-teal-800 order-3 xs:order-3 transition-colors shrink-0"
        >
          Nova Venda
        </button>
      </div>

      <SalesList />
    </div>
  );
}