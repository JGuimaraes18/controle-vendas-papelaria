import { api } from "./api";
import type { Sale, SaleChangeLog, SaleCreatePayload } from "../types/Sale";

export async function getSales(): Promise<Sale[]> {
  const response = await api.get<Sale[]>("/api/sales/");
  return response.data;
}

export async function getSaleHistory(id: number): Promise<SaleChangeLog[]> {
  const response = await api.get<SaleChangeLog[]>(`/api/sales/${id}/history/`);
  return response.data;
}

export async function createSale(
  data: SaleCreatePayload
): Promise<Sale> {
  const response = await api.post<Sale>("/api/sales/", data);
  return response.data;
}

export async function updateSale(
  id: number,
  data: SaleCreatePayload
): Promise<Sale> {
  const response = await api.put<Sale>(`/api/sales/${id}/`, data);
  return response.data;
}

export async function deleteSale(id: number): Promise<void> {
  await api.delete(`/api/sales/${id}/`);
}