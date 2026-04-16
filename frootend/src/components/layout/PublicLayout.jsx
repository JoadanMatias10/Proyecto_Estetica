import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import PublicHeader from "./PublicHeader";

import PublicFooter from "./PublicFooter";
import Breadcrumbs from "../ui/Breadcrumbs";

export default function PublicLayout() {
  const location = useLocation();
  const shouldShowBreadcrumbs = location.pathname !== "/";
  const isHomePage = location.pathname === "/";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 dark:text-white transition-colors duration-300">
      <PublicHeader />
      <main className={isHomePage ? "" : "bg-gradient-to-b from-rose-100 via-rose-50 to-rose-100/90"}>
        {shouldShowBreadcrumbs ? (
          <div className="max-w-7xl mx-auto px-4 py-2 mt-2">
            <Breadcrumbs />
          </div>
        ) : null}
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

