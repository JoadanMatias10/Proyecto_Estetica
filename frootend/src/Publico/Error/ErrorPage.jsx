import React from "react";
import { Link, useLocation } from "react-router-dom";
import Button from "../../components/ui/Button";

export default function ErrorPage({ code, title, message }) {
    const location = useLocation();
    const state = location.state || {};

    const finalCode = code || state.code || "404";
    const finalTitle = title || state.title || "Página no encontrada";
    const finalMessage = message || state.message || "Lo sentimos, la página que buscas no existe o ha sido movida.";

    let icon = "🤔";
    let bgGradient = "from-violet-50 to-rose-50";

    if (finalCode === "400") {
        icon = "⚠️";
        bgGradient = "from-amber-50 to-orange-50";
    } else if (finalCode === "500") {
        icon = "🔥";
        bgGradient = "from-red-50 to-rose-50";
    } else if (finalCode === "404") {
        icon = "🔍";
        bgGradient = "from-violet-50 to-slate-50";
    }

    return (
        <div className={`min-h-[70vh] flex flex-col items-center justify-center p-6 text-center rounded-3xl border-2 border-dashed border-slate-200 mt-8 mx-4 bg-gradient-to-b ${bgGradient}`}>
            <div className="text-8xl mb-6 filter drop-shadow-sm animate-bounce duration-[2000ms]">{icon}</div>

            <h1 className="text-6xl font-black text-violet-300 mb-2">{finalCode}</h1>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{finalTitle}</h2>
            <p className="text-slate-500 max-w-md mb-8">{finalMessage}</p>

            <div className="flex gap-4">
                <Link to="/">
                    <Button className="pl-6 pr-6">Volver al Inicio</Button>
                </Link>
            </div>
        </div>
    );
}
