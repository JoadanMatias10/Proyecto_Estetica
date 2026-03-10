import React, { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import { endpoints } from "../../api";

export default function Recuperacion() {
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    setSuccess(false);
    if (!correo) {
      setError("El correo es obligatorio");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      setError("Formato de correo inválido");
    } else {
      setError(null);
      setLoading(true);
      try {
        const response = await fetch(endpoints.recover, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correo }),
        });
        const data = await response.json();
        if (response.ok) {
          setSuccess(true);
          setCorreo("");
        } else {
          setServerError(data.errors ? data.errors[0] : "Error al enviar solicitud");
        }
      } catch (error) {
        setServerError("Error de conexión con el servidor");
      } finally {
        setLoading(false);
      }
    }
  };

  const inputClass = error
    ? "mt-1 w-full rounded-xl border-2 px-4 py-2.5 focus:outline-none focus:ring-4 transition-all duration-200 border-red-300 focus:border-red-400 focus:ring-red-200"
    : "mt-1 w-full rounded-xl border-2 px-4 py-2.5 focus:outline-none focus:ring-4 transition-all duration-200 border-slate-200 focus:ring-violet-300/50 focus:border-violet-400";

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="card rounded-3xl p-8 shadow-xl">
        <h1 className="page-title">Recuperación de contraseña</h1>
        <p className="page-subtitle mt-2">Te enviaremos un enlace al correo.</p>

        {serverError && (
          <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 mb-4 text-sm font-medium">
            {serverError}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl p-3 mb-4 text-sm font-medium">
            ¡Enlace enviado! Revisa tu bandeja de entrada.
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">Correo</label>
            <input
              value={correo}
              onChange={(e) => { setCorreo(e.target.value); setError(null); }}
              className={inputClass}
            />
            {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
          </div>

          <Button type="submit" disabled={loading} className="w-full py-3 rounded-xl">
            {loading ? "Enviando..." : "Enviar enlace"}
          </Button>

          <p className="text-sm text-slate-500 mt-3">
            <Link className="text-violet-600 hover:text-violet-700 font-semibold transition-colors" to="/login">
              Volver a iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
