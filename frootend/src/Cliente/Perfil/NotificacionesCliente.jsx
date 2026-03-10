import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function NotificacionesCliente() {
  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Notificaciones</h1>
      <p className="page-subtitle mt-2">Preferencias y alertas internas.</p>

      <div className="card mt-8 p-8 space-y-4">
        {[
          "Avisos de próxima cita",
          "Promociones AVYNA",
          "Cambios en citas",
        ].map((t) => (
          <label key={t} className="flex items-center justify-between p-4 rounded-xl bg-violet-50/50 border border-violet-100 cursor-pointer hover:bg-violet-50 transition-colors">
            <span className="font-semibold text-slate-700">{t}</span>
            <input type="checkbox" defaultChecked className="w-5 h-5 text-violet-500 rounded focus:ring-violet-400 border-violet-300" />
          </label>
        ))}

        <div className="flex gap-4 pt-4">
          <Button className="w-full py-3 rounded-xl">Guardar</Button>
          <Link to="/cliente/notificaciones" className="w-full">
            <Button variant="outline" className="w-full py-3 rounded-xl border-2">Configurar recordatorios</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
