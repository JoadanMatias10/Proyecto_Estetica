import React from "react";
import Button from "../../components/ui/Button";

export default function NotificarCitas() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Notificar citas</h1>
      <p className="text-rose-700/70 mt-2">Enviar aviso de próxima cita (demo).</p>

      <div className="mt-8 bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md space-y-6">
        <div>
          <label className="text-sm font-bold text-rose-700 mb-2 block">Mensaje</label>
          <textarea
            rows="4"
            className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all resize-none"
            defaultValue="Hola 👋 Te recordamos tu cita en Estética Panamericana. ¡Te esperamos!"
          />
        </div>

        <Button className="w-full py-4 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-bold hover:shadow-glow transform hover:-translate-y-0.5 transition-all">Enviar notificación</Button>
      </div>
    </div>
  );
}
