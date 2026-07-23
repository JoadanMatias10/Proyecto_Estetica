import React, { useEffect, useState } from "react";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { getClientToken, getStoredClientUser, saveStoredClientUser } from "../../utils/clientStore";

const emptyForm = {
  id: "",
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  telefono: "",
  correo: "",
};

export default function InformacionCliente() {
  const [form, setForm] = useState(() => ({ ...emptyForm, ...(getStoredClientUser() || {}) }));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const token = getClientToken();
        const data = await requestJson(endpoints.clientMe, { token });
        const nextUser = { ...emptyForm, ...(data.user || {}) };
        setForm(nextUser);
        saveStoredClientUser(nextUser);
      } catch (error) {
        const storedUser = getStoredClientUser();
        if (storedUser) {
          setForm({ ...emptyForm, ...storedUser });
        } else {
          setErrorMessage(error.message || "No fue posible cargar tus datos.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!form.id) {
      setErrorMessage("No se pudo identificar tu perfil.");
      return;
    }

    setIsSaving(true);
    try {
      const token = getClientToken();
      const data = await requestJson(endpoints.clientProfile(form.id), {
        method: "POST",
        token,
        body: {
          nombre: form.nombre,
          apellidoPaterno: form.apellidoPaterno,
          apellidoMaterno: form.apellidoMaterno,
          telefono: form.telefono,
          correo: form.correo,
        },
      });
      const nextUser = { ...form, ...(data.user || {}) };
      setForm(nextUser);
      saveStoredClientUser(nextUser);
      setMessage(data.message || "Datos actualizados correctamente.");
    } catch (error) {
      setErrorMessage(error.message || "No fue posible guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Cargando perfil..." fullScreen={false} className="py-24" />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="page-title">Informacion del cliente</h1>
      <p className="page-subtitle mt-2">Actualiza tus datos personales.</p>

      <form onSubmit={handleSubmit} className="card mt-8 space-y-6 p-4 sm:p-8">
        {(message || errorMessage) && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${message ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
            {message || errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="form-label">Nombre</label>
            <input name="nombre" className="form-input" value={form.nombre} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label">Apellido paterno</label>
            <input name="apellidoPaterno" className="form-input" value={form.apellidoPaterno} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label">Apellido materno</label>
            <input name="apellidoMaterno" className="form-input" value={form.apellidoMaterno} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label">Telefono</label>
            <input name="telefono" className="form-input" value={form.telefono} onChange={handleChange} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Correo</label>
            <input name="correo" type="email" className="form-input" value={form.correo} onChange={handleChange} />
          </div>
        </div>

        <Button type="submit" disabled={isSaving} className="w-full py-4 rounded-xl">
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>
    </div>
  );
}
