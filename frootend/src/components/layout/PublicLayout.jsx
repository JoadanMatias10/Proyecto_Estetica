import React from "react";
import { Outlet } from "react-router-dom";
import PublicHeader from "./PublicHeader";

import PublicFooter from "./PublicFooter";
import Breadcrumbs from "../ui/Breadcrumbs";

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-rose-100/30 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 dark:text-white transition-colors duration-300">
      <PublicHeader />
      <main>
        <div className="max-w-7xl mx-auto px-4 py-2 mt-2">
          <Breadcrumbs />
        </div>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

