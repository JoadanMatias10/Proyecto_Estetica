import React from "react";
import { Link } from "react-router-dom";

export default function QuienesSomos() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">¿Quiénes somos?</h1>
      <p className="text-rose-700/70 mt-3 leading-relaxed">
        En Estética Panamericana combinamos pasión, profesionalismo y productos de calidad para realzar tu belleza.
      </p>

      <div className="mt-8 rounded-2xl p-7 bg-white/80 backdrop-blur-sm border border-rose-200/50 shadow-md">
        <h3 className="font-bold text-rose-700 text-xl">Nuestra esencia</h3>
        <ul className="mt-3 space-y-2 text-rose-700/70">
          <li>✓ Atención personalizada</li>
          <li>✓ Estilistas certificados</li>
          <li>✓ Experiencia premium</li>
          <li>✓ Productos profesionales AVYNA</li>
        </ul>

        <p className="text-sm text-rose-700/70 mt-6">
          ¿Quieres ver misión, visión y valores?{" "}
          <Link className="font-semibold text-rose-600 hover:text-rose-700 transition-colors" to="/mision-vision-valores">
            Ver aquí →
          </Link>
        </p>
      </div>
    </div>
  );
}
