import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function PerfilCliente() {
  return (
    <div className="space-y-5">
      <div className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Perfil del cliente</h1>
        <p className="text-rose-700/70 mt-3 text-lg">Administra tu información y notificaciones.</p>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <Link to="/cliente/perfil/info">
            <Button className="px-8 py-3 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold">Información del cliente</Button>
          </Link>
          <Link to="/cliente/perfil/notificaciones">
            <Button variant="outline" className="px-8 py-3 rounded-xl border-rose-300 text-rose-600 border-2">Notificaciones</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
