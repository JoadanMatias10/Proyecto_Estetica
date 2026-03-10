import React from "react";

const baseClass = "h-5 w-5";

function IconWrap({ children, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${baseClass} ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function SidebarIcon({ name, className = "" }) {
  switch (name) {
    case "search":
      return (
        <IconWrap className={className}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.2-4.2" />
        </IconWrap>
      );
    case "mail":
      return (
        <IconWrap className={className}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4.5 7.5 7.5 6 7.5-6" />
        </IconWrap>
      );
    case "location":
      return (
        <IconWrap className={className}>
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </IconWrap>
      );
    case "phone":
      return (
        <IconWrap className={className}>
          <path d="M7 3h4l1 3-2 2a14 14 0 0 0 6 6l2-2 3 1v4c0 1.1-.9 2-2 2A17 17 0 0 1 5 5c0-1.1.9-2 2-2Z" />
        </IconWrap>
      );
    case "lock":
      return (
        <IconWrap className={className}>
          <rect x="4" y="11" width="16" height="10" rx="2.5" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
        </IconWrap>
      );
    case "eye":
      return (
        <IconWrap className={className}>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </IconWrap>
      );
    case "eyeOff":
      return (
        <IconWrap className={className}>
          <path d="M3 3 21 21" />
          <path d="M10.6 6.2a10.8 10.8 0 0 1 1.4-.2c6.5 0 10 6 10 6a18 18 0 0 1-2.8 3.5" />
          <path d="M6.2 8.2C3.8 10 2 12 2 12s3.5 6 10 6c.5 0 .9 0 1.4-.1" />
        </IconWrap>
      );
    case "home":
      return (
        <IconWrap className={className}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </IconWrap>
      );
    case "products":
      return (
        <IconWrap className={className}>
          <path d="M12 3 4 7l8 4 8-4-8-4Z" />
          <path d="M4 7v10l8 4 8-4V7" />
          <path d="M12 11v10" />
        </IconWrap>
      );
    case "cart":
      return (
        <IconWrap className={className}>
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <path d="M3 4h2l2.2 10.4a1 1 0 0 0 1 .8h10.8a1 1 0 0 0 1-.8L22 8H7" />
        </IconWrap>
      );
    case "payments":
      return (
        <IconWrap className={className}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M2.5 10h19" />
          <path d="M7 15h4" />
        </IconWrap>
      );
    case "appointments":
      return (
        <IconWrap className={className}>
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M8 3v4M16 3v4M3 10h18" />
          <path d="m9 14 2 2 4-4" />
        </IconWrap>
      );
    case "calendar":
      return (
        <IconWrap className={className}>
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M8 3v4M16 3v4M3 10h18" />
          <circle cx="12" cy="15" r="2.5" />
        </IconWrap>
      );
    case "services":
      return (
        <IconWrap className={className}>
          <path d="M6 3h2l4 8h-2l-1-2H6l-1 2H3l3-8Z" />
          <path d="M15 3h6v2h-4v2h3v2h-3v2h4v2h-6V3Z" />
          <path d="M7.2 7h1.6" />
        </IconWrap>
      );
    case "notifications":
      return (
        <IconWrap className={className}>
          <path d="M15 17H5l1.2-1.4A4 4 0 0 0 7 13V10a5 5 0 1 1 10 0v3a4 4 0 0 0 .8 2.6L19 17h-4" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </IconWrap>
      );
    case "profile":
      return (
        <IconWrap className={className}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </IconWrap>
      );
    case "promotions":
      return (
        <IconWrap className={className}>
          <path d="M20 12 12 4 4 12l8 8 8-8Z" />
          <circle cx="9" cy="11" r="1" />
          <circle cx="15" cy="13" r="1" />
          <path d="m10 14 4-4" />
        </IconWrap>
      );
    case "sales":
      return (
        <IconWrap className={className}>
          <path d="M4 19h16" />
          <path d="M6 16V9m6 7V6m6 10v-4" />
        </IconWrap>
      );
    case "staff":
      return (
        <IconWrap className={className}>
          <circle cx="8" cy="9" r="2.5" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M3 19a5 5 0 0 1 10 0M11 19a5 5 0 0 1 10 0" />
        </IconWrap>
      );
    case "reports":
      return (
        <IconWrap className={className}>
          <path d="M6 3h9l4 4v14H6V3Z" />
          <path d="M15 3v4h4M9 12h6M9 16h6" />
        </IconWrap>
      );
    case "backup":
      return (
        <IconWrap className={className}>
          <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
          <path d="M5 5.5v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" />
          <path d="M5 8.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
          <path d="M12 13.5v7" />
          <path d="m9.5 18 2.5 2.5 2.5-2.5" />
        </IconWrap>
      );
    case "stats":
      return (
        <IconWrap className={className}>
          <path d="M4 19h16" />
          <path d="m6 15 3-3 3 2 6-6" />
          <path d="M18 8h-3V5" />
        </IconWrap>
      );
    case "company":
      return (
        <IconWrap className={className}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2" />
        </IconWrap>
      );
    case "inventory":
      return (
        <IconWrap className={className}>
          <path d="M12 3 4 7l8 4 8-4-8-4Z" />
          <path d="M4 7v10l8 4 8-4V7" />
          <path d="m8.5 14 2 2 5-5" />
        </IconWrap>
      );
    case "carousel":
      return (
        <IconWrap className={className}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <circle cx="8" cy="12" r="1.5" />
          <path d="M3 9h18M3 15h18" />
          <path d="m11 14 2.5-3 2.5 3" />
        </IconWrap>
      );
    case "idea":
      return (
        <IconWrap className={className}>
          <path d="M8.5 14a5 5 0 1 1 7 0c-.8.8-1.5 1.5-1.5 3h-4c0-1.5-.7-2.2-1.5-3Z" />
          <path d="M9.5 20h5M10.2 17h3.6" />
        </IconWrap>
      );
    case "edit":
      return (
        <IconWrap className={className}>
          <path d="M4 20h4l10-10-4-4L4 16v4Z" />
          <path d="m12 6 4 4" />
        </IconWrap>
      );
    case "delete":
      return (
        <IconWrap className={className}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2L18 7" />
          <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
        </IconWrap>
      );
    default:
      return (
        <IconWrap className={className}>
          <circle cx="12" cy="12" r="8" />
        </IconWrap>
      );
  }
}
