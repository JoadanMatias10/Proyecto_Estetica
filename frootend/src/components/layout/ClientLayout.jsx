import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import ClientHeader from "./ClientHeader";

import ClientSidebar from "./ClientSidebar";
import Breadcrumbs from "../ui/Breadcrumbs";
import { getClientToken, getStoredClientUser } from "../../utils/clientStore";
import useResponsiveSidebar from "./useResponsiveSidebar";

export default function ClientLayout() {
  const sidebar = useResponsiveSidebar();

  if (!getClientToken()) {
    return <Navigate to="/login" replace />;
  }

  const user = getStoredClientUser();
  if (user?.role && user.role !== "client") {
    return <Navigate to={user.role === "stylist" ? "/estilista" : "/admin"} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-rose-100/30 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 dark:text-white transition-colors duration-300">
      <ClientHeader isMenuOpen={sidebar.isOpen} onMenuToggle={sidebar.toggle} />
      <ClientSidebar isOpen={sidebar.isOpen} onClose={sidebar.close} />
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:p-4">
        <main className="min-w-0 min-h-[calc(100vh-4rem)] transition-all duration-300 sm:min-h-[calc(100vh-5rem)] md:pl-24">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
