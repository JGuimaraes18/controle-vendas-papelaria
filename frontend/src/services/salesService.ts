import { api } from "./api";
import type {
  Sale,
  SaleChangeLog,
  SaleCreatePayload,
  SaleListParams,
} from "../types/Sale";
import type { PaginatedResponse } from "../types/Pagination";

export async function getSales(
  params: SaleListParams = {}
): Promise<PaginatedResponse<Sale>> {
  const response = await api.get<PaginatedResponse<Sale>>("/api/sales/", {
    params,
  });
  return response.data;
}

export async function getSale(id: number): Promise<Sale> {
  const response = await api.get<Sale>(`/api/sales/${id}/`);
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

export async function cancelSale(
  id: number,
  reason: string
): Promise<Sale> {
  const response = await api.post<Sale>(`/api/sales/${id}/cancel/`, {
    reason,
  });
  return response.data;
}

export async function deleteSale(id: number): Promise<void> {
  await api.delete(`/api/sales/${id}/`);
}