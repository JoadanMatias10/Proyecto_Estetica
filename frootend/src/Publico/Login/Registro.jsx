import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import { endpoints } from "../../api";
import SidebarIcon from "../../components/ui/SidebarIcon";

export default function Registro() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    telefono: "",
    correo: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const validate = () => {
    const newErrors = {};
    if (!formData.nombre) newErrors.nombre = "El nombre es obligatorio";
    if (!formData.apellidoPaterno) newErrors.apellidoPaterno = "El apellido paterno es obligatorio";
    if (!formData.apellidoMaterno) newErrors.apellidoMaterno = "El apellido materno es obligatorio";

    if (!formData.telefono) newErrors.telefono = "El telefono es obligatorio";
    else if (!/^\d{10}$/.test(formData.telefono)) newErrors.telefono = "El telefono debe tener 10 digitos numericos";

    if (!formData.correo) newErrors.correo = "El correo es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo)) newErrors.correo = "Formato de correo invalido";

    if (!formData.password) newErrors.password = "La contrasena es obligatoria";
    else {
      if (formData.password.length < 8) newErrors.password = "Minimo 8 caracteres";
      else if (!/[A-Z]/.test(formData.password)) newErrors.password = "Requiere una mayuscula";
      else if (!/[a-z]/.test(formData.password)) newErrors.password = "Requiere una minuscula";
      else if (!/[0-9]/.test(formData.password)) newErrors.password = "Requiere un numero";
      else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) newErrors.password = "Requiere un simbolo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (validate()) {
      setLoading(true);
      try {
        const response = await fetch(endpoints.register, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await response.json();

        if (response.ok) {
          alert("Registro exitoso. Por favor inicia sesion.");
          navigate("/login");
        } else {
          setServerError(data.errors ? data.errors[0] : "Error al registrarse");
        }
      } catch (error) {
        setServerError("Error de conexion con el servidor");
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

  const inputClass = (field) =>
    `mt-1 w-full rounded-xl border-2 px-4 py-2.5 focus:outline-none focus:ring-4 transition-all duration-200 ${errors[field]
      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
      : "border-slate-200 focus:ring-violet-300/50 focus:border-violet-400"
    }`;

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="card rounded-3xl p-8 shadow-xl">
        <h1 className="page-title">Registro</h1>
        <p className="page-subtitle mt-2">Crea tu cuenta para agendar y comprar.</p>

        {serverError && (
          <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 mb-4 text-sm font-medium">
            {serverError}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Nombre</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <SidebarIcon name="profile" className="h-4 w-4" />
                </span>
                <input name="nombre" value={formData.nombre} onChange={handleChange} className={`${inputClass("nombre")} pl-10`} />
              </div>
              {errors.nombre && <p className="text-xs text-red-500 mt-1 font-medium">{errors.nombre}</p>}
            </div>

            <div>
              <label className="form-label">Apellido Paterno</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <SidebarIcon name="profile" className="h-4 w-4" />
                </span>
                <input
                  name="apellidoPaterno"
                  value={formData.apellidoPaterno}
                  onChange={handleChange}
                  className={`${inputClass("apellidoPaterno")} pl-10`}
                />
              </div>
              {errors.apellidoPaterno && <p className="text-xs text-red-500 mt-1 font-medium">{errors.apellidoPaterno}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Apellido Materno</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <SidebarIcon name="profile" className="h-4 w-4" />
                </span>
                <input
                  name="apellidoMaterno"
                  value={formData.apellidoMaterno}
                  onChange={handleChange}
                  className={`${inputClass("apellidoMaterno")} pl-10`}
                />
              </div>
              {errors.apellidoMaterno && <p className="text-xs text-red-500 mt-1 font-medium">{errors.apellidoMaterno}</p>}
            </div>

            <div>
              <label className="form-label">Telefono</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <SidebarIcon name="phone" className="h-4 w-4" />
                </span>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  maxLength={10}
                  className={`${inputClass("telefono")} pl-10`}
                />
              </div>
              {errors.telefono && <p className="text-xs text-red-500 mt-1 font-medium">{errors.telefono}</p>}
            </div>
          </div>

          <div>
            <label className="form-label">Correo</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SidebarIcon name="mail" className="h-4 w-4" />
              </span>
              <input name="correo" value={formData.correo} onChange={handleChange} className={`${inputClass("correo")} pl-10`} />
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
            <p className="text-xs text-slate-400 mt-1 pl-1">Min. 8 caracteres, mayus, minus, numero y simbolo.</p>
          </div>

          <Button type="submit" disabled={loading} className="w-full py-3 rounded-xl">
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>

          <p className="text-sm text-slate-500 mt-3">
            Ya tienes cuenta?{" "}
            <Link className="text-violet-600 hover:text-violet-700 font-semibold transition-colors" to="/login">
              Inicia sesion
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
