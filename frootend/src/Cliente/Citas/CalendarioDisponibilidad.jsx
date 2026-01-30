import React from "react";

export default function CalendarioDisponibilidad() {
  const slots = [
    { dia: "Lunes", horas: ["10:00", "11:30", "16:00"] },
    { dia: "Martes", horas: ["09:00", "13:00", "17:30"] },
    { dia: "Miércoles", horas: ["10:30", "12:00", "18:00"] },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Calendario de disponibilidad</h1>
      <p className="text-rose-700/70 mt-2">Horarios disponibles (demo).</p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {slots.map((s) => (
          <div key={s.dia} className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="font-bold text-rose-700 text-xl border-b border-rose-100 pb-2 mb-3">{s.dia}</div>
            <div className="space-y-2">
              {s.horas.map((h) => (
                <div key={h} className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 font-medium text-center hover:bg-rose-100 transition-colors cursor-pointer">
                  {h}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
