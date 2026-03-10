import React from "react";
import Button from "../../components/ui/Button";

export default function InformacionCliente() {
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="page-title">Información del cliente</h1>
      <p className="page-subtitle mt-2">Actualiza tus datos personales</p>

      <div className="card mt-8 p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="form-label">Nombre</label>
            <input className="form-input" defaultValue="" />
          </div>
          <div>
            <label className="form-label">Apellido</label>
            <input className="form-input" defaultValue="" />
          </div>
          <div>
            <label className="form-label">Teléfono</label>
            <input className="form-input" defaultValue="" />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Correo</label>
            <input className="form-input" defaultValue="" />
          </div>
        </div>

        <Button className="w-full py-4 rounded-xl">Guardar cambios</Button>
      </div>
    </div>
  );
}
