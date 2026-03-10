import React from "react";
import { Outlet } from "react-router-dom";
import ClientHeader from "./ClientHeader";

import ClientSidebar from "./ClientSidebar";
import Breadcrumbs from "../ui/Breadcrumbs";

export default function ClientLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-rose-100/30 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 dark:text-white transition-colors duration-300">
      <ClientHeader />
      <ClientSidebar />
      <div className="max-w-7xl mx-auto w-full p-4">
        <main className="min-h-[calc(100vh-5rem)] md:pl-24 transition-all duration-300">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
