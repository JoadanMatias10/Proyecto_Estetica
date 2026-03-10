import React, { useState } from "react";

export default function CalendarioDisponibilidad() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getDayStatus = (day) => {
    return day % 2 === 0 ? "available" : "busy";
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50/50 rounded-xl" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isAvailable = getDayStatus(d) === "available";
    days.push(
      <div
        key={d}
        className={`h-24 rounded-xl border-2 p-2 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] shadow-sm
          ${isAvailable
            ? "bg-emerald-50 border-emerald-200 hover:border-emerald-300 hover:shadow-emerald-100"
            : "bg-rose-50 border-rose-200 hover:border-rose-300 hover:shadow-rose-100 opacity-80"
          }`}
      >
        <span className={`font-bold text-lg ${isAvailable ? "text-emerald-700" : "text-rose-700"}`}>{d}</span>
        <div className="flex justify-end">
          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isAvailable ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            {isAvailable ? "Disponible" : "Ocupado"}
          </span>
        </div>
      </div>
    );
  }

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="page-title">Calendario de Disponibilidad</h1>
          <p className="page-subtitle mt-1">Consulta nuestros días disponibles y ocupados.</p>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <button onClick={() => changeMonth(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-violet-50 text-violet-600 transition-colors">◀</button>
          <span className="font-bold text-slate-800 w-32 text-center text-lg">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          <button onClick={() => changeMonth(1)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-violet-50 text-violet-600 transition-colors">▶</button>
        </div>
      </div>

      <div className="card rounded-3xl p-6 shadow-xl">
        <div className="grid grid-cols-7 gap-4 mb-4 text-center">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(day => (
            <div key={day} className="font-bold text-violet-400 text-sm uppercase tracking-wider">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-4">
          {days}
        </div>
      </div>

      <div className="mt-6 flex gap-6 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
          <span className="text-sm text-slate-600 font-medium">Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-rose-500"></div>
          <span className="text-sm text-slate-600 font-medium">Ocupado</span>
        </div>
      </div>
    </div>
  );
}
