import React from "react";
import { Outlet } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-rose-100/30 to-rose-50">
      <PublicHeader />
      <main>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

