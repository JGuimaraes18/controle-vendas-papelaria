import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getProducts,
  updateProduct,
} from "../../services/productService";

import type { ProductPayload } from "../../services/productService";
import type { Product } from "../../types/Product";

import ProductForm from "../../components/layout/ui/ProductForm";

export default function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] =
    useState<Product | null>(null);

  useEffect(() => {
    async function loadProduct() {
      try {
        const products = await getProducts();

        const current = products.find(
          (product) => product.id === Number(id)
        );

        if (current) {
          setProduct(current);
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadProduct();
  }, [id]);

  const handleUpdate = async (
    payload: ProductPayload
  ) => {
    try {
      await updateProduct(Number(id), payload);

      navigate("/produtos", {
        state: {
          message: "Produto atualizado com sucesso!",
          type: "success",
        },
      });
    } catch (error) {
      console.error(error);

      navigate("/produtos", {
        state: {
          message: "Erro ao atualizar produto!",
          type: "error",
        },
      });
    }
  };

  if (!product) {
    return (
      <p className="p-10 text-center text-teal-700 font-bold">
        Carregando...
      </p>
    );
  }

  return (
    <ProductForm
      title={`Alterar Produto - ${product.code}`}
      initialData={product}
      onSave={handleUpdate}
    />
  );
}