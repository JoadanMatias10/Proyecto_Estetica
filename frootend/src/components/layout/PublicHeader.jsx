import React from "react";
import { NavLink, Link } from "react-router-dom";
import Button from "../ui/Button";
import ThemeToggle from "../ui/ThemeToggle";
import Logo from "../../img/Logo para una estéti.png";

const linkBase = "text-sm font-medium px-3 py-2 rounded-lg transition-all duration-300";
const linkInactive = "text-slate-700 hover:text-violet-600 hover:bg-violet-50/60";
const linkActive = "text-violet-700 bg-violet-50/80 shadow-sm";

export default function PublicHeader() {
  const links = [
    { to: "/", label: "Inicio" },
    { to: "/servicios", label: "Servicios" },
    { to: "/productos", label: "Productos AVYNA" },
    { to: "/quienes-somos", label: "¿Quiénes somos?" },
    { to: "/contactos", label: "Contacto" },
  ];

  return (
    <header className="border-b sticky top-0 z-50 bg-white/70 backdrop-blur-xl shadow-sm border-slate-200/50">
      <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-105">
            <img src={Logo} alt="Logo Estética" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold page-title">
              Estética Panamericana
            </h1>
            <p className="text-xs md:text-sm text-violet-500 font-medium">Belleza & Bienestar</p>
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
          <ThemeToggle />
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
