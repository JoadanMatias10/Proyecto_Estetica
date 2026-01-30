import React from "react";

export default function Button({ variant = "default", className = "", children, ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-rose-300/50 disabled:opacity-60 disabled:cursor-not-allowed";

  const styles =
    variant === "outline"
      ? "border-2 bg-white/80 border-rose-300 hover:border-rose-400 hover:bg-rose-50 text-rose-600 hover:text-rose-700 shadow-sm hover:shadow-md"
      : "bg-gradient-to-r from-rose-400 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white shadow-md hover:shadow-glow transform hover:scale-105 hover:-translate-y-0.5";

  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

