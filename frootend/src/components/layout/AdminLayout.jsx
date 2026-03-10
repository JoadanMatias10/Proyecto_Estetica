import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";
import Breadcrumbs from "../ui/Breadcrumbs";
import LoadingSpinner from "../ui/LoadingSpinner";
import { endpoints } from "../../api";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const verifyAdminSession = async () => {
      const adminToken = localStorage.getItem("adminToken") || localStorage.getItem("token");
      const rawAdminUser = localStorage.getItem("adminUser") || localStorage.getItem("user");

      if (!adminToken || !rawAdminUser) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const parsed = JSON.parse(rawAdminUser);
        if (!parsed || parsed.role !== "admin") {
          navigate("/login", { replace: true });
          return;
        }
      } catch (_error) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const response = await fetch(endpoints.adminMe, {
          headers: { Authorization: `Bearer ${adminToken}` },
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

    verifyAdminSession();
  }, [navigate]);

  if (checkingAuth) {
    return <LoadingSpinner text="Validando acceso administrador..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-rose-50/50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 dark:text-white transition-colors duration-300">
      <AdminHeader />
      <AdminSidebar />
      <div className="max-w-7xl mx-auto w-full p-4">
        <main className="min-h-[calc(100vh-5rem)] md:pl-24 transition-all duration-300">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
