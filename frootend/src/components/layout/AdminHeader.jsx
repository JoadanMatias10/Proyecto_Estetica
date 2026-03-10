import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../../img/Logo para una est\u00e9ti.png";
import ThemeToggle from "../ui/ThemeToggle";

export default function AdminHeader() {
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
    navigate("/admin/login");
  };

  return (
    <header className="border-b border-violet-200/50 bg-white/70 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
      <div className="h-20 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-md">
            <img src={Logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="leading-tight">
            <div className="font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
              Estetica Panamericana
            </div>
            <div className="text-xs text-violet-600 font-medium">Panel administrador</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="hidden sm:block text-right">
            <div className="text-sm font-semibold text-violet-700">{user.nombre || "Administrador"}</div>
            <div className="text-xs text-violet-500">{user.correo || "admin@correo.com"}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-200 to-rose-200 flex items-center justify-center text-violet-700 font-bold shadow-sm border-2 border-white">
            {user.nombre ? user.nombre.charAt(0).toUpperCase() : "A"}
          </div>

          <button
            onClick={handleLogout}
            className="ml-2 text-xs font-semibold text-violet-500 hover:text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-violet-200"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
