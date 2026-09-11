import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  UserRound,
  Mail,
  Phone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  getSellers,
  deleteSeller,
} from "../../services/sellerService";

import type { Seller } from "../../types/Seller";
import { ConfirmModal } from "../../components/layout/ui/ConfirmModal";

interface SellerListProps {
  searchTerm?: string;
}

export default function SellerList({
  searchTerm = "",
}: SellerListProps) {
  const navigate = useNavigate();

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sellerToDelete, setSellerToDelete] =
    useState<Seller | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchSellers();
  }, []);

  async function fetchSellers() {
    try {
      setLoading(true);
      setError(null);

      const data = await getSellers();
      setSellers(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os vendedores.");
    } finally {
      setLoading(false);
    }
  }

  const filteredSellers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return sellers;
    }

    return sellers.filter(
      (seller) =>
      (seller.full_name || "").toLowerCase().includes(term) ||
      (seller.email || "").toLowerCase().includes(term) ||
      (seller.phone || "").toLowerCase().includes(term)
    );
  },[sellers, searchTerm]);



  const handleDelete = async () => {
    if (!sellerToDelete) return;

    try {
      await deleteSeller(sellerToDelete.id);

      setSellers((current) =>
        current.map((seller) =>
          seller.id === sellerToDelete.id
            ? {
                ...seller,
                is_active: false,
              }
            : seller
        )
      );

      setModalOpen(false);
      setSellerToDelete(null);

      navigate("/vendedores", {
        state: {
          message: "Vendedor desativado com sucesso!",
          type: "success",
        },
      });
    } catch (err) {
      console.error(err);

      setModalOpen(false);
      setSellerToDelete(null);

      navigate("/vendedores", {
        state: {
          message: "Erro ao desativar vendedor!",
          type: "error",
        },
      });
    }
  };

  const openDeleteModal = (seller: Seller) => {
    setSellerToDelete(seller);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <p className="p-10 text-center text-teal-700 font-bold">
        Carregando...
      </p>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-rose-600 text-xs font-medium">
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-slate-500 font-semibold text-[11px] uppercase">
                <th className="p-2.5 w-[25%]">
                  Vendedor 
                </th>

                <th className="p-2.5 w-[25%]">
                  E-mail
                </th>

                <th className="p-2.5 w-[15%]">
                  Telefone
                </th>

                <th className="p-2.5 w-[15%]">
                  Perfil
                </th>

                <th className="p-2.5 w-[10%]">
                  Status
                </th>

                <th className="p-2.5 w-[10%] text-center">
                  Ação
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 text-xs">
              {filteredSellers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-slate-400 text-[11px]"
                  >
                    {searchTerm
                      ? "Nenhum vendedor encontrado."
                      : "Nenhum vendedor cadastrado."}
                  </td>
                </tr>
              ) : (
                filteredSellers.map((seller) => (
                  <tr
                    key={seller.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                          <UserRound
                            size={13}
                            className="text-teal-600"
                          />
                        </div>

                        <span className="text-slate-800 font-semibold">
                          {seller.full_name}
                        </span>
                      </div>
                    </td>

                    <td className="p-2.5 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Mail
                          size={12}
                          className="text-slate-400"
                        />

                        {seller.email}
                      </div>
                    </td>

                    <td className="p-2.5 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Phone
                          size={12}
                          className="text-slate-400"
                        />

                        {seller.phone || "-"}
                      </div>
                    </td>

                    <td className="p-2.5">
                      <span
                        className={
                          seller.group === "ADMIN"
                            ? "px-2 py-1 rounded-md bg-violet-50 text-violet-600"
                            : "px-2 py-1 rounded-md bg-teal-50 text-teal-600"
                        }
                      >
                        {seller.group === "ADMIN"
                          ? "Administrador"
                          : "Vendedor"}
                      </span>
                    </td>

                    <td className="p-2.5">
                      <span
                        className={
                          seller.is_active
                            ? "px-2 py-1 rounded-md bg-emerald-50 text-emerald-600"
                            : "px-2 py-1 rounded-md bg-slate-100 text-slate-500"
                        }
                      >
                        {seller.is_active
                          ? "Ativo"
                          : "Inativo"}
                      </span>
                    </td>

                    <td className="p-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() =>
                            navigate(
                              `/vendedores/editar/${seller.id}`
                            )
                          }
                          className="p-1.5 text-slate-400 hover:text-teal-600 rounded hover:bg-slate-100 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>

                        {seller.is_active && (
                          <button
                            onClick={() =>
                              openDeleteModal(seller)
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors"
                            title="Desativar"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sellerToDelete && (
        <ConfirmModal
          isOpen={modalOpen}
          onCancel={() => {
            setModalOpen(false);
            setSellerToDelete(null);
          }}
          onConfirm={handleDelete}
          title="Desativar Vendedor"
          message={`Deseja realmente desativar o vendedor "${sellerToDelete.full_name}"? O histórico de vendas será mantido.`}
        />
      )}
    </>
  );
}