import { useNavigate } from "react-router-dom";
import CustomerForm from "../../components/layout/ui/CustomerForm";
import { createCustomer } from "../../services/customerService";

export default function CreateCustomer() {
  const navigate = useNavigate();

  const handleCreate = async (payload: {
    name: string;
    email: string;
    phone: string;
  }) => {
    try {
      await createCustomer(payload);

      navigate("/clientes", {
        state: {
          message: "Cliente criado com sucesso!",
          type: "success",
        },
      });
    } catch (error) {
      console.error(error);

      navigate("/clientes", {
        state: {
          message: "Erro ao criar cliente!",
          type: "error",
        },
      });
    }
  };

  return (
    <CustomerForm
      title="Novo Cliente"
      onSave={handleCreate}
    />
  );
}