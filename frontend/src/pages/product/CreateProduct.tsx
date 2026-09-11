import { useNavigate } from "react-router-dom";

import ProductForm from "../../components/layout/ui/ProductForm";
import { createProduct } from "../../services/productService";

import type { ProductPayload } from "../../services/productService";

export default function CreateProduct() {
  const navigate = useNavigate();

  const handleCreate = async (
    payload: ProductPayload
  ) => {
    try {
      await createProduct(payload);

      navigate("/produtos", {
        state: {
          message: "Produto criado com sucesso!",
          type: "success",
        },
      });
    } catch (error) {
      console.error(error);

      navigate("/produtos", {
        state: {
          message: "Erro ao criar produto!",
          type: "error",
        },
      });
    }
  };

  return (
    <ProductForm
      title="Novo Produto"
      onSave={handleCreate}
    />
  );
}