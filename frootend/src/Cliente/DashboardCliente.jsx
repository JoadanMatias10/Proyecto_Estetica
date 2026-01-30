import React from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";

export default function DashboardCliente() {
    return (
        <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl p-8 shadow-md">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Bienvenido 👋</h1>
                <p className="text-rose-700/70 mt-3 text-lg">
                    Desde aquí gestionas tus citas, compras AVYNA, pagos y recordatorios.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-5">
                    <Link to="/cliente/citas">
                        <Button className="px-6 py-3 rounded-xl shadow-lg bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold">Agendar / gestionar citas</Button>
                    </Link>
                    <Link to="/cliente/productos">
                        <Button variant="outline" className="px-6 py-3 rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50 font-semibold">Ver productos AVYNA</Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { title: "Próxima cita", value: "Sin cita programada", icon: "📅" },
                    { title: "Carrito", value: "0 productos", icon: "🛒" },
                    { title: "Pagos", value: "Sin pagos pendientes", icon: "💳" },
                ].map((c) => (
                    <div key={c.title} className="bg-white/70 backdrop-blur-sm border border-rose-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                        <div className="text-3xl mb-3 p-2 bg-rose-50 rounded-xl w-fit">{c.icon}</div>
                        <div className="mt-2 font-bold text-rose-700 text-lg">{c.title}</div>
                        <div className="text-rose-600/80 mt-1 font-medium">{c.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
