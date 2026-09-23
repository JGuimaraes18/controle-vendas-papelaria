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
import SortableTh from "../../components/layout/ui/SortableTh";
import type { SortDirection } from "../../components/layout/ui/SortableTh";
import { isAdmin } from "../../services/authService";

interface ProductListProps {
  searchTerm: string;
}

type ProductSortKey = "code" | "description" | "unit_price" | "commission_percent";

export default function ProductList({
  searchTerm,
}: ProductListProps) {
  const navigate = useNavigate();

  const admin = isAdmin();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ProductSortKey>("description");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

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

  function toggleSort(key: ProductSortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    const filtered = term
      ? products.filter(
          (product) =>
            product.code.toLowerCase().includes(term) ||
            product.description.toLowerCase().includes(term)
        )
      : [...products];

    return filtered.sort((a, b) => {
      let cmp: number;

      switch (sortKey) {
        case "code":
          cmp = a.code.localeCompare(b.code);
          break;
        case "unit_price":
          cmp = Number(a.unit_price) - Number(b.unit_price);
          break;
        case "commission_percent":
          cmp = Number(a.commission_percent) - Number(b.commission_percent);
          break;
        case "description":
        default:
          cmp = a.description.localeCompare(b.description);
          break;
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [products, searchTerm, sortKey, sortDir]);

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
                <SortableTh
                  label="Código"
                  active={sortKey === "code"}
                  direction={sortDir}
                  onSort={() => toggleSort("code")}
                  className="p-2.5 w-[10%]"
                />
                <SortableTh
                  label="Descrição"
                  active={sortKey === "description"}
                  direction={sortDir}
                  onSort={() => toggleSort("description")}
                  className="p-2.5 w-[40%]"
                />
                <SortableTh
                  label="Preço Unitário"
                  active={sortKey === "unit_price"}
                  direction={sortDir}
                  onSort={() => toggleSort("unit_price")}
                  className="p-2.5 w-[18%]"
                />
                <SortableTh
                  label="Comissão"
                  active={sortKey === "commission_percent"}
                  direction={sortDir}
                  onSort={() => toggleSort("commission_percent")}
                  className="p-2.5 w-[17%]"
                />
                <th className="p-2.5 w-[15%] text-center">
                  {admin ? "Ação" : ""}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 text-xs">
              {sortedProducts.length === 0 ? (
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
                sortedProducts.map((product) => (
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
                      {admin && (
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
                      )}
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