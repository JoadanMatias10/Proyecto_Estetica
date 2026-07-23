import React, { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import Button from "../ui/Button";
import ThemeToggle from "../ui/ThemeToggle";
import Logo from "../../img/Logo para una estéti.png";
import MobileMenuButton from "./MobileMenuButton";

const linkBase =
  "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300";
const linkInactive = "text-slate-700 hover:bg-violet-50/60 hover:text-violet-600";
const linkActive = "bg-violet-50/80 text-violet-700 shadow-sm";

export default function PublicHeader() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const links = [
    { to: "/", label: "Inicio" },
    { to: "/servicios", label: "Servicios" },
    { to: "/productos", label: "Productos AVYNA" },
    { to: "/promociones", label: "Promociones" },
    { to: "/quienes-somos", label: "¿Quiénes somos?" },
    { to: "/contactos", label: "Contacto" },
  ];

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/80 shadow-sm backdrop-blur-xl">
      <nav className="mx-auto flex min-h-16 max-w-[1640px] items-center justify-between gap-3 px-3 py-2 sm:min-h-20 sm:px-4 md:px-6 xl:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg sm:h-12 sm:w-12 xl:h-14 xl:w-14">
            <img src={Logo} alt="Logo Estética" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 max-[390px]:hidden">
            <h1 className="whitespace-nowrap bg-gradient-to-r from-rose-500 to-violet-600 bg-clip-text text-base font-bold leading-none text-transparent sm:text-xl xl:text-2xl">
              Estética Panamericana
            </h1>
            <p className="mt-1 hidden whitespace-nowrap text-xs font-medium text-violet-500 sm:block xl:text-sm">
              Belleza & Bienestar
            </p>
          </div>
        </Link>

        <div className="hidden min-w-0 items-center justify-center gap-1 xl:flex 2xl:gap-3">
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

        <div className="flex shrink-0 items-center gap-2 xl:gap-3">
          <ThemeToggle />
          <div className="hidden items-center gap-2 xl:flex">
            <Link to="/login">
              <Button variant="outline" className="h-10 whitespace-nowrap px-4 text-sm">
                Entrar
              </Button>
            </Link>
            <Link to="/registro">
              <Button className="h-10 whitespace-nowrap px-4 text-sm">
                Crear cuenta
              </Button>
            </Link>
          </div>
          <MobileMenuButton
            isOpen={isMenuOpen}
            onClick={() => setIsMenuOpen((current) => !current)}
            controls="public-mobile-menu"
            className="xl:hidden"
          />
        </div>
      </nav>

      {isMenuOpen && (
        <div id="public-mobile-menu" className="border-t border-slate-200 bg-white px-3 py-3 shadow-lg xl:hidden">
          <div className="mx-auto grid max-w-2xl gap-1">
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
          <div className="mx-auto mt-3 grid max-w-2xl grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <Link to="/login" className="min-w-0">
              <Button variant="outline" className="h-11 w-full px-3 text-sm">
                Entrar
              </Button>
            </Link>
            <Link to="/registro" className="min-w-0">
              <Button className="h-11 w-full px-3 text-sm">
                Crear cuenta
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
