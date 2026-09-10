import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getCustomers,
  updateCustomer,
} from "../../services/customerService";

import type { Customer } from "../../types/Customer";
import CustomerForm from "../../components/layout/ui/CustomerForm";

export default function EditCustomer() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    async function loadCustomer() {
      try {
        const customers = await getCustomers();

        const current = customers.find(
          (customer) => customer.id === Number(id)
        );

        if (current) {
          setCustomer(current);
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadCustomer();
  }, [id]);

  const handleUpdate = async (payload: {
    name: string;
    email: string;
    phone: string;
  }) => {
    try {
      await updateCustomer(Number(id), payload);

      navigate("/clientes", {
        state: {
          message: "Cliente atualizado com sucesso!",
          type: "success",
        },
      });
    } catch (error) {
      console.error(error);

      navigate("/clientes", {
        state: {
          message: "Erro ao atualizar cliente!",
          type: "error",
        },
      });
    }
  };

  if (!customer) {
    return (
      <p className="p-10 text-center text-teal-700 font-bold">
        Carregando...
      </p>
    );
  }

  return (
    <CustomerForm
      title={`Alterar Cliente - Nº ${String(customer.id).padStart(3, "0")}`}
      initialData={customer}
      onSave={handleUpdate}
    />
  );
}