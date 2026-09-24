export interface SaleItem {
  id: number;
  product: number;
  product_description: string;
  quantity: number;
  unit_price: number;
  total_value: number;
}

export interface Sale {
  id: number;
  invoice_number: string;
  date: string;
  status: "COMPLETED" | "CANCELLED";
  customer: number;
  seller: number;
  items: SaleItem[];
  total_value: number;
  cancelled_by?: number | null;
  cancelled_by_name?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string;
}

export interface PurchaseHistoryItem {
  id: number;
  invoice_number: string;
  date: string;
  status: "COMPLETED" | "CANCELLED";
  seller: number;
  seller_name: string;
  item_count: number;
  total_value: number;
  items: SaleItem[];
  cancelled_at?: string | null;
  cancelled_by_name?: string | null;
  cancellation_reason?: string;
}

export interface SaleItemPayload {
  product: number;  
  quantity: number;
}

export interface SaleCreatePayload {
  customer: number;
  seller: number;
  items: SaleItemPayload[];
}

export interface ItemSnapshot {
  product: number;
  product_description: string;
  quantity: number;
  unit_price: string;
}

export interface UpdatedItemSnapshot {
  product: number;
  product_description: string;
  before: { quantity: number; unit_price: string };
  after: { quantity: number; unit_price: string };
}

export type FieldChange =
  | { before: unknown; after: unknown }
  | {
      added: ItemSnapshot[];
      removed: ItemSnapshot[];
      updated: UpdatedItemSnapshot[];
    };

export interface SaleChangeLog {
  id: number;
  sale: number;
  user: number;
  user_name: string;
  changed_at: string;
  fields_changed: Record<string, FieldChange>;
}