import React from "react";
import { Outlet } from "react-router-dom";
import ClientHeader from "./ClientHeader";
import ClientSidebar from "./ClientSidebar";

export default function ClientLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-rose-100/30 to-rose-50">
      <ClientHeader />
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 p-4">
        <ClientSidebar />
        <main className="min-h-[calc(100vh-8rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
