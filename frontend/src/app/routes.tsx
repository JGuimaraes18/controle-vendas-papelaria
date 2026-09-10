import { BrowserRouter, Routes, Route } from "react-router-dom";
import type { ReactElement } from "react";
import Layout from "../components/layout/Layout";
import SalesPage from "../pages/sales/SalesPage";
import EditSale from "../pages/sales/EditSale";
import CreateSale from "../pages/sales/CreateSale";
import CommissionPage from "../pages/commission/CommissionPage";
import LoginPage from "../pages/login/LoginPage";
import PrivateRoute from "./privateRoute";
import NotFoundPage from "../pages/errors/NotFoundPage";
import ServerErrorPage from "../pages/errors/ServerErrorPage";
import CustomersPage from "../pages/customers/CustomersPage";
import CreateCustomer from "../pages/customers/CreateCustomer";
import EditCustomer from "../pages/customers/EditCustomer";

interface AppRoute {
  path: string;
  element: ReactElement;
  title: string;
  roles?: string[];
}

const routes: AppRoute[] = [
  {
    path: "/login",
    element: <LoginPage />,
    title: "Login",
  },
  {
    path: "/",
    element: <SalesPage />,
    title: "Vendas",
    roles: ["ADMIN", "SELLER"],
  },
  {
    path: "/vendas/nova",
    element: <CreateSale />,
    title: "Nova Venda",
    roles: ["ADMIN", "SELLER"],
  },
  {
    path: "/vendas/editar/:id",
    element: <EditSale />,
    title: "Editar Venda",
    roles: ["ADMIN"],
  },
  {
    path: "/clientes",
    element: <CustomersPage />,
    title: "Clientes",
    roles: ["ADMIN"],
  },
  {
    path: "/clientes/novo",
    element: <CreateCustomer />,
    title: "Novo Cliente",
    roles: ["ADMIN"],
  },
  {
    path: "/clientes/editar/:id",
    element: <EditCustomer />,
    title: "Editar Cliente",
    roles: ["ADMIN"],
  },
  {
    path: "/comissoes",
    element: <CommissionPage />,
    title: "Comissões",
    roles: ["ADMIN"],
  },
];

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <PrivateRoute>
              <Layout routes={routes} />
            </PrivateRoute>
          }
        >
          {routes
            .filter((route) => route.path !== "/login")
            .map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <PrivateRoute allowedRoles={route.roles}>
                    {route.element}
                  </PrivateRoute>
                }
              />
            ))}
        </Route>

        <Route path="*" element={<NotFoundPage />} />
        
        <Route path="/error" element={<ServerErrorPage />} />

      </Routes>
    </BrowserRouter>
  );
}