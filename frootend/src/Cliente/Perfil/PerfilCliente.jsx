import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { getClientPayments, getClientToken, getNotificationPreferences, getStoredClientUser, saveClientPayments } from "../../utils/clientStore";

export default function PerfilCliente() {
  const [user, setUser] = useState(() => getStoredClientUser());
  const [payments, setPayments] = useState(() => getClientPayments());
  const preferences = getNotificationPreferences();
  const enabledNotifications = Object.values(preferences).filter(Boolean).length;

  useEffect(() => {
    const refresh = () => {
      setUser(getStoredClientUser());
      setPayments(getClientPayments());
    };
    const loadPayments = async () => {
      try {
        const data = await requestJson(endpoints.clientPayments, { token: getClientToken() });
        setPayments(saveClientPayments(Array.isArray(data.payments) ? data.payments : []));
      } catch (_error) {
        setPayments(getClientPayments());
      }
    };

    loadPayments();
    window.addEventListener("client-state-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("client-state-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="card p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="page-title">Perfil del cliente</h1>
            <p className="page-subtitle mt-3 text-lg">
              {user?.nombre ? `${user.nombre} ${user.apellidoPaterno || ""}`.trim() : "Administra tu informacion y notificaciones."}
            </p>
            {user?.correo && <p className="mt-1 text-sm font-medium text-slate-500">{user.correo}</p>}
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-200 to-violet-200 text-2xl font-bold text-violet-700 shadow-sm">
            {user?.nombre ? user.nombre.charAt(0).toUpperCase() : "C"}
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link to="/cliente/perfil/info">
            <Button className="px-8 py-3 rounded-xl">Informacion del cliente</Button>
          </Link>
          <Link to="/cliente/perfil/notificaciones">
            <Button variant="outline" className="px-8 py-3 rounded-xl border-2">Notificaciones</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <SidebarIcon name="payments" className="h-6 w-6 text-violet-600" />
          <div className="mt-3 text-2xl font-bold text-slate-800">{payments.length}</div>
          <div className="text-sm font-medium text-slate-500">Pagos registrados</div>
        </div>
        <div className="card p-5">
          <SidebarIcon name="notifications" className="h-6 w-6 text-violet-600" />
          <div className="mt-3 text-2xl font-bold text-slate-800">{enabledNotifications}</div>
          <div className="text-sm font-medium text-slate-500">Alertas activas</div>
        </div>
        <div className="card p-5">
          <SidebarIcon name="profile" className="h-6 w-6 text-violet-600" />
          <div className="mt-3 text-2xl font-bold text-slate-800">{user?.telefono ? "Completo" : "Pendiente"}</div>
          <div className="text-sm font-medium text-slate-500">Estado del perfil</div>
        </div>
      </div>
    </div>
  );
}
