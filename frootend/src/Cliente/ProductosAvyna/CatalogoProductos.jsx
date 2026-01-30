import React from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";

const productos = [
  { id: 1, nombre: "Shampoo AVYNA Nutritivo", precio: 220, rating: 4.9 },
  { id: 2, nombre: "Mascarilla AVYNA Reparadora", precio: 280, rating: 4.8 },
  { id: 3, nombre: "Aceite AVYNA Brillo", precio: 190, rating: 4.7 },
  { id: 4, nombre: "Spray AVYNA Termoprotector", precio: 210, rating: 4.8 },
];

export default function CatalogoProductos() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Productos AVYNA</h1>
          <p className="text-rose-700/70 mt-1">Catálogo exclusivo para clientes.</p>
        </div>
        <Link to="/cliente/carrito">
          <Button className="px-6 py-2.5 rounded-xl shadow-md bg-gradient-to-r from-rose-500 to-rose-400 text-white">Ir al carrito</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {productos.map((p) => (
          <div key={p.id} className="bg-white/80 backdrop-blur-sm border border-rose-200/50 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
            <div className="h-48 bg-gradient-to-br from-rose-50 to-rose-100 relative overflow-hidden">
              <img
                src={`https://placehold.co/800x500/pink-100/pink-700?text=AVYNA+${p.id}`}
                alt={p.nombre}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-rose-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            <div className="p-5">
              <div className="flex justify-between gap-3 items-start">
                <h3 className="font-bold text-rose-700 leading-tight min-h-[2.5rem]">{p.nombre}</h3>
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-lg border border-yellow-100">
                  <span className="text-xs">⭐</span>
                  <span className="text-yellow-600 font-bold text-xs">{p.rating}</span>
                </div>
              </div>
              <div className="text-rose-800 mt-3 font-medium">
                <span className="font-bold text-2xl text-rose-600">${p.precio}</span> <span className="text-xs text-rose-400">MXN</span>
              </div>

              <div className="mt-5 flex gap-2">
                <Link to={`/cliente/productos/${p.id}`} className="w-full">
                  <Button variant="outline" className="w-full py-2.5 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-sm">Detalle</Button>
                </Link>
                <Link to={`/cliente/productos/pago/${p.id}`} className="w-full">
                  <Button className="w-full py-2.5 rounded-lg shadow-sm bg-gradient-to-r from-rose-500 to-rose-400 text-white text-sm">Comprar</Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
