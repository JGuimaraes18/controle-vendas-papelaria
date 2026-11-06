export interface DemoAccount {
  id: "ADMIN" | "SELLER";
  label: string;
  description: string;
  email: string;
  password: string;
}

export const DEMO_ACCOUNTS: Record<DemoAccount["id"], DemoAccount> = {
  ADMIN: {
    id: "ADMIN",
    label: "Administrador",
    description: "Visão geral e gestão completa do sistema",
    email: "admin.demo@civen.app",
    password: "Civen@Demo2024",
  },
  SELLER: {
    id: "SELLER",
    label: "Vendedor",
    description: "Experiência do vendedor com acesso restrito",
    email: "vendedor.demo@civen.app",
    password: "Civen@Demo2024",
  },
};
