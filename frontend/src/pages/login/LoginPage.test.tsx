import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "./LoginPage";
import { DEMO_ACCOUNTS } from "../../services/demoAccounts";
import * as authService from "../../services/authService";

const mockLogin = vi.fn();
vi.spyOn(authService, "login").mockImplementation(mockLogin);

describe("LoginPage", () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it("exibe a seção 'Experimente o CIVEN' com as duas opções de perfil", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText("Experimente o CIVEN", { exact: false })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Acessar como Administrador/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Acessar como Vendedor/i })
    ).toBeInTheDocument();
  });

  it("preenche as credenciais do ADMIN ao clicar na opção Administrador", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText("nome@empresa.com");
    const passwordInput = screen.getByPlaceholderText("••••••••");

    expect(emailInput).toHaveValue("");
    expect(passwordInput).toHaveValue("");

    await user.click(
      screen.getByRole("button", { name: /Acessar como Administrador/i })
    );

    expect(emailInput).toHaveValue(DEMO_ACCOUNTS.ADMIN.email);
    expect(passwordInput).toHaveValue(DEMO_ACCOUNTS.ADMIN.password);
  });

  it("preenche as credenciais do SELLER ao clicar na opção Vendedor", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText("nome@empresa.com");
    const passwordInput = screen.getByPlaceholderText("••••••••");

    await user.click(
      screen.getByRole("button", { name: /Acessar como Vendedor/i })
    );

    expect(emailInput).toHaveValue(DEMO_ACCOUNTS.SELLER.email);
    expect(passwordInput).toHaveValue(DEMO_ACCOUNTS.SELLER.password);
  });

  it("substitui a seleção anterior ao trocar de perfil", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText("nome@empresa.com");
    const passwordInput = screen.getByPlaceholderText("••••••••");

    await user.click(
      screen.getByRole("button", { name: /Acessar como Administrador/i })
    );
    expect(emailInput).toHaveValue(DEMO_ACCOUNTS.ADMIN.email);

    await user.click(
      screen.getByRole("button", { name: /Acessar como Vendedor/i })
    );
    expect(emailInput).toHaveValue(DEMO_ACCOUNTS.SELLER.email);
    expect(passwordInput).toHaveValue(DEMO_ACCOUNTS.SELLER.password);
  });

  it("exibe instrução de que o usuário deve clicar em Acessar Conta", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Clique em "Acessar Conta" para entrar/i)
    ).toBeInTheDocument();
  });

  it("não realiza login automático ao clicar apenas nas opções de demonstração", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.click(
      screen.getByRole("button", { name: /Acessar como Administrador/i })
    );
    await user.click(
      screen.getByRole("button", { name: /Acessar como Vendedor/i })
    );

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("mantém o login tradicional funcionando com credenciais manuais", async () => {
    mockLogin.mockResolvedValueOnce({
      access: "access-token",
      refresh: "refresh-token",
      user: { id: 1, email: "manual@email.com", groups: ["ADMIN"] },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText("nome@empresa.com");
    const passwordInput = screen.getByPlaceholderText("••••••••");

    await user.type(emailInput, "manual@email.com");
    await user.type(passwordInput, "senha123");

    await user.click(screen.getByRole("button", { name: /Acessar Conta/i }));

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith({
      email: "manual@email.com",
      password: "senha123",
    });
  });
});
