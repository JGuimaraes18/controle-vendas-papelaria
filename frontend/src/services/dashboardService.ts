import { api } from "./api";
import type { DashboardData } from "../types/Dashboard";

export async function getDashboard(
  startDate: string,
  endDate: string
): Promise<DashboardData> {
  const response = await api.get<DashboardData>("/api/dashboard/", {
    params: { start_date: startDate, end_date: endDate },
  });
  return response.data;
}