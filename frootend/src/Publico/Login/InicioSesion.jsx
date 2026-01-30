import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function InicioSesion() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-3xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Inicio de sesión</h1>
        <p className="text-rose-700/70 mt-2">Accede para agendar citas y comprar productos.</p>

        <form className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-rose-700">Correo</label>
            <input className="mt-1 w-full rounded-xl border-2 border-rose-200 px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-rose-300/50 focus:border-rose-400 transition-all duration-200" />
          </div>
          <div>
            <label className="text-sm font-semibold text-rose-700">Contraseña</label>
            <input type="password" className="mt-1 w-full rounded-xl border-2 border-rose-200 px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-rose-300/50 focus:border-rose-400 transition-all duration-200" />
          </div>

          <Button className="w-full py-3 rounded-xl mt-6">Entrar</Button>

          <div className="flex justify-between text-sm mt-2">
            <Link className="text-rose-600 hover:text-rose-700 transition-colors" to="/recuperar">¿Olvidaste tu contraseña?</Link>
            <Link className="text-rose-600 hover:text-rose-700 transition-colors" to="/registro">Crear cuenta</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

