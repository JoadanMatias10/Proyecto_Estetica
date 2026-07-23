import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import EstilistaHeader from "./EstilistaHeader";
import EstilistaSidebar from "./EstilistaSidebar";
import Breadcrumbs from "../ui/Breadcrumbs";
import LoadingSpinner from "../ui/LoadingSpinner";
import { endpoints } from "../../api";
import useResponsiveSidebar from "./useResponsiveSidebar";

export default function EstilistaLayout() {
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const sidebar = useResponsiveSidebar();

  useEffect(() => {
    const verifyEstilistaSession = async () => {
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token");
      const rawUser = localStorage.getItem("adminUser") || localStorage.getItem("user");

      if (!token || !rawUser) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const parsed = JSON.parse(rawUser);
        if (parsed?.role === "admin") {
          navigate("/admin", { replace: true });
          return;
        }
        if (!parsed || parsed.role !== "stylist") {
          navigate("/login", { replace: true });
          return;
        }
      } catch (_error) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const response = await fetch(endpoints.stylistMe, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminUser");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }

        const data = await response.json();
        localStorage.setItem("adminUser", JSON.stringify(data.user));
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch (_error) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyEstilistaSession();
  }, [navigate]);

  if (checkingAuth) {
    return <LoadingSpinner text="Validando acceso..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-rose-50/50 to-violet-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 dark:text-white transition-colors duration-300">
      <EstilistaHeader isMenuOpen={sidebar.isOpen} onMenuToggle={sidebar.toggle} />
      <EstilistaSidebar isOpen={sidebar.isOpen} onClose={sidebar.close} />
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:p-4">
        <main className="min-w-0 min-h-[calc(100vh-4rem)] transition-all duration-300 sm:min-h-[calc(100vh-5rem)] md:pl-24">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
