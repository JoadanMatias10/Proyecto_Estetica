import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ isOpen, onClose, title, children, maxWidthClass = "max-w-lg" }) {
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidthClass} max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}>
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors"
                    >
                        ✕
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>,
        document.body
    );
}
