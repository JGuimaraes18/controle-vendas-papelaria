export interface DashboardSummary {
  revenue: string;
  completed_sales: number;
  cancelled_sales: number;
  average_ticket: string;
}

export interface DashboardDailyPoint {
  date: string;
  revenue: string;
}

export interface DashboardTopProduct {
  description: string;
  quantity: number;
  revenue: string;
}

export interface DashboardTopSeller {
  seller_id: number;
  name: string;
  sales: number;
  revenue: string;
}

export interface DashboardData {
  start_date: string;
  end_date: string;
  summary: DashboardSummary;
  daily: DashboardDailyPoint[];
  top_products: DashboardTopProduct[];
  top_sellers: DashboardTopSeller[];
}

export interface DashboardParams {
  start_date?: string;
  end_date?: string;
}