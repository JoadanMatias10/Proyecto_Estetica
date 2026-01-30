import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

const servicios = [
  { titulo: "Corte y Peinado", desc: "Corte moderno, peinados, alisado." },
  { titulo: "Coloración", desc: "Balayage, mechas, retoques." },
  { titulo: "Tratamientos", desc: "Hidratación profunda, keratina, reparación." },
];

export default function ConsultaServicio() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Servicios</h1>
          <p className="text-rose-700/70 mt-2">Consulta nuestras categorías y agenda desde tu cuenta.</p>
        </div>
        <Link to="/login">
          <Button className="px-6 py-3 rounded-xl">Iniciar sesión para agendar</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {servicios.map((s) => (
          <div key={s.titulo} className="rounded-2xl p-8 bg-white/80 backdrop-blur-sm border border-rose-200/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <h3 className="text-xl font-bold text-rose-700">{s.titulo}</h3>
            <p className="text-rose-700/70 mt-2">{s.desc}</p>
            <div className="mt-6">
              <Button variant="outline" className="px-5 py-2.5 border-2">Ver detalles</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

