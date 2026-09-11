import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import SellerForm, {
  type SellerFormData,
} from "../../components/layout/ui/SellerForm";

import {
  getSellers,
  updateSeller,
} from "../../services/sellerService";

import { updateUser } from "../../services/userService";

import type { Seller } from "../../types/Seller";

export default function EditSeller() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSeller();
  }, [id]);

  async function loadSeller() {
    try {
      setLoading(true);

      const sellers = await getSellers();

      const currentSeller = sellers.find(
        (item) => item.id === Number(id)
      );

      if (!currentSeller) {
        navigate("/vendedores", {
          state: {
            message: "Vendedor não encontrado!",
            type: "error",
          },
        });

        return;
      }

      setSeller(currentSeller);
    } catch (error) {
      console.error(error);

      navigate("/vendedores", {
        state: {
          message:
            "Erro ao carregar vendedor!",
          type: "error",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (
    data: SellerFormData
  ) => {
    if (!seller) return;

    try {
      await updateUser(seller.user, {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        password:
          data.password || undefined,
        is_active: data.is_active,
        group: data.group,
      });

      await updateSeller(seller.id, {
        user: seller.user,
        phone: data.phone,
      });

      navigate("/vendedores", {
        state: {
          message:
            "Vendedor atualizado com sucesso!",
          type: "success",
        },
      });
    } catch (error) {
      console.error(error);

      navigate("/vendedores", {
        state: {
          message:
            "Erro ao atualizar vendedor!",
          type: "error",
        },
      });
    }
  };

  if (loading) {
    return (
      <p className="p-10 text-center text-teal-700 font-bold">
        Carregando...
      </p>
    );
  }

  if (!seller) {
    return null;
  }

  return (
    <SellerForm
      title="Editar Vendedor"
      initialData={{
        first_name: seller.first_name,
        last_name: seller.last_name,
        email: seller.email,
        phone: seller.phone,
        password: "",
        group: seller.group,
        is_active: seller.is_active,
      }}
      onSave={handleSave}
    />
  );
}
