export type SellerGroup = "ADMIN" | "SELLER";

export interface Seller {
  id: number;
  user: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  group: SellerGroup;
  is_active: boolean;
}