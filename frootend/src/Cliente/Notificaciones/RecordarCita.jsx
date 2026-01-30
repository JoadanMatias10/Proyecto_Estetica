import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function RecordarCita() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Recordar cita</h1>
          <p className="text-rose-700/70 mt-1">Configura recordatorios para tus citas.</p>
        </div>
        <Link to="/cliente/notificaciones/enviar">
          <Button variant="outline" className="px-5 py-2.5 border-rose-300 text-rose-600 hover:bg-rose-50 border-2">Notificar citas</Button>
        </Link>
      </div>

      <div className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md space-y-6">
        <div>
          <label className="text-sm font-bold text-rose-700 mb-2 block">¿Cuándo recordar?</label>
          <select className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all">
            <option>24 horas antes</option>
            <option>12 horas antes</option>
            <option>2 horas antes</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-rose-700 mb-2 block">Canal</label>
          <select className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all">
            <option>Email</option>
            <option>WhatsApp (demo)</option>
            <option>Notificación interna</option>
          </select>
        </div>

        <Button className="w-full py-4 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-bold hover:shadow-glow transform hover:-translate-y-0.5 transition-all">Guardar configuración</Button>
      </div>
    </div>
  );
}
