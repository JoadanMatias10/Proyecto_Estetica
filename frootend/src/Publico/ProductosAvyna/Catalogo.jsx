import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Button from "../../components/ui/Button";

const productos = [
  { id: 1, nombre: "Shampoo AVYNA Nutritivo", precio: 220, rating: 4.9 },
  { id: 2, nombre: "Mascarilla AVYNA Reparadora", precio: 280, rating: 4.8 },
  { id: 3, nombre: "Aceite AVYNA Brillo", precio: 190, rating: 4.7 },
  { id: 4, nombre: "Spray AVYNA Termoprotector", precio: 210, rating: 4.8 },
];

export default function Catalogo() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">Catálogo AVYNA</h1>
          <p className="text-rose-700/70 mt-2">Explora productos profesionales para tu cuidado.</p>
        </div>
        <Link to="/promociones" className="text-sm font-semibold text-rose-600 hover:text-rose-700 transition-colors">
          Ver promociones →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {productos.map((p) => (
          <motion.div
            key={p.id}
            whileHover={{ y: -6 }}
            className="rounded-2xl overflow-hidden shadow-md bg-white/80 backdrop-blur-sm border border-rose-200/50 hover:shadow-xl transition-shadow duration-300"
          >
            <div className="h-44 bg-gradient-to-br from-rose-200 to-rose-300 flex items-center justify-center">
              <img
                src={`https://placehold.co/600x400/FFD1E3/C94FA0?text=AVYNA+${p.id}`}
                alt={p.nombre}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5">
              <div className="flex justify-between items-start gap-3">
                <h3 className="font-bold text-lg text-rose-700">{p.nombre}</h3>
                <span className="text-yellow-500 font-bold text-sm">★ {p.rating}</span>
              </div>
              <p className="text-rose-700/70 mt-2">
                <span className="font-bold text-rose-600">${p.precio}</span> MXN
              </p>

              <div className="mt-4 flex gap-3">
                <Link to={`/productos/${p.id}`} className="w-full">
                  <Button className="w-full py-2.5">Ver detalle</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

