import React from "react";

/**
 * SidebarIcon — Professional SVG icons (Heroicons / Lucide style)
 * strokeWidth: 1.6  |  No animations  |  24×24 viewBox
 */

function Icon({ className = "", children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-5 w-5 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function SidebarIcon({ name, className = "" }) {
  switch (name) {

    /* ── Navigation / General ─────────────────────────────────────── */

    case "home":
      // House with a chimney
      return (
        <Icon className={className}>
          <path d="M3 12 12 3l9 9" />
          <path d="M9 21V12h6v9" />
          <path d="M3 12v9h18v-9" />
        </Icon>
      );

    case "idea":
      // Light-bulb
      return (
        <Icon className={className}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 1 5 11.9V17a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-3.1A7 7 0 0 1 12 2Z" />
        </Icon>
      );

    case "highlights":
      return (
        <Icon className={className}>
          <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
          <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
          <path d="M5 14l.7 1.6L7.3 16l-1.6.7L5 18.3l-.7-1.6L2.7 16l1.6-.7L5 14Z" />
        </Icon>
      );

    case "search":
      return (
        <Icon className={className}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </Icon>
      );

    case "edit":
      return (
        <Icon className={className}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
        </Icon>
      );

    case "delete":
      return (
        <Icon className={className}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </Icon>
      );

    /* ── Contact / Auth ───────────────────────────────────────────── */

    case "mail":
      return (
        <Icon className={className}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <polyline points="2,4 12,13 22,4" />
        </Icon>
      );

    case "phone":
      return (
        <Icon className={className}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 11.9 19.79 19.79 0 0 1 1.07 3.3 2 2 0 0 1 3.07 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
        </Icon>
      );

    case "location":
      return (
        <Icon className={className}>
          <path d="M21 10c0 6.075-9 13-9 13S3 16.075 3 10a9 9 0 1 1 18 0Z" />
          <circle cx="12" cy="10" r="3" />
        </Icon>
      );

    case "lock":
      return (
        <Icon className={className}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </Icon>
      );

    case "eye":
      return (
        <Icon className={className}>
          <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12Z" />
          <circle cx="12" cy="12" r="3" />
        </Icon>
      );

    case "eyeOff":
      return (
        <Icon className={className}>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </Icon>
      );

    /* ── Admin Menu ───────────────────────────────────────────────── */

    case "services":
      // Scissors — servicios de estética
      return (
        <Icon className={className}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <line x1="20" y1="4" x2="8.12" y2="15.88" />
          <line x1="14.47" y1="14.48" x2="20" y2="20" />
          <line x1="8.12" y1="8.12" x2="12" y2="12" />
        </Icon>
      );

    case "servicesCat":
      // Folder with a label — category for services
      return (
        <Icon className={className}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </Icon>
      );

    case "productsCat":
      // Grid / four squares — category
      return (
        <Icon className={className}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </Icon>
      );

    case "brands":
      // Star — brand / mark
      return (
        <Icon className={className}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </Icon>
      );

    case "promotions":
      // Tag with % symbol
      return (
        <Icon className={className}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </Icon>
      );

    case "products":
      // Shopping bag
      return (
        <Icon className={className}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </Icon>
      );

    case "sales":
      // Receipt / ticket de venta
      return (
        <Icon className={className}>
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <line x1="8" y1="9" x2="16" y2="9" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="12" y2="17" />
        </Icon>
      );

    case "staff":
      // Two people / users
      return (
        <Icon className={className}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Icon>
      );

    case "reports":
      // File with bar chart inside
      return (
        <Icon className={className}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="15" x2="9" y2="18" />
          <line x1="12" y1="12" x2="12" y2="18" />
          <line x1="15" y1="9" x2="15" y2="18" />
        </Icon>
      );

    case "stats":
      // Trend line with arrow
      return (
        <Icon className={className}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </Icon>
      );

    case "predictive":
      // Trend line + magic wand sparkle — Modelo Predictivo
      return (
        <Icon className={className}>
          <polyline points="2 17 8 11 13 14 19 7" />
          <path d="M17 3l1.5 1.5L17 6l-1.5-1.5L17 3Z" />
          <path d="M20 6l1 1-1 1-1-1 1-1Z" />
          <path d="M14 2l1 1-1 1-1-1 1-1Z" />
          <line x1="19" y1="7" x2="22" y2="7" />
        </Icon>
      );

    case "company":
      // Building / office
      return (
        <Icon className={className}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
          <rect x="12" y="12" width="3" height="3" />
          <rect x="12" y="16" width="3" height="3" />
        </Icon>
      );

    case "carousel":
      // Image / gallery slides
      return (
        <Icon className={className}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="m2 10 4-4 4 4 4-4 4 4" />
          <circle cx="8" cy="19" r="1" />
          <circle cx="12" cy="19" r="1" />
          <circle cx="16" cy="19" r="1" />
        </Icon>
      );

    case "inventory":
      // Warehouse / boxes stack
      return (
        <Icon className={className}>
          <path d="M2 3h20v5H2z" />
          <path d="M4 8v13" />
          <path d="M20 8v13" />
          <path d="M2 21h20" />
          <path d="M9 8v4a3 3 0 0 0 6 0V8" />
        </Icon>
      );

    case "backup":
      // Cloud upload / server sync
      return (
        <Icon className={className}>
          <polyline points="16 16 12 12 8 16" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </Icon>
      );

    case "database":
      // Stacked cylinders — DB
      return (
        <Icon className={className}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9" />
          <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
        </Icon>
      );

    /* ── Client Menu ──────────────────────────────────────────────── */

    case "cart":
      // Shopping cart
      return (
        <Icon className={className}>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </Icon>
      );

    case "payments":
      // Credit card
      return (
        <Icon className={className}>
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
          <line x1="5" y1="15" x2="9" y2="15" />
          <line x1="12" y1="15" x2="14" y2="15" />
        </Icon>
      );

    case "appointments":
      // Calendar with checkmark
      return (
        <Icon className={className}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <polyline points="9 16 11 18 15 14" />
        </Icon>
      );

    case "calendar":
      // Calendar with a dot indicator
      return (
        <Icon className={className}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <circle cx="12" cy="16" r="2" />
        </Icon>
      );

    case "notifications":
      // Bell
      return (
        <Icon className={className}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </Icon>
      );

    case "profile":
      // Single user silhouette
      return (
        <Icon className={className}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </Icon>
      );

    /* ── Fallback ─────────────────────────────────────────────────── */

    default:
      return (
        <Icon className={className}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </Icon>
      );
  }
}
