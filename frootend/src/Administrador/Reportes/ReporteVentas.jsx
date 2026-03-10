import React, { useState } from 'react';
import Button from '../../components/ui/Button';

export default function ReporteVentas() {
    const [dateFilter, setDateFilter] = useState('Mes');

    const stats = [
        { label: "Ventas Totales", value: "$45,200", change: "+12%" },
        { label: "Servicios Realizados", value: "154", change: "+5%" },
        { label: "Productos Vendidos", value: "89", change: "+8%" },
        { label: "Nuevos Clientes", value: "24", change: "+2%" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Reportes y Estadísticas</h1>
                    <p className="text-slate-500 text-sm">Resumen del rendimiento del negocio.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['Semana', 'Mes', 'Año'].map((period) => (
                        <button
                            key={period}
                            onClick={() => setDateFilter(period)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${dateFilter === period ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {period}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-violet-50">
                        <div className="text-sm font-medium text-slate-500 mb-1">{stat.label}</div>
                        <div className="flex items-end justify-between">
                            <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                            <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{stat.change}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Servicios Más Solicitados</h3>
                    <div className="space-y-4">
                        {[{ name: "Corte de Cabello", val: 45 }, { name: "Manicura", val: 30 }, { name: "Tinte", val: 15 }].map((s, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700">{s.name}</span>
                                    <span className="text-slate-500">{s.val}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2.5">
                                    <div className="bg-violet-500 h-2.5 rounded-full" style={{ width: `${s.val}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Productos Más Vendidos</h3>
                    <ul className="space-y-3">
                        {[
                            { name: "Shampoo Avyna", sold: 120, revenue: "$30,000" },
                            { name: "Mascarilla", sold: 85, revenue: "$29,750" },
                            { name: "Aceite Argán", sold: 60, revenue: "$24,000" },
                        ].map((p, i) => (
                            <li key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-xs">{i + 1}</div>
                                    <div>
                                        <div className="font-medium text-slate-800">{p.name}</div>
                                        <div className="text-xs text-slate-400">{p.sold} unidades</div>
                                    </div>
                                </div>
                                <div className="font-bold text-slate-700">{p.revenue}</div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
