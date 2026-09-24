import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSales, updateSale } from "../../services/salesService";
import type { Sale } from "../../types/Sale";
import SaleForm from "../../components/layout/ui/SaleForm";

function extractErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;

  if (typeof data === "object" && data !== null) {
    const body = data as { items?: unknown; detail?: unknown };

    if (typeof body.items === "string") {
      return body.items;
    }

    if (typeof body.detail === "string") {
      return body.detail;
    }
  }

  return "Erro ao atualizar venda!";
}

export default function EditSalePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);

  useEffect(() => {
    async function loadSale() {
      const sales = await getSales();
      const current = sales.find(s => s.id === Number(id));
      if (current) setSale(current);
    }
    loadSale();
  }, [id]);

  const handleUpdate = async (payload: any) => {
    try {
      await updateSale(Number(id), payload);
      navigate("/", {
        state: {
        message: "Venda atualizada com sucesso!",
        type: "success"
        }
      });
    } catch (error) {
      navigate("/", {
        state: { 
          message: extractErrorMessage(error),
          type: "error"
         }
      });
    }
  };

  if (!sale) return <p className="p-10 text-center text-teal-700 font-bold">Carregando...</p>;

  return (
    <SaleForm 
      title={`Alterar Venda - Nº ${sale.invoice_number}`} 
      initialData={sale} 
      onSave={handleUpdate} 
    />
  );
}