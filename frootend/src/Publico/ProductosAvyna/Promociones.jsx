import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

const promos = [
  { titulo: "2x1 en Mascarilla", desc: "Válido de lunes a jueves.", badge: "LIMITADO" },
  { titulo: "15% en Shampoo + Aceite", desc: "Combo para brillo y nutrición.", badge: "POPULAR" },
  { titulo: "Envío gratis", desc: "En compras mayores a $499 MXN.", badge: "NUEVO" },
];

export default function Promociones() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Promociones AVYNA</h1>
          <p className="text-rose-700/70 mt-2">Aprovecha descuentos y combos especiales.</p>
        </div>
        <Link to="/productos" className="text-sm font-semibold text-rose-600 hover:text-rose-700 transition-colors">
          Ir al catálogo →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {promos.map((p) => (
          <div key={p.titulo} className="rounded-2xl p-7 bg-white/80 backdrop-blur-sm border border-rose-200/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="inline-flex text-xs font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-400 to-rose-500 text-white shadow-sm">
              {p.badge}
            </div>
            <h3 className="text-xl font-bold text-rose-700 mt-4">{p.titulo}</h3>
            <p className="text-rose-700/70 mt-2">{p.desc}</p>
            <div className="mt-6">
              <Button variant="outline" className="px-5 py-2.5 border-2">Aplicar</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
