import React from "react";

export default function MisionVisionValores() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Misión, visión y valores</h1>

      <div className="mt-8 space-y-6">
        <div className="rounded-2xl p-7 bg-white/80 backdrop-blur-sm border border-rose-200/50 shadow-md">
          <h3 className="font-bold text-rose-700 text-xl">Misión</h3>
          <p className="text-rose-700/70 mt-2 leading-relaxed">
            Brindar servicios de belleza y bienestar con alta calidad, atención humana y productos profesionales que
            generen confianza y satisfacción.
          </p>
        </div>

        <div className="rounded-2xl p-7 bg-white/80 backdrop-blur-sm border border-rose-200/50 shadow-md">
          <h3 className="font-bold text-rose-700 text-xl">Visión</h3>
          <p className="text-rose-700/70 mt-2 leading-relaxed">
            Ser la estética preferida en la región por excelencia en servicio, innovación y resultados visibles en cada cliente.
          </p>
        </div>

        <div className="rounded-2xl p-7 bg-white/80 backdrop-blur-sm border border-rose-200/50 shadow-md">
          <h3 className="font-bold text-rose-700 text-xl">Valores</h3>
          <ul className="mt-3 space-y-2 text-rose-700/70">
            <li>✓ Profesionalismo</li>
            <li>✓ Respeto</li>
            <li>✓ Calidad</li>
            <li>✓ Honestidad</li>
            <li>✓ Innovación</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
