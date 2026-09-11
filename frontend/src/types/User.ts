export type UserGroup = "ADMIN" | "SELLER";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  groups: UserGroup[];
}

export interface UserPayload {
  email: string;
  first_name: string;
  last_name: string;
  password?: string;
  is_active: boolean;
  group: UserGroup;
}