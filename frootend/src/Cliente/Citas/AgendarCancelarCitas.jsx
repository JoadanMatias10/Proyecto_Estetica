import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function AgendarCancelarCitas() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Gestión de citas</h1>
          <p className="text-rose-700/70 mt-1">Agenda, cancela o reprograma tus citas.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/cliente/citas/calendario">
            <Button variant="outline" className="px-5 py-2.5 border-rose-300 text-rose-600 hover:bg-rose-50">Ver disponibilidad</Button>
          </Link>
          <Link to="/cliente/citas/reprogramar">
            <Button className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-400 text-white shadow-md">Reprogramar</Button>
          </Link>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md">
        <h3 className="font-bold text-rose-700 text-xl border-b border-rose-100 pb-2 mb-4">Agendar nueva cita (demo)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-bold text-rose-700 mb-1 block">Servicio</label>
            <select className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all">
              <option>Corte</option>
              <option>Coloración</option>
              <option>Tratamiento</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-bold text-rose-700 mb-1 block">Fecha</label>
            <input type="date" className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all" />
          </div>
          <div>
            <label className="text-sm font-bold text-rose-700 mb-1 block">Hora</label>
            <input type="time" className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all" />
          </div>
          <div>
            <label className="text-sm font-bold text-rose-700 mb-1 block">Notas</label>
            <input placeholder="Ej. tengo alergia a..." className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all" />
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Button className="px-8 py-3 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold transform hover:-translate-y-0.5 transition-all">Guardar cita</Button>
          <Button variant="outline" className="px-8 py-3 rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50 font-semibold border-2">Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
