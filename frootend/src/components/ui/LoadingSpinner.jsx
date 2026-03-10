export default function LoadingSpinner({ fullScreen = true, className = "", text = "Cargando...", showText }) {
    const shouldShowText = showText ?? fullScreen;

    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-slate-200 border-t-black rounded-full animate-spin"></div>
                    {shouldShowText && <p className="mt-4 text-slate-600 font-medium animate-pulse">{text}</p>}
                </div>      
            </div>
        );
    }

    return (
        <div className={`flex flex-col justify-center items-center ${className}`}>
            <div className="w-6 h-6 border-2 border-slate-200 border-t-black rounded-full animate-spin"></div>
            {shouldShowText && <p className="mt-3 text-sm text-slate-600 font-medium animate-pulse">{text}</p>}
        </div>
    );
}
