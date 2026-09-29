import { beforeEach, describe, expect, it } from "vitest";
import {
  getToken,
  getUser,
  isAdmin,
  isSeller,
  logout,
  setAuth,
} from "./authService";

const adminUser = { id: 1, email: "admin@email.com", groups: ["ADMIN"] };
const sellerUser = { id: 2, email: "seller@email.com", groups: ["SELLER"] };

beforeEach(() => {
  localStorage.clear();
});

describe("authService", () => {
  it("grava credenciais e usuário", () => {
    setAuth({ access: "token-123", refresh: "refresh-456", user: adminUser });

    expect(getToken()).toBe("token-123");
    expect(getUser()).toEqual(adminUser);
  });

  it("devolve null sem usuário salvo", () => {
    expect(getUser()).toBeNull();
  });

  it("limpa tudo no logout", () => {
    setAuth({ access: "a", refresh: "r", user: adminUser });
    logout();

    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  it("identifica o perfil pelo grupo", () => {
    setAuth({ access: "a", refresh: "r", user: adminUser });
    expect(isAdmin()).toBe(true);
    expect(isSeller()).toBe(false);

    setAuth({ access: "a", refresh: "r", user: sellerUser });
    expect(isAdmin()).toBe(false);
    expect(isSeller()).toBe(true);
  });
});