import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function AgendarCancelarCitas() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex flex-col items-center text-center gap-4">
        <div>
          <h1 className="page-title">Gestión de citas</h1>
          <p className="page-subtitle mt-1">Agenda, cancela o reprograma tus citas.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/cliente/citas/calendario">
            <Button variant="outline" className="px-4 py-2 border-2 text-sm">Ver disponibilidad</Button>
          </Link>
          <Link to="/cliente/citas/reprogramar">
            <Button className="px-4 py-2 text-sm">Reprogramar</Button>
          </Link>
        </div>
      </div>

      <div className="card p-8">
        <h3 className="section-title border-b border-slate-100 pb-2 mb-4">Agendar nueva cita (demo)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="form-label">Servicio</label>
            <select className="form-input">
              <option>Corte</option>
              <option>Coloración</option>
              <option>Tratamiento</option>
            </select>
          </div>
          <div>
            <label className="form-label">Fecha</label>
            <input type="date" className="form-input" />
          </div>
          <div>
            <label className="form-label">Hora</label>
            <input type="time" className="form-input" />
          </div>
          <div>
            <label className="form-label">Notas</label>
            <input placeholder="Ej. tengo alergia a..." className="form-input" />
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Button className="px-8 py-3 rounded-xl">Guardar cita</Button>
          <Button variant="outline" className="px-8 py-3 rounded-xl border-2">Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
