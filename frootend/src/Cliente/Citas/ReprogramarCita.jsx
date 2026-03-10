import React from "react";
import Button from "../../components/ui/Button";

export default function ReprogramarCita() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="page-title">Reprogramar cita</h1>
        <p className="page-subtitle mt-2">Selecciona nueva fecha y hora.</p>
      </div>

      <div className="card mt-8 p-8 space-y-6">
        <div>
          <label className="form-label">Nueva fecha</label>
          <input type="date" className="form-input" />
        </div>
        <div>
          <label className="form-label">Nueva hora</label>
          <input type="time" className="form-input" />
        </div>

        <Button className="w-full py-4 rounded-xl">Confirmar reprogramación</Button>
      </div>
    </div>
  );
}
