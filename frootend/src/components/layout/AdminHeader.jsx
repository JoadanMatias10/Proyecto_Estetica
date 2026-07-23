import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../../img/Logo para una est\u00e9ti.png";
import ThemeToggle from "../ui/ThemeToggle";
import MobileMenuButton from "./MobileMenuButton";

export default function AdminHeader({ isMenuOpen = false, onMenuToggle }) {
  const navigate = useNavigate();
  const [user, setUser] = useState({ nombre: "Administrador", correo: "admin@correo.com" });

  useEffect(() => {
    const storedUser = localStorage.getItem("adminUser");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (_error) {
        // Ignore parse errors.
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <header className="border-b border-violet-200/50 bg-white/70 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
      <div className="flex h-16 items-center justify-between gap-2 px-3 sm:h-20 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <MobileMenuButton
            isOpen={isMenuOpen}
            onClick={onMenuToggle}
            controls="admin-sidebar"
            className="md:hidden"
          />
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg shadow-md sm:h-10 sm:w-10">
            <img src={Logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 leading-tight max-[420px]:hidden">
            <div className="truncate text-sm font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent sm:text-base">
              Estetica Panamericana
            </div>
            <div className="hidden text-xs text-violet-600 font-medium sm:block">Panel interno</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <ThemeToggle />
          <div className="hidden sm:block text-right">
            <div className="text-sm font-semibold text-violet-700">{user.nombre || "Administrador"}</div>
            <div className="text-xs text-violet-500">{user.correo || "admin@correo.com"}</div>
          </div>
          <div className="hidden h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-violet-200 to-rose-200 font-bold text-violet-700 shadow-sm sm:flex">
            {user.nombre ? user.nombre.charAt(0).toUpperCase() : "A"}
          </div>

          <button
            onClick={handleLogout}
            className="rounded-md border border-transparent px-2.5 py-2 text-xs font-semibold text-violet-500 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 sm:ml-2 sm:px-3 sm:py-1.5"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
