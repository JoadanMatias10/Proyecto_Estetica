import React from "react";
import { Link } from "react-router-dom";

export default function PublicFooter() {
  return (
    <footer className="bg-gradient-to-br from-rose-100/50 via-rose-50 to-white border-t border-rose-200/50 py-12 px-4 mt-16" id="contacto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-rose-500 flex items-center justify-center shadow-md">
              <span className="text-xl">✂️</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">
              Estética Panamericana
            </span>
          </div>
          <p className="text-rose-800/80 mb-4 leading-relaxed">
            Belleza profesional con toque panamericano. Más de 10 años transformando sonrisas.
          </p>
          <div className="flex gap-3">
            <Link to="/redes-sociales" className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-rose-500 hover:text-rose-600 hover:bg-rose-50 hover:shadow-md transition-all duration-300 hover:scale-110">
              ig
            </Link>
            <Link to="/redes-sociales" className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-rose-500 hover:text-rose-600 hover:bg-rose-50 hover:shadow-md transition-all duration-300 hover:scale-110">
              f
            </Link>
            <Link to="/redes-sociales" className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-rose-500 hover:text-rose-600 hover:bg-rose-50 hover:shadow-md transition-all duration-300 hover:scale-110">
              in
            </Link>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-lg text-rose-700 mb-4">Público</h3>
          <ul className="space-y-2">
            <li><Link to="/productos" className="text-rose-800/80 hover:text-rose-600 transition-colors duration-200">Catálogo AVYNA</Link></li>
            <li><Link to="/promociones" className="text-rose-800/80 hover:text-rose-600 transition-colors duration-200">Promociones</Link></li>
            <li><Link to="/servicios" className="text-rose-800/80 hover:text-rose-600 transition-colors duration-200">Servicios</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-lg text-rose-700 mb-4">Empresa</h3>
          <ul className="space-y-2">
            <li><Link to="/quienes-somos" className="text-rose-800/80 hover:text-rose-600 transition-colors duration-200">Quiénes somos</Link></li>
            <li><Link to="/mision-vision-valores" className="text-rose-800/80 hover:text-rose-600 transition-colors duration-200">Misión, visión y valores</Link></li>
            <li><Link to="/politica-privacidad" className="text-rose-800/80 hover:text-rose-600 transition-colors duration-200">Política de privacidad</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-lg text-rose-700 mb-4">Contacto</h3>
          <ul className="space-y-3 text-rose-800/80">
            <li className="flex gap-2"><span>📍</span><span>Calle Principal 123, Panamá</span></li>
            <li className="flex gap-2"><span>📱</span><span>+507 6000-1234</span></li>
            <li className="flex gap-2"><span>✉️</span><span>hola@panamericana.com</span></li>
            <li className="flex gap-2"><span>🧾</span><Link className="hover:text-rose-600 transition-colors duration-200" to="/contactos">Ver página de contactos</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-rose-200/50 text-center text-rose-700/80">
        <p>© {new Date().getFullYear()} Estética Panamericana. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}

