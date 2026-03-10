import React from "react";
import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-xl transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 group"
            title={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
        >
            <div className="relative w-6 h-6 overflow-hidden">
                <span className={`absolute inset-0 transform transition-transform duration-500 ${theme === "dark" ? "translate-y-0" : "translate-y-full"}`}>
                    🌙
                </span>
                <span className={`absolute inset-0 transform transition-transform duration-500 ${theme === "light" ? "translate-y-0" : "-translate-y-full"}`}>
                    ☀️
                </span>
            </div>
        </button>
    );
}
