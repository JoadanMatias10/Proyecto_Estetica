import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

const STAFF_ROLES = ["Administrador", "Estilista"];

const getDefaultFormValues = (staff = null) => ({
  nombre: staff?.nombre || "",
  rol: staff?.rol || "Estilista",
  email: staff?.email || "",
  telefono: staff?.telefono || "",
  estado: staff?.estado || "Activo",
});

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function formatInviteDate(value) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch (_error) {
    return "";
  }
}

function getAccountBadge(accountStatus) {
  switch (accountStatus) {
    case "active":
      return {
        label: "Activa",
        className: "bg-emerald-100 text-emerald-700",
      };
    case "pending":
      return {
        label: "Pendiente",
        className: "bg-amber-100 text-amber-700",
      };
    case "inactive":
      return {
        label: "Inactiva",
        className: "bg-slate-100 text-slate-600",
      };
    default:
      return {
        label: "Sin cuenta",
        className: "bg-slate-100 text-slate-500",
      };
  }
}

export default function GestionPersonal() {
  const navigate = useNavigate();
  const [personal, setPersonal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteLoadingId, setInviteLoadingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStaff, setCurrentStaff] = useState(null);
  const [formValues, setFormValues] = useState(getDefaultFormValues());

  const personalOrdenado = useMemo(
    () => [...personal].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [personal]
  );

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  const resetFeedback = useCallback(() => {
    setErrorMessage("");
    setSuccessMessage("");
    setWarningMessage("");
  }, []);

  const formatStaffError = useCallback((error, fallback) => {
    if (error.status === 404) {
      return "El modulo de personal no esta disponible en el servidor actual. Reinicia backend con la version mas reciente.";
    }
    return error.message || fallback;
  }, []);

  const applyResponseFeedback = useCallback((data, fallbackMessage) => {
    setSuccessMessage(data?.message || fallbackMessage || "");
    setWarningMessage(data?.warning || "");
  }, []);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const data = await requestJson(endpoints.adminStaff, {
        token: getAdminToken(),
      });
      setPersonal(Array.isArray(data.staff) ? data.staff : []);
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(formatStaffError(error, "No fue posible cargar personal."));
    } finally {
      setLoading(false);
    }
  }, [formatStaffError, handleUnauthorized]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const openModal = (staff = null) => {
    resetFeedback();
    setCurrentStaff(staff);
    setFormValues(getDefaultFormValues(staff));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setCurrentStaff(null);
    setFormValues(getDefaultFormValues());
    setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar empleado?")) return;

    resetFeedback();
    try {
      await requestJson(endpoints.adminStaffById(id), {
        method: "DELETE",
        token: getAdminToken(),
      });
      setPersonal((prev) => prev.filter((item) => item.id !== id));
      setSuccessMessage("Personal eliminado.");
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(formatStaffError(error, "No fue posible eliminar empleado."));
    }
  };

  const handleInvite = async (staff) => {
    resetFeedback();
    setInviteLoadingId(staff.id);

    try {
      const data = await requestJson(endpoints.adminStaffInvite(staff.id), {
        method: "POST",
        token: getAdminToken(),
      });
      setPersonal((prev) => prev.map((item) => (item.id === staff.id ? data.staff : item)));
      applyResponseFeedback(data, "Invitacion enviada correctamente.");
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(formatStaffError(error, "No fue posible enviar la invitacion."));
    } finally {
      setInviteLoadingId("");
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      nombre: formValues.nombre.trim(),
      rol: formValues.rol,
      email: formValues.email.trim(),
      telefono: formValues.telefono.trim(),
      estado: formValues.estado,
    };

    setSubmitting(true);
    resetFeedback();
    try {
      if (currentStaff) {
        const data = await requestJson(endpoints.adminStaffById(currentStaff.id), {
          method: "PUT",
          token: getAdminToken(),
          body: payload,
        });
        setPersonal((prev) => prev.map((item) => (item.id === currentStaff.id ? data.staff : item)));
        applyResponseFeedback(data, "Personal actualizado.");
      } else {
        const data = await requestJson(endpoints.adminStaff, {
          method: "POST",
          token: getAdminToken(),
          body: payload,
        });
        setPersonal((prev) => [...prev, data.staff]);
        applyResponseFeedback(data, "Personal creado.");
      }
      closeModal();
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(formatStaffError(error, "No fue posible guardar empleado."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion de Personal</h1>
          <p className="text-slate-500 text-sm">Administra personal interno, cuentas y activaciones.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => openModal()}
          aria-label="Nuevo Empleado"
          title="Nuevo Empleado"
          className="w-10 h-10 p-0 rounded-full text-black border-2 border-slate-300 bg-white hover:bg-slate-50"
        >
          +
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      {warningMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          {warningMessage}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando personal..." className="py-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Correo</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4">Cuenta</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {personalOrdenado.map((item) => {
                  const accountBadge = getAccountBadge(item.accountStatus);
                  const inviteDate = formatInviteDate(item.inviteSentAt);
                  const canInvite = item.estado === "Activo" && item.accountStatus !== "active";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{item.nombre}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-md text-xs font-semibold ${
                            item.rol === "Administrador"
                              ? "bg-violet-50 text-violet-600"
                              : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {item.rol}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">{item.email}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{item.telefono}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex w-fit px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${accountBadge.className}`}>
                            {accountBadge.label}
                          </span>
                          {inviteDate && (
                            <span className="text-xs text-slate-400">Invitacion: {inviteDate}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.estado === "Activo"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleInvite(item)}
                            disabled={!canInvite || inviteLoadingId === item.id}
                            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-sky-200 bg-white text-sky-500 hover:text-sky-600 hover:border-sky-300 hover:bg-sky-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Enviar invitacion"
                            title={item.accountStatus === "pending" ? "Reenviar invitacion" : "Enviar invitacion"}
                          >
                            <SidebarIcon name="mail" className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openModal(item)}
                            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-orange-200 bg-white text-orange-500 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50 transition-colors shadow-sm"
                            aria-label="Editar staff"
                          >
                            <SidebarIcon name="edit" className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-red-200 bg-white text-red-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors shadow-sm"
                            aria-label="Eliminar staff"
                          >
                            <SidebarIcon name="delete" className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {personalOrdenado.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-400">
                      No hay personal registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={currentStaff ? "Editar Empleado" : "Nuevo Empleado"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Nombre Completo</label>
            <input
              name="nombre"
              value={formValues.nombre}
              onChange={handleInputChange}
              required
              className="form-input"
              placeholder="Nombre"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Rol</label>
              <select name="rol" value={formValues.rol} onChange={handleInputChange} className="form-input">
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Estado</label>
              <select name="estado" value={formValues.estado} onChange={handleInputChange} className="form-input">
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Email</label>
              <input
                name="email"
                type="email"
                value={formValues.email}
                onChange={handleInputChange}
                required
                className="form-input"
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="form-label">Telefono</label>
              <input
                name="telefono"
                value={formValues.telefono}
                onChange={handleInputChange}
                required
                className="form-input"
                placeholder="5551234567"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Si el personal esta activo, el sistema intentara enviar o reenviar la invitacion de acceso.
          </p>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-60"
            >
              {submitting ? "Guardando..." : currentStaff ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
