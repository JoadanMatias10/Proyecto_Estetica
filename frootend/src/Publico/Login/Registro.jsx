import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function Registro() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-3xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Registro</h1>
        <p className="text-rose-700/70 mt-2">Crea tu cuenta para agendar y comprar.</p>

        <form className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-rose-700">Nombre</label>
            <input className="mt-1 w-full rounded-xl border-2 border-rose-200 px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-rose-300/50 focus:border-rose-400 transition-all duration-200" />
          </div>
          <div>
            <label className="text-sm font-semibold text-rose-700">Correo</label>
            <input className="mt-1 w-full rounded-xl border-2 border-rose-200 px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-rose-300/50 focus:border-rose-400 transition-all duration-200" />
          </div>
          <div>
            <label className="text-sm font-semibold text-rose-700">Contraseña</label>
            <input type="password" className="mt-1 w-full rounded-xl border-2 border-rose-200 px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-rose-300/50 focus:border-rose-400 transition-all duration-200" />
          </div>

          <Button className="w-full py-3 rounded-xl">Crear cuenta</Button>

          <p className="text-sm text-rose-700/70 mt-3">
            ¿Ya tienes cuenta?{" "}
            <Link className="text-rose-600 hover:text-rose-700 font-semibold transition-colors" to="/login">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
