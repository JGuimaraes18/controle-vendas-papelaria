export type ThemePreference = "light" | "dark" | "system";
export type AccentName =
  | "teal"
  | "blue"
  | "indigo"
  | "violet"
  | "crimson"
  | "amber";

export const ACCENTS: { name: AccentName; label: string; color: string }[] = [
  { name: "teal", label: "Teal", color: "#0d9488" },
  { name: "blue", label: "Azul", color: "#2563eb" },
  { name: "indigo", label: "Índigo", color: "#4f46e5" },
  { name: "violet", label: "Violeta", color: "#7c3aed" },
  { name: "crimson", label: "Crimson", color: "#e11d48" },
  { name: "amber", label: "Âmbar", color: "#d97706" },
];

const THEME_KEY = "theme";
const ACCENT_KEY = "accent";

const media = window.matchMedia("(prefers-color-scheme: dark)");

function resolve(preference: ThemePreference): "light" | "dark" {
  if (preference === "system") {
    return media.matches ? "dark" : "light";
  }
  return preference;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function applyTheme() {
  const preference = getTheme();
  document.documentElement.setAttribute(
    "data-theme",
    resolve(preference)
  );
}

export function getTheme(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

export function setTheme(preference: ThemePreference) {
  localStorage.setItem(THEME_KEY, preference);
  applyTheme();
  notify();
}

export function getResolvedTheme(): "light" | "dark" {
  return resolve(getTheme());
}

export function toggleTheme() {
  setTheme(getResolvedTheme() === "dark" ? "light" : "dark");
}

export function getAccent(): AccentName {
  const stored = localStorage.getItem(ACCENT_KEY);
  return ACCENTS.some((accent) => accent.name === stored)
    ? (stored as AccentName)
    : "teal";
}

export function setAccent(accent: AccentName) {
  localStorage.setItem(ACCENT_KEY, accent);
  document.documentElement.setAttribute("data-accent", accent);
  notify();
}

media.addEventListener("change", () => {
  applyTheme();
  notify();
});