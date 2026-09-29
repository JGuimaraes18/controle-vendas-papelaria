import { api } from "./api";

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  access: string;
  refresh: string;
  user: any;
}

export function setAuth(data: {
  access: string;
  refresh: string;
  user: any;
}) {
  localStorage.setItem("token", data.access);
  localStorage.setItem("refresh", data.refresh);
  localStorage.setItem("user", JSON.stringify(data.user));
}

export function getToken() {
  return localStorage.getItem("token");
}

export function getRefresh() {
  return localStorage.getItem("refresh");
}

export function getUser() {
  const data = localStorage.getItem("user");
  return data ? JSON.parse(data) : null;
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/login/", credentials);
  setAuth(data);
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh");
  localStorage.removeItem("user");
}

export function isAdmin() {
  const user = getUser();
  return user?.groups?.includes("ADMIN");
}

export function isSeller() {
  const user = getUser();
  return user?.groups?.includes("SELLER");
}