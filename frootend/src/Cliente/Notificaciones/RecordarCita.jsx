import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function RecordarCita() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex flex-col items-center text-center gap-4">
        <div>
          <h1 className="page-title">Recordar cita</h1>
          <p className="page-subtitle mt-1">Configura recordatorios para tus citas.</p>
        </div>
        <Link to="/cliente/notificaciones/enviar">
          <Button variant="outline" className="px-5 py-2.5 border-2 text-sm">Notificar citas</Button>
        </Link>
      </div>

      <div className="card p-6 md:p-8 space-y-5">
        <div>
          <label className="form-label">¿Cuándo recordar?</label>
          <select className="form-input text-sm">
            <option>24 horas antes</option>
            <option>12 horas antes</option>
            <option>2 horas antes</option>
          </select>
        </div>

        <div>
          <label className="form-label">Canal</label>
          <select className="form-input text-sm">
            <option>Email</option>
            <option>WhatsApp (demo)</option>
            <option>Notificación interna</option>
          </select>
        </div>

        <Button className="w-full py-3 rounded-xl shadow-lg shadow-violet-200/50">Guardar configuración</Button>
      </div>
    </div>
  );
}
