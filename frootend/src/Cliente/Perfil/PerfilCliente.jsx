import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function PerfilCliente() {
  return (
    <div className="space-y-5">
      <div className="card p-8">
        <h1 className="page-title">Perfil del cliente</h1>
        <p className="page-subtitle mt-3 text-lg">Administra tu información y notificaciones.</p>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <Link to="/cliente/perfil/info">
            <Button className="px-8 py-3 rounded-xl">Información del cliente</Button>
          </Link>
          <Link to="/cliente/perfil/notificaciones">
            <Button variant="outline" className="px-8 py-3 rounded-xl border-2">Notificaciones</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
