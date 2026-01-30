import React from "react";
import Button from "../../components/ui/Button";

export default function PagoServicios() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Pago de servicios</h1>
      <p className="text-rose-700/70 mt-2">Realiza el pago de un servicio (demo).</p>

      <div className="mt-8 bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md space-y-6">
        <div>
          <label className="text-sm font-bold text-rose-700 mb-2 block">Servicio</label>
          <select className="w-full rounded-xl border-rose-200 bg-white/50 px-4 py-3 focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none transition-all">
            <option>Corte y peinado</option>
            <option>Coloración</option>
            <option>Tratamiento keratina</option>
          </select>
        </div>

        <div className="p-6 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-100">
          <div className="text-sm font-bold text-rose-600 uppercase tracking-wider">Total</div>
          <div className="text-4xl font-bold text-rose-700 mt-2">$650 <span className="text-lg text-rose-400 font-normal">MXN</span></div>
        </div>

        <Button className="w-full py-4 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-bold text-lg hover:shadow-glow transform hover:-translate-y-0.5 transition-all">Confirmar pago</Button>
      </div>
    </div>
  );
}
