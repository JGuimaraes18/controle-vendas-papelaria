import SaleForm from "../../components/layout/ui/SaleForm";
import { createSale } from "../../services/salesService";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/ui/Toast";

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

  return "Erro ao criar venda!";
}

export default function CreateSalePage() {
  const navigate = useNavigate();
  const toast = useToast();

  const handleCreate = async (payload: any) => {
    try {
      await createSale(payload);
      toast.success("Venda criada com sucesso!");
      navigate("/vendas");
    } catch (error) {
      navigate("/vendas", {
        state: {
          message: extractErrorMessage(error),
          type: "error",
        },
      });
    }
  };

  return <SaleForm title="Nova Venda" onSave={handleCreate} />;
}