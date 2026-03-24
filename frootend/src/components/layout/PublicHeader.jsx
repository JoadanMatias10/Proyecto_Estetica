import React from "react";
import { NavLink, Link } from "react-router-dom";
import Button from "../ui/Button";
import ThemeToggle from "../ui/ThemeToggle";
import Logo from "../../img/Logo para una estéti.png";

const linkBase =
  "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300";
const linkInactive = "text-slate-700 hover:bg-violet-50/60 hover:text-violet-600";
const linkActive = "bg-violet-50/80 text-violet-700 shadow-sm";

export default function PublicHeader() {
  const links = [
    { to: "/", label: "Inicio" },
    { to: "/servicios", label: "Servicios" },
    { to: "/productos", label: "Productos AVYNA" },
    { to: "/promociones", label: "Promociones" },
    { to: "/quienes-somos", label: "¿Quiénes somos?" },
    { to: "/contactos", label: "Contacto" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/80 shadow-sm backdrop-blur-xl">
      <nav className="mx-auto grid max-w-[1640px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 md:px-6 xl:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <div className="h-13 w-13 overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg xl:h-14 xl:w-14">
            <img src={Logo} alt="Logo Estética" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="page-title text-[1.45rem] font-bold leading-none tracking-tight whitespace-nowrap xl:text-[1.7rem]">
              Estética Panamericana
            </h1>
            <p className="mt-1 whitespace-nowrap text-sm font-medium text-violet-500 md:text-base">
              Belleza & Bienestar
            </p>
          </div>
        </Link>

        <div className="hidden min-w-0 items-center justify-center gap-1 md:flex lg:gap-2 xl:gap-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="justify-self-end flex items-center gap-2 xl:gap-4">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="outline" className="h-11 px-5 text-sm whitespace-nowrap xl:px-6">
              Entrar
            </Button>
          </Link>
          <Link to="/registro">
            <Button className="h-11 px-5 text-sm whitespace-nowrap xl:px-6">
              Crear cuenta
            </Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
