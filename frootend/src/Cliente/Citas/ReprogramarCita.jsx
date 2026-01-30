import React from "react";
import Button from "../../components/ui/Button";

export default function ReprogramarCita() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Reprogramar cita</h1>
      <p className="text-rose-700/70 mt-2">Selecciona nueva fecha y hora.</p>

      <div className="mt-8 bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md space-y-6">
        <div>
          <label className="text-sm font-bold text-rose-700 mb-1 block">Nueva fecha</label>
          <input type="date" className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all" />
        </div>
        <div>
          <label className="text-sm font-bold text-rose-700 mb-1 block">Nueva hora</label>
          <input type="time" className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all" />
        </div>

        <Button className="w-full py-4 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-bold text-lg hover:shadow-glow transform hover:-translate-y-0.5 transition-all">Confirmar reprogramación</Button>
      </div>
    </div>
  );
}
