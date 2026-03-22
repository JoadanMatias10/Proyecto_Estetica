import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import { endpoints } from "../../api";
import ErrorPage from "../Error/ErrorPage";
import SidebarIcon from "../../components/ui/SidebarIcon";

export default function InicioSesion() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ correo: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const validate = () => {
    const newErrors = {};
    if (!formData.correo) newErrors.correo = "El correo es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo)) newErrors.correo = "Formato invalido";
    if (!formData.password) newErrors.password = "La contrasena es obligatoria";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (validate()) {
      setLoading(true);
      try {
        const response = await fetch(endpoints.login, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await response.json();

        if (response.ok) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));

          if (data.user?.role === "admin" || data.user?.role === "stylist") {
            localStorage.setItem("adminToken", data.token);
            localStorage.setItem("adminUser", JSON.stringify(data.user));
            navigate("/admin");
          } else {
            navigate("/cliente");
          }
        } else {
          setServerError(data.errors ? data.errors[0] : "Error al iniciar sesion");
        }
      } catch (error) {
        setServerError("CRITICAL_ERROR");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  if (serverError === "CRITICAL_ERROR") {
    return (
      <ErrorPage
        code="500"
        title="Error de Conexion"
        message="No se pudo contactar con el servidor. Verifica tu conexion o intenta mas tarde."
      />
    );
  }

  const inputClass = (field) =>
    `mt-1 w-full rounded-xl border-2 px-4 py-2.5 focus:outline-none focus:ring-4 transition-all duration-200 ${errors[field]
      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
      : "border-slate-200 focus:ring-violet-300/50 focus:border-violet-400"
    }`;

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="card rounded-3xl p-8 shadow-xl">
        <h1 className="page-title">Inicio de sesion</h1>
        <p className="page-subtitle mt-2">Accede para agendar citas y comprar productos.</p>

        {serverError && (
          <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 mb-4 text-sm font-medium">
            {serverError}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">Correo</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SidebarIcon name="mail" className="h-4 w-4" />
              </span>
              <input
                type="email"
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                className={`${inputClass("correo")} pl-10`}
              />
            </div>
            {errors.correo && <p className="text-xs text-red-500 mt-1 font-medium">{errors.correo}</p>}
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
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 focus:outline-none"
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                <SidebarIcon name={showPassword ? "eyeOff" : "eye"} className="h-4 w-4" />
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1 font-medium">{errors.password}</p>}
          </div>

          <Button type="submit" disabled={loading} className="w-full py-3 rounded-xl mt-6">
            {loading ? "Ingresando..." : "Iniciar sesion"}
          </Button>

          <div className="flex justify-between text-sm mt-2">
            <Link className="text-violet-600 hover:text-violet-700 transition-colors" to="/recuperar">
              Olvidaste tu contrasena?
            </Link>
            <Link className="text-violet-600 hover:text-violet-700 transition-colors" to="/registro">
              Crear cuenta
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
