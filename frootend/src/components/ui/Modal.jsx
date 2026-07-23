import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import SidebarIcon from "./SidebarIcon";

export default function Modal({ isOpen, onClose, title, children, maxWidthClass = "max-w-lg" }) {
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose();
        };
        if (!isOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleEsc);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleEsc);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4">
            <div className={`flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-white shadow-xl animate-in zoom-in-95 duration-200 sm:max-h-[90vh] sm:rounded-lg ${maxWidthClass}`}>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
                    <h3 className="min-w-0 break-words text-base font-bold text-gray-800 sm:text-lg">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Cerrar"
                    >
                        <SidebarIcon name="close" className="h-5 w-5" />
                    </button>
                </div>
                <div className="overflow-y-auto p-4 sm:p-6">{children}</div>
            </div>
        </div>,
        document.body
    );
}
