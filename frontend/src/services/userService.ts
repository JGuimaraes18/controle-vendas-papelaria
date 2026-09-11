import { api } from "./api";
import type {
  User,
  UserPayload,
} from "../types/User";

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