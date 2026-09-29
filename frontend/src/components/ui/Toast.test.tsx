import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider, useToast } from "./Toast";

function Trigger() {
  const toast = useToast();
  return (
    <button onClick={() => toast.success("Venda criada com sucesso!")}>
      Mostrar toast
    </button>
  );
}

function renderHarness(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    </MemoryRouter>
  );
}

describe("Toast", () => {
  it("exibe toast disparado pelo contexto e fecha ao clicar", async () => {
    const user = userEvent.setup();
    renderHarness(["/"]);

    expect(
      screen.queryByText("Venda criada com sucesso!")
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mostrar toast" }));

    expect(
      screen.getByText("Venda criada com sucesso!")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(
      screen.queryByText("Venda criada com sucesso!")
    ).not.toBeInTheDocument();
  });

  it("exibe mensagem vinda do estado de navegação", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/vendas", state: { message: "Venda cancelada." } },
        ]}
      >
        <ToastProvider>
          <div>Página</div>
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Venda cancelada.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(document.body.textContent).not.toContain("Venda cancelada.");
  });
});