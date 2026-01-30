import React from "react";
import Button from "../../components/ui/Button";

export default function InformacionCliente() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Información del cliente</h1>
      <p className="text-rose-700/70 mt-2">Actualiza tus datos personales (demo).</p>

      <div className="mt-8 bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-bold text-rose-700 mb-1 block">Nombre</label>
            <input className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all" defaultValue="Cliente" />
          </div>
          <div>
            <label className="text-sm font-bold text-rose-700 mb-1 block">Teléfono</label>
            <input className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all" defaultValue="0000000000" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-bold text-rose-700 mb-1 block">Correo</label>
            <input className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all" defaultValue="cliente@correo.com" />
          </div>
        </div>

        <Button className="w-full py-4 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-bold hover:shadow-glow transform hover:-translate-y-0.5 transition-all">Guardar cambios</Button>
      </div>
    </div>
  );
}
