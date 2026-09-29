import { useEffect, useState } from "react";
import {
  Outlet,
  useLocation,
  matchPath,
} from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface AppRoute {
  path: string;
  element: React.ReactElement;
  title: string;
}

interface Props {
  routes: AppRoute[];
}

export default function Layout({ routes }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const currentRoute = routes.find((route) =>
    matchPath(
      { path: route.path, end: true },
      location.pathname
    )
  );

  const title = currentRoute?.title || "Dashboard";

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <Header
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        title={title}
      />

      <div className="flex flex-1 overflow-hidden">
        {isOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
        )}

        <div
          className={`fixed left-0 top-0 bottom-0 z-40 md:static md:z-auto transition-transform duration-300 ease-in-out ${
            isOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
          }`}
        >
          <Sidebar isOpen={isOpen} />
        </div>

        <main className="flex-1 overflow-y-auto p-4 transition-all duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
}