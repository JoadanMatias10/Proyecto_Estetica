import React from "react";

export default function Button({ variant = "default", className = "", children, ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 focus:outline-none focus:ring-4 disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    default: "bg-gradient-to-r from-rose-400 to-violet-500 hover:from-rose-500 hover:to-violet-600 text-white shadow-md hover:shadow-glow focus:ring-violet-300/50 transform hover:scale-105 hover:-translate-y-0.5",
    outline: "border-2 bg-white/80 border-rose-300 hover:border-violet-400 hover:bg-violet-50 text-rose-600 hover:text-violet-700 shadow-sm hover:shadow-md focus:ring-violet-300/50",
    emerald: "bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white shadow-md hover:shadow-emerald-500/25 focus:ring-emerald-300/50 transform hover:scale-105 hover:-translate-y-0.5",
    amber: "bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-md hover:shadow-amber-500/25 focus:ring-amber-300/50 transform hover:scale-105 hover:-translate-y-0.5",
    indigo: "bg-gradient-to-r from-indigo-400 to-violet-500 hover:from-indigo-500 hover:to-violet-600 text-white shadow-md hover:shadow-indigo-500/25 focus:ring-indigo-300/50 transform hover:scale-105 hover:-translate-y-0.5",
    cyan: "bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white shadow-md hover:shadow-cyan-500/25 focus:ring-cyan-300/50 transform hover:scale-105 hover:-translate-y-0.5",
    danger: "bg-gradient-to-r from-red-400 to-rose-500 hover:from-red-500 hover:to-rose-600 text-white shadow-md hover:shadow-red-500/25 focus:ring-red-300/50 transform hover:scale-105 hover:-translate-y-0.5",
  };

  const styles = variants[variant] || variants.default;

  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
