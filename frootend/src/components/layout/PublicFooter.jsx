import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicCompanyInfo } from "../../utils/publicCatalogApi";
import SidebarIcon from "../ui/SidebarIcon";
import Logo from "../../img/Logo para una estéti.png";

function normalizeExternalUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function SocialIcon({ name, className = "h-5 w-5" }) {
  if (name === "facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
        <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.6 1.6-1.6H16.5V4.8c-.2 0-1-.1-2-.1-2 0-3.4 1.2-3.4 3.6V11H8.8v3h2.3v7h2.4Z" />
      </svg>
    );
  }

  if (name === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.25" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.4" cy="6.7" r="1.1" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 3.75a8.25 8.25 0 1 0 0 16.5a8.25 8.25 0 0 0 0-16.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.75 12h16.5M12 3.75c2.1 2.26 3.25 5.2 3.25 8.25S14.1 18 12 20.25C9.9 18 8.75 15.05 8.75 12S9.9 6 12 3.75Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

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
  const facebookUrl = normalizeExternalUrl(companyInfo?.facebook);
  const instagramUrl = normalizeExternalUrl(companyInfo?.instagram);
  const socialLinks = [
    {
      key: "instagram",
      label: "Instagram",
      href: instagramUrl || "/redes-sociales",
      external: Boolean(instagramUrl),
    },
    {
      key: "facebook",
      label: "Facebook",
      href: facebookUrl || "/redes-sociales",
      external: Boolean(facebookUrl),
    },
    {
      key: "site",
      label: "Redes",
      href: "/redes-sociales",
      external: false,
    },
  ];

  return (
    <footer className="bg-white border-t border-slate-200/50 py-12 px-4" id="contacto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/70 bg-white shadow-md ring-4 ring-white/60">
              <img src={Logo} alt={`Logo de ${businessName}`} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <span className="block font-bold text-xl page-title leading-tight">{businessName}</span>
              <span className="block text-sm font-medium text-violet-500">Belleza & Bienestar</span>
            </div>
          </div>
          <p className="text-slate-600 mb-4 leading-relaxed">
            Belleza profesional con toque panamericano.
          </p>
          <div className="flex gap-3">
            {socialLinks.map((social) =>
              social.external ? (
                <a
                  key={social.key}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  className="social-icon"
                  aria-label={social.label}
                  title={social.label}
                >
                  <SocialIcon name={social.key} />
                </a>
              ) : (
                <Link
                  key={social.key}
                  to={social.href}
                  className="social-icon"
                  aria-label={social.label}
                  title={social.label}
                >
                  <SocialIcon name={social.key} />
                </Link>
              )
            )}
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
