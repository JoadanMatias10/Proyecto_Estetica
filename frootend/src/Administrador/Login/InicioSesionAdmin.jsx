import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import ErrorPage from "../../Publico/Error/ErrorPage";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints } from "../../api";

export default function InicioSesionAdmin() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ usuario: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const validate = () => {
    const nextErrors = {};
    if (!formData.usuario.trim()) nextErrors.usuario = "El usuario es obligatorio";
    if (!formData.password) nextErrors.password = "La contrasena es obligatoria";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await fetch(endpoints.adminLogin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: formData.usuario.trim(),
          password: formData.password,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setServerError(data.errors ? data.errors[0] : "No fue posible iniciar sesion.");
        return;
      }

      localStorage.setItem("adminToken", data.token);
      localStorage.setItem("adminUser", JSON.stringify(data.user));
      navigate("/admin");
    } catch (_error) {
      setServerError("CRITICAL_ERROR");
    } finally {
      setLoading(false);
    }
  };

  if (serverError === "CRITICAL_ERROR") {
    return (
      <ErrorPage
        code="500"
        title="Error de Conexion"
        message="No se pudo contactar con el servidor. Verifica que el backend este activo."
      />
    );
  }

  const inputClass = (field) =>
    `mt-1 w-full rounded-xl border-2 px-4 py-2.5 focus:outline-none focus:ring-4 transition-all duration-200 ${
      errors[field]
        ? "border-red-300 focus:border-red-400 focus:ring-red-200"
        : "border-slate-200 focus:ring-violet-300/50 focus:border-violet-400"
    }`;

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="card rounded-3xl p-8 shadow-xl">
        <h1 className="page-title">Acceso Administrador</h1>
        <p className="page-subtitle mt-2">Inicia sesion para entrar al panel administrativo.</p>

        {serverError && (
          <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 mb-4 text-sm font-medium mt-6">
            {serverError}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">Usuario</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SidebarIcon name="profile" className="h-4 w-4" />
              </span>
              <input
                name="usuario"
                value={formData.usuario}
                onChange={handleChange}
                className={`${inputClass("usuario")} pl-10`}
                autoComplete="username"
              />
            </div>
            {errors.usuario && <p className="text-xs text-red-500 mt-1 font-medium">{errors.usuario}</p>}
          </div>

          <div>
            <label className="form-label">Contrasena</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SidebarIcon name="lock" className="h-4 w-4" />
              </span>
              <input
                name="password"
                value={formData.password}
                onChange={handleChange}
                type={showPassword ? "text" : "password"}
                className={`${inputClass("password")} pl-10 pr-10`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 focus:outline-none"
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                <SidebarIcon name={showPassword ? "eyeOff" : "eye"} className="h-4 w-4" />
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1 font-medium">{errors.password}</p>}
          </div>

          <Button type="submit" disabled={loading} className="w-full py-3 rounded-xl mt-6">
            {loading ? "Verificando..." : "Entrar al panel admin"}
          </Button>

          <div className="text-sm mt-2">
            <Link className="text-violet-600 hover:text-violet-700 transition-colors" to="/login">
              Volver a login de clientes
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
