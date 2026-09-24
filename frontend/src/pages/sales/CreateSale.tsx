import SaleForm from "../../components/layout/ui/SaleForm";
import { createSale } from "../../services/salesService";
import { useNavigate } from "react-router-dom";

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

  const handleCreate = async (payload: any) => {
    try {
      await createSale(payload);
      navigate("/", {
        state: {
        message: "Venda criada com sucesso!",
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

  return <SaleForm title="Nova Venda" onSave={handleCreate} />;
}