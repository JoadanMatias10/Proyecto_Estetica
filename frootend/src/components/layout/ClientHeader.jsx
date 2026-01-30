import React from "react";

export default function ClientHeader() {
  return (
    <header className="border-b border-rose-200/50 bg-white/70 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
      <div className="h-16 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-500 flex items-center justify-center shadow-md">
            <span className="text-xl">✂️</span>
          </div>
          <div className="leading-tight">
            <div className="font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Estética Panamericana</div>
            <div className="text-xs text-rose-600 font-medium">Panel del cliente</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-sm font-semibold text-rose-700">Cliente</div>
            <div className="text-xs text-rose-500">cliente@correo.com</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-200 to-rose-300 flex items-center justify-center text-rose-700 font-bold shadow-sm border-2 border-white">
            C
          </div>
        </div>
      </div>
    </header>
  );
}
