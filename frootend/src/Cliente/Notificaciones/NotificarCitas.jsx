import React from "react";
import Button from "../../components/ui/Button";

export default function NotificarCitas() {
  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Notificar citas</h1>
      <p className="page-subtitle mt-2">Enviar aviso de próxima cita (demo).</p>

      <div className="card mt-8 p-8 space-y-6">
        <div>
          <label className="form-label">Mensaje</label>
          <textarea
            rows="4"
            className="form-input resize-none"
            defaultValue="Hola 👋 Te recordamos tu cita en Estética Panamericana. ¡Te esperamos!"
          />
        </div>

        <Button className="w-full py-4 rounded-xl">Enviar notificación</Button>
      </div>
    </div>
  );
}
