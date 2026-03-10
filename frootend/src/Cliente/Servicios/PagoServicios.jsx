import React from "react";
import Button from "../../components/ui/Button";

export default function PagoServicios() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="page-title">Pago de servicios</h1>
        <p className="page-subtitle mt-2">Realiza el pago de un servicio (demo).</p>
      </div>

      <div className="card mt-8 p-8 space-y-6">
        <div>
          <label className="form-label">Servicio</label>
          <select className="form-input">
            <option>Corte y peinado</option>
            <option>Coloración</option>
            <option>Tratamiento keratina</option>
          </select>
        </div>

        <div className="p-6 rounded-xl bg-gradient-to-br from-violet-50 to-rose-50 border border-violet-100">
          <div className="text-sm font-bold text-violet-600 uppercase tracking-wider">Total</div>
          <div className="text-4xl font-bold text-rose-600 mt-2">$650 <span className="text-lg text-slate-400 font-normal">MXN</span></div>
        </div>

        <Button className="w-full py-4 rounded-xl">Confirmar pago</Button>
      </div>
    </div>
  );
}
