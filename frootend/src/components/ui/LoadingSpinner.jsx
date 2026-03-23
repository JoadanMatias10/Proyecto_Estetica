export default function LoadingSpinner({
    fullScreen = true,
    className = "",
    text = "Cargando...",
    showText,
    spinnerClassName = "",
    textClassName = "",
}) {
    const shouldShowText = showText ?? Boolean(text);
    const defaultSpinnerClasses = fullScreen
        ? "w-20 h-20 border-[5px] border-sky-200 border-t-blue-600"
        : "w-12 h-12 border-[3px] border-sky-200 border-t-blue-600";
    const defaultTextClasses = fullScreen
        ? "mt-5 text-lg font-semibold text-blue-600"
        : "mt-4 text-base font-semibold text-blue-600 sm:text-lg";
    const spinnerClasses = `${spinnerClassName || defaultSpinnerClasses} rounded-full animate-spin`;
    const textClasses = `${textClassName || defaultTextClasses} animate-pulse`;

    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
                <div className="flex flex-col items-center">
                    <div className={spinnerClasses}></div>
                    {shouldShowText && <p className={textClasses}>{text}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col justify-center items-center ${className}`}>
            <div className={spinnerClasses}></div>
            {shouldShowText && <p className={textClasses}>{text}</p>}
        </div>
    );
}
