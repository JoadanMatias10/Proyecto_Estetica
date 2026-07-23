import React, { useState } from "react";
import { Link } from "react-router-dom";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import { getClientToken, getNotificationPreferences, saveNotificationPreferences } from "../../utils/clientStore";

const options = [
  { key: "appointmentReminders", label: "Avisos de proxima cita" },
  { key: "promotions", label: "Promociones AVYNA" },
  { key: "appointmentChanges", label: "Cambios en citas" },
];

export default function NotificacionesCliente() {
  const [preferences, setPreferences] = useState(() => getNotificationPreferences());
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    const loadPreferences = async () => {
      try {
        const token = getClientToken();
        const data = await requestJson(endpoints.clientNotificationSettings, { token });
        if (data.notificationPreferences) {
          setPreferences(data.notificationPreferences);
          saveNotificationPreferences(data.notificationPreferences);
        }
      } catch (_error) {
        setPreferences(getNotificationPreferences());
      }
    };

    loadPreferences();
  }, []);

  const handleToggle = (key) => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
    setMessage("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = getClientToken();
      const data = await requestJson(endpoints.clientNotificationPreferences, {
        method: "PUT",
        token,
        body: preferences,
      });
      const nextPreferences = data.notificationPreferences || preferences;
      setPreferences(nextPreferences);
      saveNotificationPreferences(nextPreferences);
      setMessage(data.message || "Preferencias guardadas.");
    } catch (error) {
      saveNotificationPreferences(preferences);
      setMessage(error.message || "Preferencias guardadas localmente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Notificaciones</h1>
      <p className="page-subtitle mt-2">Preferencias y alertas internas.</p>

      <div className="card mt-8 space-y-4 p-4 sm:p-8">
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {options.map((option) => (
          <label key={option.key} className="flex items-center justify-between p-4 rounded-xl bg-violet-50/50 border border-violet-100 cursor-pointer hover:bg-violet-50 transition-colors">
            <span className="font-semibold text-slate-700">{option.label}</span>
            <input
              type="checkbox"
              checked={Boolean(preferences[option.key])}
              onChange={() => handleToggle(option.key)}
              className="w-5 h-5 text-violet-500 rounded focus:ring-violet-400 border-violet-300"
            />
          </label>
        ))}

        <div className="flex flex-col gap-4 pt-4 sm:flex-row">
          <Button type="button" onClick={handleSave} disabled={isSaving} className="w-full py-3 rounded-xl">
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
          <Link to="/cliente/notificaciones" className="w-full">
            <Button variant="outline" className="w-full py-3 rounded-xl border-2">Configurar recordatorios</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
