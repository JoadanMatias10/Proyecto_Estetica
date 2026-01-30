import React from "react";

export default function Contactos() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Contactos</h1>
      <p className="text-rose-700/70 mt-2">Puedes comunicarte con nosotros por estos medios.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl p-7 bg-white/80 backdrop-blur-sm border border-rose-200/50 shadow-md">
          <h3 className="font-bold text-rose-700 text-xl">Sucursal</h3>
          <p className="text-rose-700/70 mt-2">📍 Calle Principal 123, Panamá</p>
          <p className="text-rose-700/70 mt-1">📱 +507 6000-1234</p>
          <p className="text-rose-700/70 mt-1">✉️ hola@panamericana.com</p>
        </div>
        <div className="rounded-2xl p-7 bg-white/80 backdrop-blur-sm border border-rose-200/50 shadow-md">
          <h3 className="font-bold text-rose-700 text-xl">Horario</h3>
          <p className="text-rose-700/70 mt-2">Lunes a Sábado: 9:00 am – 7:00 pm</p>
          <p className="text-rose-700/70 mt-1">Domingo: 10:00 am – 3:00 pm</p>
        </div>
      </div>
    </div>
  );
}
