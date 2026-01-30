import React from "react";

export default function PoliticaPrivacidad() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Política de privacidad</h1>
      <p className="text-rose-700/70 mt-3 leading-relaxed">
        Esta página es un borrador para tu proyecto. Aquí explicas cómo se almacenan y usan los datos (cuenta, citas, compras).
      </p>

      <div className="mt-8 rounded-2xl p-7 bg-white/80 backdrop-blur-sm border border-rose-200/50 shadow-md space-y-4 text-rose-700/70">
        <p><strong className="text-rose-700">Datos:</strong> nombre, correo, historial de citas y compras.</p>
        <p><strong className="text-rose-700">Uso:</strong> gestionar citas, notificaciones, compras y soporte.</p>
        <p><strong className="text-rose-700">Seguridad:</strong> acceso restringido, contraseñas cifradas (cuando conectes backend).</p>
        <p><strong className="text-rose-700">Contacto:</strong> puedes solicitar cambios o eliminación de datos.</p>
      </div>
    </div>
  );
}
