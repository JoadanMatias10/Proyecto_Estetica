import React from "react";
import { NavLink, Link } from "react-router-dom";
import Button from "../ui/Button";

const linkBase = "text-sm font-medium px-3 py-2 rounded-lg transition-all duration-300";
const linkInactive = "text-rose-700 hover:text-rose-500 hover:bg-white/60";
const linkActive = "text-rose-700 bg-white/80 shadow-sm";

export default function PublicHeader() {
  const links = [
    { to: "/", label: "Inicio" },
    { to: "/servicios", label: "Servicios" },
    { to: "/productos", label: "Productos AVYNA" },
    { to: "/quienes-somos", label: "¿Quiénes somos?" },
    { to: "/contactos", label: "Contacto" },
  ];

  return (
    <header className="border-b sticky top-0 z-50 bg-white/70 backdrop-blur-xl shadow-sm border-rose-200/50">
      <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-500 flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-105">
            <span className="text-2xl">✂️</span>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">
              Estética Panamericana
            </h1>
            <p className="text-xs md:text-sm text-rose-600 font-medium">Belleza & Bienestar</p>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="outline" className="text-sm h-10 px-4 md:px-6">
              Entrar
            </Button>
          </Link>
          <Link to="/registro">
            <Button className="text-sm h-10 px-4 md:px-6">
              Crear cuenta
            </Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}

