import { describe, expect, it } from "vitest";
import {
  formatCurrencyInput,
  formatPhone,
  parseCurrencyInput,
  saleStatusLabel,
} from "./format";

describe("formatPhone", () => {
  it("formata em passos progressivos", () => {
    expect(formatPhone("11")).toBe("(11");
    expect(formatPhone("119")).toBe("(11) 9");
    expect(formatPhone("1198765")).toBe("(11) 9876-5");
    expect(formatPhone("119876543")).toBe("(11) 9876-543");
    expect(formatPhone("1198765432")).toBe("(11) 9876-5432");
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("ignora caracteres não numéricos", () => {
    expect(formatPhone("(11) 98765-4321")).toBe("(11) 98765-4321");
  });

  it("devolve string vazia para entrada vazia", () => {
    expect(formatPhone("")).toBe("");
  });
});

describe("formatCurrencyInput", () => {
  it("converte centavos digitados em moeda pt-BR", () => {
    expect(formatCurrencyInput("1")).toBe("0,01");
    expect(formatCurrencyInput("1250")).toBe("12,50");
    expect(formatCurrencyInput("100000")).toBe("1.000,00");
  });
});

describe("parseCurrencyInput", () => {
  it("produz valor com duas casas decimais", () => {
    expect(parseCurrencyInput("1250")).toBe("12.50");
    expect(parseCurrencyInput("")).toBe("0.00");
  });
});

describe("saleStatusLabel", () => {
  it("mapeia os status conhecidos", () => {
    expect(saleStatusLabel("COMPLETED")).toBe("Concluída");
    expect(saleStatusLabel("CANCELLED")).toBe("Cancelada");
  });

  it("devolve o próprio valor para status desconhecido", () => {
    expect(saleStatusLabel("PENDING")).toBe("PENDING");
  });

  it("devolve travessão para ausência de status", () => {
    expect(saleStatusLabel(undefined)).toBe("—");
  });
});