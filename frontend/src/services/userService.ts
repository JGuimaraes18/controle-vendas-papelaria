import { api } from "./api";
import type {
  User,
  UserGroup,
  UserPayload,
} from "../types/User";

export interface Profile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  groups: UserGroup[];
  seller_id: number | null;
  phone: string | null;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
  confirm_new_password: string;
}

export async function getMe(): Promise<Profile> {
  const response = await api.get<Profile>(
    "/api/users/me/"
  );

  return response.data;
}

export async function changePassword(
  data: ChangePasswordPayload
): Promise<void> {
  await api.post(
    "/api/users/change-password/",
    data
  );
}

export async function getUsers(): Promise<User[]> {
  const response = await api.get<User[]>(
    "/api/users/"
  );

  return response.data;
}

export async function createUser(
  data: UserPayload
): Promise<User> {
  const response = await api.post<User>(
    "/api/users/",
    data
  );

  return response.data;
}

export async function updateUser(
  id: number,
  data: UserPayload
): Promise<User> {
  const response = await api.put<User>(
    `/api/users/${id}/`,
    data
  );

  return response.data;
}

export async function deleteUser(
  id: number
): Promise<void> {
  await api.delete(`/api/users/${id}/`);
}