import type { Product } from "../types/Product";
import { api } from "./api";

export type ProductPayload = Omit<Product, "id" | "code">;

export async function getProducts(): Promise<Product[]> {
  const response = await api.get<Product[]>("/api/products/");
  return response.data;
}

export async function createProduct(
  data: ProductPayload
): Promise<Product> {
  const response = await api.post<Product>("/api/products/", data);
  return response.data;
}

export async function updateProduct(
  id: number,
  data: ProductPayload
): Promise<Product> {
  const response = await api.put<Product>(
    `/api/products/${id}/`,
    data
  );
  return response.data;
}

export async function deleteProduct(id: number): Promise<void> {
  await api.delete(`/api/products/${id}/`);
}