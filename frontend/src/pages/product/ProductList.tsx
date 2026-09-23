import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Package,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  getProducts,
  deleteProduct,
} from "../../services/productService";

import type { Product } from "../../types/Product";
import { ConfirmModal } from "../../components/layout/ui/ConfirmModal";

interface ProductListProps {
  searchTerm: string;
}

export default function ProductList({
  searchTerm,
}: ProductListProps) {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productToDelete, setProductToDelete] =
    useState<Product | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      setError(null);

      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os produtos.");
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      return products;
    }

    return products.filter(
      (product) =>
        product.code.toLowerCase().includes(term) ||
        product.description.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      await deleteProduct(productToDelete.id);

      setProducts((current) =>
        current.filter(
          (product) =>
            product.id !== productToDelete.id
        )
      );

      setModalOpen(false);
      setProductToDelete(null);

      navigate("/produtos", {
        state: {
          message: "Produto excluído com sucesso!",
          type: "success",
        },
      });
    } catch (err) {
      console.error(err);

      setModalOpen(false);
      setProductToDelete(null);

      navigate("/produtos", {
        state: {
          message: "Erro ao excluir produto!",
          type: "error",
        },
      });
    }
  };

  const openDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setModalOpen(true);
  };

  const formatCurrency = (value: string) => {
    const number = Number(value);

    if (Number.isNaN(number)) {
      return value;
    }

    return number.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
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
                <th className="p-2.5 w-[10%]">Código</th>
                <th className="p-2.5 w-[40%]">
                  Descrição
                </th>
                <th className="p-2.5 w-[18%]">
                  Preço Unitário
                </th>
                <th className="p-2.5 w-[17%]">
                  Comissão
                </th>
                <th className="p-2.5 w-[15%] text-center">
                  Ação
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-slate-400 text-[11px]"
                  >
                    {searchTerm
                      ? "Nenhum produto encontrado."
                      : "Nenhum produto cadastrado."}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-2.5 text-slate-400 font-semibold">
                      {product.code}
                    </td>

                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                          <Package
                            size={13}
                            className="text-teal-600"
                          />
                        </div>

                        <span className="text-slate-800 font-semibold">
                          {product.description}
                        </span>
                      </div>
                    </td>

                    <td className="p-2.5 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        {formatCurrency(
                          product.unit_price
                        )}
                      </div>
                    </td>

                    <td className="p-2.5 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        {product.commission_percent}%
                      </div>
                    </td>

                    <td className="p-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() =>
                            navigate(
                              `/produtos/editar/${product.id}`
                            )
                          }
                          className="p-1.5 text-slate-400 hover:text-teal-600 rounded hover:bg-slate-100 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>

                        <button
                          onClick={() =>
                            openDeleteModal(product)
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {productToDelete && (
        <ConfirmModal
          isOpen={modalOpen}
          onCancel={() => {
            setModalOpen(false);
            setProductToDelete(null);
          }}
          onConfirm={handleDelete}
          title="Excluir Produto"
          message={`Deseja realmente excluir o produto "${productToDelete.description}"?`}
        />
      )}
    </>
  );
}