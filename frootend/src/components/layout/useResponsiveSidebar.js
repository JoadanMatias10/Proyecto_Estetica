import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function useResponsiveSidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return {
    isOpen,
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((current) => !current),
  };
}
