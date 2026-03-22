import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import SidebarIcon from "../../components/ui/SidebarIcon";
import { endpoints, requestJson } from "../../api";

const MODE_CONFIG = {
  invite: {
    title: "Activar cuenta",
    subtitle: "Define tu contrasena para activar tu acceso.",
    successFallback: "Cuenta activada correctamente. Ya puedes iniciar sesion.",
    validateEndpoint: endpoints.validateInvite,
    submitEndpoint: endpoints.acceptInvite,
    submitLabel: "Activar cuenta",
  },
  reset: {
    title: "Restablecer contrasena",
    subtitle: "Define una nueva contrasena para tu cuenta.",
    successFallback: "Contrasena actualizada correctamente. Ya puedes iniciar sesion.",
    validateEndpoint: endpoints.validateResetPassword,
    submitEndpoint: endpoints.resetPassword,
    submitLabel: "Guardar contrasena",
  },
};

function validatePassword(password) {
  if (!password) return "La contrasena es obligatoria";
  if (password.length < 8) return "Minimo 8 caracteres";
  if (!/[A-Z]/.test(password)) return "Requiere una mayuscula";
  if (!/[a-z]/.test(password)) return "Requiere una minuscula";
  if (!/[0-9]/.test(password)) return "Requiere un numero";
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Requiere un simbolo";
  return "";
}

export default function ConfigurarAccesoCuenta({ mode = "reset" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);
  const config = MODE_CONFIG[mode] || MODE_CONFIG.reset;

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingValidation, setLoadingValidation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userPreview, setUserPreview] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function validateToken() {
      if (!token) {
        if (isMounted) {
          setServerError("El enlace no contiene un token valido.");
          setLoadingValidation(false);
        }
        return;
      }

      try {
        const data = await requestJson(config.validateEndpoint(token));
        if (!isMounted) return;
        setUserPreview(data.user || null);
      } catch (error) {
        if (!isMounted) return;
        setServerError(error.message || "El enlace no es valido o ya vencio.");
      } finally {
        if (isMounted) {
          setLoadingValidation(false);
        }
      }
    }

    validateToken();
    return () => {
      isMounted = false;
    };
  }, [config, token]);

  const inputClass = (field) =>
    `mt-1 w-full rounded-xl border-2 px-4 py-2.5 focus:outline-none focus:ring-4 transition-all duration-200 ${
      errors[field]
        ? "border-red-300 focus:border-red-400 focus:ring-red-200"
        : "border-slate-200 focus:ring-violet-300/50 focus:border-violet-400"
    }`;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    const passwordError = validatePassword(formData.password);
    if (passwordError) nextErrors.password = passwordError;
    if (!formData.confirmPassword) nextErrors.confirmPassword = "Confirma tu contrasena";
    else if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = "Las contrasenas no coinciden";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError("");
    setSuccessMessage("");

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const data = await requestJson(config.submitEndpoint, {
        method: "POST",
        body: {
          token,
          password: formData.password,
        },
      });

      setSuccessMessage(data.message || config.successFallback);
      setFormData({ password: "", confirmPassword: "" });
      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1400);
    } catch (error) {
      setServerError(error.message || "No fue posible completar la operacion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="card rounded-3xl p-8 shadow-xl">
        <h1 className="page-title">{config.title}</h1>
        <p className="page-subtitle mt-2">{config.subtitle}</p>

        {userPreview && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="font-semibold text-slate-800">{userPreview.nombre || "Cuenta encontrada"}</div>
            <div>{userPreview.correo}</div>
          </div>
        )}

        {serverError && (
          <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 mt-4 text-sm font-medium">
            {serverError}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl p-3 mt-4 text-sm font-medium">
            {successMessage}
          </div>
        )}

        {!loadingValidation && !serverError && (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="form-label">Nueva contraseña</label>
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
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 focus:outline-none"
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                >
                  <SidebarIcon name={showPassword ? "eyeOff" : "eye"} className="h-4 w-4" />
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1 font-medium">{errors.password}</p>}
            </div>

            <div>
              <label className="form-label">Confirmar contraseña</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <SidebarIcon name="lock" className="h-4 w-4" />
                </span>
                <input
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  type={showConfirmPassword ? "text" : "password"}
                  className={`${inputClass("confirmPassword")} pl-10 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 focus:outline-none"
                  aria-label={showConfirmPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                >
                  <SidebarIcon name={showConfirmPassword ? "eyeOff" : "eye"} className="h-4 w-4" />
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-500 mt-1 font-medium">{errors.confirmPassword}</p>}
              <p className="text-xs text-slate-400 mt-1 pl-1">Min. 8 caracteres, mayus, minus, numero y simbolo.</p>
            </div>

            <Button type="submit" disabled={submitting} className="w-full py-3 rounded-xl">
              {submitting ? "Guardando..." : config.submitLabel}
            </Button>
          </form>
        )}

        {loadingValidation && (
          <div className="mt-6 text-sm font-medium text-slate-500">Validando enlace...</div>
        )}

        <p className="text-sm text-slate-500 mt-6">
          <Link className="text-violet-600 hover:text-violet-700 font-semibold transition-colors" to="/login">
            Volver a iniciar sesion
          </Link>
        </p>
      </div>
    </div>
  );
}
