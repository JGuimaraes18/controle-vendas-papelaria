import { api } from "./api";
import type { Seller } from "../types/Seller";

export interface SellerPayload {
  user: number;
  phone: string;
}

export async function getSellers(): Promise<Seller[]> {
  const response = await api.get<Seller[]>(
    "/api/sellers/"
  );

  return response.data;
}

export async function createSeller(
  data: SellerPayload
): Promise<Seller> {
  const response = await api.post<Seller>(
    "/api/sellers/",
    data
  );

  return response.data;
}

export async function updateSeller(
  id: number,
  data: SellerPayload
): Promise<Seller> {
  const response = await api.put<Seller>(
    `/api/sellers/${id}/`,
    data
  );

  return response.data;
}

export async function deleteSeller(
  id: number
): Promise<void> {
  await api.delete(`/api/sellers/${id}/`);
}