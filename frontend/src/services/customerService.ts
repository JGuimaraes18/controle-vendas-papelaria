import type { Customer } from "../types/Customer";
import type { PurchaseHistoryItem } from "../types/Sale";
import { api } from "./api";

export type CustomerPayload = Omit<Customer, "id">;

export async function getCustomers(): Promise<Customer[]> {
  const response = await api.get<Customer[]>("/api/customers/");
  return response.data;
}

export async function getCustomerPurchaseHistory(
  id: number
): Promise<PurchaseHistoryItem[]> {
  const response = await api.get<PurchaseHistoryItem[]>(
    `/api/customers/${id}/purchase-history/`
  );
  return response.data;
}

export async function createCustomer(
  data: CustomerPayload
): Promise<Customer> {
  const response = await api.post<Customer>("/api/customers/", data);
  return response.data;
}

export async function updateCustomer(
  id: number,
  data: CustomerPayload
): Promise<Customer> {
  const response = await api.put<Customer>(
    `/api/customers/${id}/`,
    data
  );
  return response.data;
}

export async function deleteCustomer(id: number): Promise<void> {
  await api.delete(`/api/customers/${id}/`);
}