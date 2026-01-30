import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function NotificacionesCliente() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Notificaciones</h1>
      <p className="text-rose-700/70 mt-2">Preferencias y alertas internas.</p>

      <div className="mt-8 bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md space-y-4">
        {[
          "Avisos de próxima cita",
          "Promociones AVYNA",
          "Cambios en citas",
        ].map((t) => (
          <label key={t} className="flex items-center justify-between p-4 rounded-xl bg-rose-50/50 border border-rose-100 cursor-pointer hover:bg-rose-50 transition-colors">
            <span className="font-semibold text-rose-700">{t}</span>
            <input type="checkbox" defaultChecked className="w-5 h-5 text-rose-500 rounded focus:ring-rose-400 border-rose-300" />
          </label>
        ))}

        <div className="flex gap-4 pt-4">
          <Button className="w-full py-3 rounded-xl shadow-md bg-gradient-to-r from-rose-500 to-rose-400 text-white">Guardar</Button>
          <Link to="/cliente/notificaciones" className="w-full">
            <Button variant="outline" className="w-full py-3 rounded-xl border-rose-300 text-rose-600 border-2">Configurar recordatorios</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
