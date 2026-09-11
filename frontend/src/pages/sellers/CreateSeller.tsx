import { useNavigate } from "react-router-dom";

import SellerForm from "../../components/layout/ui/SellerForm";
import { createUser } from "../../services/userService";
import { createSeller } from "../../services/sellerService";

import type { SellerFormData } from "../../components/layout/ui/SellerForm";

export default function CreateSeller() {
  const navigate = useNavigate();

  const handleCreate = async (
    data: SellerFormData
  ) => {
    try {
      const user = await createUser({
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        password: data.password,
        is_active: data.is_active,
        group: data.group,
      });

      await createSeller({
        user: user.id,
        phone: data.phone,
      });

      navigate("/vendedores", {
        state: {
          message: "Vendedor criado com sucesso!",
          type: "success",
        },
      });
    } catch (error) {
      console.error(error);

      navigate("/vendedores", {
        state: {
          message: "Erro ao criar vendedor!",
          type: "error",
        },
      });
    }
  };

  return (
    <SellerForm
      title="Novo Vendedor"
      onSave={handleCreate}
    />
  );
}