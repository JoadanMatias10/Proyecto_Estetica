import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicCompanyInfo } from "../../utils/publicCatalogApi";
import SidebarIcon from "../ui/SidebarIcon";

export default function PublicFooter() {
  const [companyInfo, setCompanyInfo] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadCompanyInfo = async () => {
      try {
        const info = await fetchPublicCompanyInfo();
        if (isMounted) setCompanyInfo(info);
      } catch (_error) {
        if (isMounted) setCompanyInfo(null);
      }
    };

    loadCompanyInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  const businessName = companyInfo?.nombre || "Estetica Panamericana";
  const horarioCompleto = [companyInfo?.horarioLunesSabado, companyInfo?.horarioDomingo]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" | ");

  return (
    <footer className="bg-gradient-to-br from-violet-50/50 via-rose-50/30 to-white border-t border-slate-200/50 py-12 px-4 mt-16" id="contacto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-violet-500 flex items-center justify-center shadow-md">
              <span className="text-xs font-bold text-white">EP</span>
            </div>
            <span className="font-bold text-xl page-title">{businessName}</span>
          </div>
          <p className="text-slate-600 mb-4 leading-relaxed">
            Belleza profesional con toque panamericano.
          </p>
          <div className="flex gap-3">
            <Link to="/redes-sociales" className="social-icon">ig</Link>
            <Link to="/redes-sociales" className="social-icon">f</Link>
            <Link to="/redes-sociales" className="social-icon">in</Link>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-lg text-slate-800 mb-4">Publico</h3>
          <ul className="space-y-2">
            <li><Link to="/productos" className="text-slate-600 hover:text-violet-600 transition-colors duration-200">Catalogo AVYNA</Link></li>
            <li><Link to="/promociones" className="text-slate-600 hover:text-violet-600 transition-colors duration-200">Promociones</Link></li>
            <li><Link to="/servicios" className="text-slate-600 hover:text-violet-600 transition-colors duration-200">Servicios</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-lg text-slate-800 mb-4">Empresa</h3>
          <ul className="space-y-2">
            <li><Link to="/quienes-somos" className="text-slate-600 hover:text-violet-600 transition-colors duration-200">Quienes somos</Link></li>
            <li><Link to="/mision-vision-valores" className="text-slate-600 hover:text-violet-600 transition-colors duration-200">Mision, vision y valores</Link></li>
            <li><Link to="/politica-privacidad" className="text-slate-600 hover:text-violet-600 transition-colors duration-200">Politica de privacidad</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-lg text-slate-800 mb-4">Contacto</h3>
          <ul className="space-y-3 text-slate-600">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <SidebarIcon name="location" className="h-4 w-4" />
              </span>
              <span>{companyInfo?.direccion || "No disponible"}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <SidebarIcon name="phone" className="h-4 w-4" />
              </span>
              <span>{companyInfo?.telefono || "No disponible"}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <SidebarIcon name="mail" className="h-4 w-4" />
              </span>
              <span>{companyInfo?.email || "No disponible"}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <SidebarIcon name="calendar" className="h-4 w-4" />
              </span>
              <span>{horarioCompleto || "No disponible"}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-200/50 text-center text-slate-500">
        <p>
          (c) {new Date().getFullYear()} {businessName}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
