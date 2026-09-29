import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAccent,
  getResolvedTheme,
  getTheme,
  setAccent,
  setTheme,
  subscribeTheme,
  toggleTheme,
} from "./themeService";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-accent");
});

describe("themeService", () => {
  it("padrões de tema e accent", () => {
    expect(getTheme()).toBe("system");
    expect(getAccent()).toBe("teal");
  });

  it("persiste e aplica tema escuro", () => {
    setTheme("dark");
    expect(getTheme()).toBe("dark");
    expect(getResolvedTheme()).toBe("dark");
    expect(
      document.documentElement.getAttribute("data-theme")
    ).toBe("dark");
  });

  it("alterna o tema resolvido", () => {
    setTheme("light");
    toggleTheme();
    expect(getResolvedTheme()).toBe("dark");
    toggleTheme();
    expect(getResolvedTheme()).toBe("light");
  });

  it("aplica e persiste o accent escolhido", () => {
    setAccent("indigo");
    expect(getAccent()).toBe("indigo");
    expect(
      document.documentElement.getAttribute("data-accent")
    ).toBe("indigo");
  });

  it("notifica assinantes ao alterar", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    setTheme("dark");

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setTheme("light");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});