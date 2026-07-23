import React from "react";
import SidebarIcon from "../ui/SidebarIcon";

export default function MobileMenuButton({
  isOpen,
  onClick,
  controls,
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-200 ${className}`}
      aria-label={isOpen ? "Cerrar menu" : "Abrir menu"}
      aria-expanded={isOpen}
      aria-controls={controls}
    >
      <SidebarIcon name={isOpen ? "close" : "menu"} className="h-5 w-5" />
    </button>
  );
}
