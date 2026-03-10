import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../../img/Logo para una estéti.png";
import ThemeToggle from "../ui/ThemeToggle";

export default function ClientHeader() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ nombre: "Cliente", correo: "cliente@correo.com" });

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Error parsing user data");
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <header className="border-b border-rose-200/50 bg-white/70 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
      <div className="h-20 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-md">
            <img src={Logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="leading-tight">
            <div className="font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Estética Panamericana</div>
            <div className="text-xs text-rose-600 font-medium">Panel del cliente</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="hidden sm:block text-right">
            <div className="text-sm font-semibold text-rose-700">{user.nombre || "Cliente"}</div>
            <div className="text-xs text-rose-500">{user.correo || "cliente@correo.com"}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-200 to-rose-300 flex items-center justify-center text-rose-700 font-bold shadow-sm border-2 border-white">
            {user.nombre ? user.nombre.charAt(0).toUpperCase() : "C"}
          </div>

          <button
            onClick={handleLogout}
            className="ml-2 text-xs font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-rose-200"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );

}
