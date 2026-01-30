import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Carousel from "../components/ui/Carousel";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div className="space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-rose-800"
          >
            Renueva tu estilo con <span className="bg-gradient-to-r from-rose-500 to-rose-600 bg-clip-text text-transparent">expertos</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="text-lg md:text-xl text-rose-700/80 leading-relaxed"
          >
            Agenda un corte con estilistas certificados y descubre la línea AVYNA para un cuidado excepcional.
          </motion.p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Link to="/login">
              <Button className="px-6 md:px-8 py-3 md:py-4 text-base rounded-xl">
                Agendar cita
              </Button>
            </Link>

            <Link to="/productos">
              <Button variant="outline" className="px-6 md:px-8 py-3 md:py-4 text-base rounded-xl border-2">
                Ver catálogo AVYNA
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-yellow-400 bg-white border-rose-200 shadow-sm"
                  style={{ marginLeft: s > 1 ? "-8px" : "0" }}
                >
                  ★
                </div>
              ))}
            </div>
            <p className="text-sm font-medium text-rose-700">+1,200 clientes satisfechos</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 35 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="rounded-3xl overflow-hidden shadow-xl bg-gradient-to-br from-rose-200 to-rose-300"
        >
          <img
            src="https://placehold.co/900x600/FFD1E3/C94FA0?text=Estetica+Panamericana"
            alt="Estética Panamericana"
            className="w-full h-[420px] md:h-[520px] object-cover"
            style={{ filter: "brightness(0.95)" }}
          />
        </motion.div>
      </div>

      <div className="border-t-2 border-rose-200/50 max-w-xs mx-auto my-16"></div>

      {/* Carrusel de Servicios Destacados */}
      <section className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent mb-2">
            Descubre Nuestra Experiencia
          </h2>
          <p className="text-rose-700/70">Transformamos tu estilo con pasión y profesionalismo</p>
        </div>
        <Carousel />
      </section>

      <div className="border-t-2 border-rose-200/50 max-w-xs mx-auto my-16"></div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: "💇‍♀️", title: "Servicios", desc: "Consulta servicios y precios.", to: "/servicios" },
          { icon: "🧴", title: "Productos AVYNA", desc: "Catálogo, detalle y promos.", to: "/productos" },
          { icon: "🏢", title: "Empresa", desc: "Quiénes somos y contacto.", to: "/quienes-somos" },
        ].map((c) => (
          <div key={c.title} className="rounded-2xl p-8 bg-white/80 backdrop-blur-sm border border-rose-200/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="text-4xl mb-3">{c.icon}</div>
            <h3 className="text-xl font-bold text-rose-700">{c.title}</h3>
            <p className="text-rose-700/70 mt-2 mb-5">{c.desc}</p>
            <Link to={c.to}>
              <Button variant="outline" className="px-5 py-2.5">
                Ir
              </Button>
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}

