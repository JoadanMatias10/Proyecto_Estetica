import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

const servicios = [
  { title: "Corte y peinado", price: 250, time: "45–60 min" },
  { title: "Coloración", price: 650, time: "90–120 min" },
  { title: "Tratamiento keratina", price: 900, time: "120–150 min" },
];

export default function ConsultaServicioCliente() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Servicios</h1>
          <p className="text-rose-700/70 mt-1">Consulta servicios y realiza pago desde tu cuenta.</p>
        </div>
        <Link to="/cliente/servicios/pago">
          <Button className="px-6 py-2.5 rounded-xl shadow-md bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold">Ir a pagar servicios</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {servicios.map((s) => (
          <div key={s.title} className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all hover:-translate-y-1">
            <h3 className="font-bold text-rose-700 text-xl mb-2">{s.title}</h3>
            <div className="flex items-center gap-2 text-rose-600/80 mb-4 bg-rose-50 w-fit px-3 py-1 rounded-full text-sm">
              <span>⏱</span> {s.time}
            </div>
            <div className="text-rose-800 font-medium">
              Precio: <span className="font-bold text-2xl text-rose-600">${s.price}</span> <span className="text-xs">MXN</span>
            </div>
            <div className="mt-6">
              <Link to="/cliente/citas">
                <Button variant="outline" className="w-full py-2.5 border-rose-300 text-rose-600 border-2 hover:bg-rose-50 rounded-xl font-semibold">Agendar</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
