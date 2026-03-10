import React, { useEffect, useState } from "react";
import SidebarIcon from "../../components/ui/SidebarIcon";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

const EMPTY_COMPANY_INFO = {
  nombre: "",
  direccion: "",
  telefono: "",
  email: "",
  mision: "",
  vision: "",
  valores: "",
  facebook: "",
  instagram: "",
  quienesSomosTexto: "",
  quienesSomosEsencia: "",
  horarioLunesSabado: "",
  horarioDomingo: "",
  mapLat: "",
  mapLng: "",
  mapZoom: "15",
  mapGoogleUrl: "",
  politicasDocumento: "",
  politicasDocumentoNombre: "",
  politicasDocumentoTipo: "",
};

const ALLOWED_POLICY_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const ALLOWED_POLICY_DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];

const MAX_POLICY_DOCUMENT_BYTES = 5 * 1024 * 1024;

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function buildEmbedUrl(lat, lng, zoom) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const parsedZoom = Number(zoom || 15);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return "";
  const safeZoom = Number.isFinite(parsedZoom) ? Math.min(Math.max(Math.round(parsedZoom), 1), 20) : 15;
  return `https://www.google.com/maps?q=${parsedLat},${parsedLng}&z=${safeZoom}&output=embed`;
}

function buildGoogleUrl(lat, lng) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return "";
  return `https://www.google.com/maps?q=${parsedLat},${parsedLng}`;
}

function parseCoordinates(rawValue) {
  const value = decodeURIComponent((rawValue || "").trim());
  if (!value) return null;

  const atMatch = value.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return { lat: atMatch[1], lng: atMatch[2] };
  }

  const qMatch = value.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (qMatch) {
    return { lat: qMatch[1], lng: qMatch[2] };
  }

  const plainMatch = value.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (plainMatch) {
    return { lat: plainMatch[1], lng: plainMatch[2] };
  }

  return null;
}

function detectDataUrlMimeType(value) {
  const match = String(value || "").match(/^data:([^;]+);base64,/i);
  return match?.[1]?.toLowerCase() || "";
}

function formatBytes(size) {
  const numericSize = Number(size);
  if (!Number.isFinite(numericSize) || numericSize <= 0) return "";
  if (numericSize >= 1024 * 1024) {
    return `${(numericSize / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(numericSize / 1024))} KB`;
}

export default function InformacionEmpresa() {
  const [info, setInfo] = useState(EMPTY_COMPANY_INFO);
  const [draft, setDraft] = useState(EMPTY_COMPANY_INFO);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const mapPreviewUrl = buildEmbedUrl(draft.mapLat, draft.mapLng, draft.mapZoom);
  const policyDocumentType = (draft.politicasDocumentoTipo || detectDataUrlMimeType(draft.politicasDocumento)).toLowerCase();
  const canPreviewPolicyPdf = Boolean(draft.politicasDocumento) && policyDocumentType === "application/pdf";

  const loadCompanyInfo = async () => {
    setLoading(true);
    try {
      const data = await requestJson(endpoints.adminCompanyInfo, {
        token: getAdminToken(),
      });
      const nextInfo = { ...EMPTY_COMPANY_INFO, ...(data.companyInfo || {}) };
      setInfo(nextInfo);
      setDraft(nextInfo);
    } catch (error) {
      window.alert(error.message || "No fue posible cargar informacion de la empresa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const openEdit = () => {
    setDraft(info);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(info);
    setIsEditing(false);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setDraft((prev) => ({ ...prev, [name]: value }));
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      window.alert("Tu navegador no soporta geolocalizacion.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = String(position.coords.latitude);
        const lng = String(position.coords.longitude);
        setDraft((prev) => ({
          ...prev,
          mapLat: lat,
          mapLng: lng,
          mapGoogleUrl: buildGoogleUrl(lat, lng),
        }));
      },
      () => {
        window.alert("No fue posible obtener tu ubicacion actual.");
      }
    );
  };

  const handleParseMapUrl = () => {
    const parsed = parseCoordinates(draft.mapGoogleUrl);
    if (!parsed) {
      window.alert("No se encontraron coordenadas en la URL de Google Maps.");
      return;
    }

    setDraft((prev) => ({
      ...prev,
      mapLat: parsed.lat,
      mapLng: parsed.lng,
    }));
  };

  const handlePolicyDocumentChange = (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    const fileName = String(file.name || "").toLowerCase();
    const matchesAllowedType = ALLOWED_POLICY_DOCUMENT_TYPES.includes(file.type);
    const matchesAllowedExtension = ALLOWED_POLICY_DOCUMENT_EXTENSIONS.some((ext) => fileName.endsWith(ext));

    if (!matchesAllowedType && !matchesAllowedExtension) {
      window.alert("Selecciona un documento valido (PDF, DOC, DOCX o TXT).");
      input.value = "";
      return;
    }

    if (file.size > MAX_POLICY_DOCUMENT_BYTES) {
      window.alert("El documento excede el limite de 5 MB.");
      input.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setDraft((prev) => ({
        ...prev,
        politicasDocumento: reader.result?.toString() || "",
        politicasDocumentoNombre: file.name || "",
        politicasDocumentoTipo: file.type || "",
      }));
      input.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleClearPolicyDocument = () => {
    setDraft((prev) => ({
      ...prev,
      politicasDocumento: "",
      politicasDocumentoNombre: "",
      politicasDocumentoTipo: "",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await requestJson(endpoints.adminCompanyInfo, {
        method: "PUT",
        token: getAdminToken(),
        body: draft,
      });
      const saved = { ...EMPTY_COMPANY_INFO, ...(data.companyInfo || {}) };
      setInfo(saved);
      setDraft(saved);
      setIsEditing(false);
      window.alert("Informacion actualizada correctamente");
    } catch (error) {
      window.alert(error.message || "No fue posible actualizar informacion de la empresa.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Cargando informacion de empresa..." fullScreen={false} className="py-20" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Informacion de la Empresa</h1>
          <p className="text-slate-500 text-sm">Gestiona la informacion publica de la estetica.</p>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white text-orange-500 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 transition-colors shadow-sm"
            aria-label="Editar informacion"
          >
            <SidebarIcon name="edit" className="h-5 w-5" />
            <span className="sr-only">Editar Informacion</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Nombre de la Empresa</label>
              <input
                name="nombre"
                value={draft.nombre}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="form-input disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="form-label">Direccion</label>
              <input
                name="direccion"
                value={draft.direccion}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="form-input disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="form-label">Telefono</label>
              <input
                name="telefono"
                value={draft.telefono}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="form-input disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="form-label">Correo Electronico</label>
              <input
                name="email"
                value={draft.email}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="form-input disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-bold text-slate-800">Quienes Somos</h3>
            <div>
              <label className="form-label">Descripcion principal</label>
              <textarea
                name="quienesSomosTexto"
                value={draft.quienesSomosTexto}
                onChange={handleInputChange}
                disabled={!isEditing}
                rows="3"
                className="form-input disabled:bg-slate-50 resize-none"
              />
            </div>
            <div>
              <label className="form-label">Nuestra esencia</label>
              <textarea
                name="quienesSomosEsencia"
                value={draft.quienesSomosEsencia}
                onChange={handleInputChange}
                disabled={!isEditing}
                rows="4"
                className="form-input disabled:bg-slate-50 resize-none"
                placeholder={"Una linea por punto\nAtencion personalizada\nEstilistas certificados"}
              />
              <p className="text-xs text-slate-400 mt-1">Escribe un punto por linea.</p>
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-bold text-slate-800">Identidad Corporativa</h3>
            <div>
              <label className="form-label">Mision</label>
              <textarea
                name="mision"
                value={draft.mision}
                onChange={handleInputChange}
                disabled={!isEditing}
                rows="3"
                className="form-input disabled:bg-slate-50 resize-none"
              />
            </div>
            <div>
              <label className="form-label">Vision</label>
              <textarea
                name="vision"
                value={draft.vision}
                onChange={handleInputChange}
                disabled={!isEditing}
                rows="3"
                className="form-input disabled:bg-slate-50 resize-none"
              />
            </div>
            <div>
              <label className="form-label">Valores</label>
              <textarea
                name="valores"
                value={draft.valores}
                onChange={handleInputChange}
                disabled={!isEditing}
                rows="3"
                className="form-input disabled:bg-slate-50 resize-none"
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-bold text-slate-800">Redes Sociales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="form-label">Facebook</label>
                <input
                  name="facebook"
                  value={draft.facebook}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="form-input disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="form-label">Instagram</label>
                <input
                  name="instagram"
                  value={draft.instagram}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="form-input disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-bold text-slate-800">Politicas de la Empresa</h3>
            <p className="text-sm text-slate-500">
              Carga un documento para mostrarlo en la seccion publica de politica de privacidad.
            </p>

            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 flex flex-wrap items-center gap-3">
              {isEditing && (
                <>
                  <label
                    htmlFor="politicas-documento-input"
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold cursor-pointer hover:bg-violet-200 transition-colors"
                  >
                    Elegir documento
                  </label>
                  <input
                    id="politicas-documento-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={handlePolicyDocumentChange}
                    className="sr-only"
                  />
                </>
              )}

              <span className="text-sm text-slate-600 break-all">
                {draft.politicasDocumentoNombre || (draft.politicasDocumento ? "Documento cargado" : "Ningun documento seleccionado")}
              </span>

              {isEditing && draft.politicasDocumento && (
                <button
                  type="button"
                  onClick={handleClearPolicyDocument}
                  className="ml-auto text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Quitar
                </button>
              )}
            </div>

            {draft.politicasDocumento && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={draft.politicasDocumento}
                    download={draft.politicasDocumentoNombre || "politicas-empresa"}
                    className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200"
                  >
                    Descargar documento
                  </a>
                  <span className="text-xs text-slate-500">
                    {draft.politicasDocumentoTipo || policyDocumentType || "Tipo no detectado"}
                  </span>
                </div>

                {canPreviewPolicyPdf ? (
                  <iframe
                    title="Vista previa del documento de politicas"
                    src={draft.politicasDocumento}
                    className="w-full h-80 border border-slate-200 rounded-xl bg-white"
                  />
                ) : (
                  <p className="text-xs text-slate-500">
                    Vista previa disponible unicamente para PDF.
                  </p>
                )}
              </div>
            )}

            {isEditing && (
              <p className="text-xs text-slate-400">
                Formatos permitidos: PDF, DOC, DOCX, TXT. Tamano maximo: {formatBytes(MAX_POLICY_DOCUMENT_BYTES)}.
              </p>
            )}
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-bold text-slate-800">Horarios</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="form-label">Horario Lunes a Viernes</label>
                <input
                  name="horarioLunesSabado"
                  value={draft.horarioLunesSabado || ""}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="form-input disabled:bg-slate-50"
                  placeholder="Ej. Lunes a Sabado: 9:00 am - 7:00 pm"
                />
              </div>
              <div>
                <label className="form-label">Horario Sabado</label>
                <input
                  name="horarioDomingo"
                  value={draft.horarioDomingo || ""}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="form-input disabled:bg-slate-50"
                  placeholder="Ej. Domingo: 10:00 am - 3:00 pm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-bold text-slate-800">Ubicacion (Google Maps)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="form-label">Latitud</label>
                <input
                  name="mapLat"
                  value={draft.mapLat || ""}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="form-input disabled:bg-slate-50"
                  placeholder="Ej. 19.4326"
                />
              </div>
              <div>
                <label className="form-label">Longitud</label>
                <input
                  name="mapLng"
                  value={draft.mapLng || ""}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="form-input disabled:bg-slate-50"
                  placeholder="Ej. -99.1332"
                />
              </div>
              <div>
                <label className="form-label">Zoom</label>
                <input
                  name="mapZoom"
                  type="number"
                  min="1"
                  max="20"
                  value={draft.mapZoom || ""}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="form-input disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="form-label">URL de Google Maps</label>
              <input
                name="mapGoogleUrl"
                value={draft.mapGoogleUrl || ""}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="form-input disabled:bg-slate-50"
                placeholder="Pega aqui la URL de Google Maps"
              />
            </div>

            {isEditing && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleParseMapUrl}
                  className="px-4 py-2 text-sm font-medium text-violet-700 bg-violet-50 rounded-xl hover:bg-violet-100"
                >
                  Tomar coordenadas desde URL
                </button>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="px-4 py-2 text-sm font-medium text-violet-700 bg-violet-50 rounded-xl hover:bg-violet-100"
                >
                  Usar mi ubicacion actual
                </button>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              {mapPreviewUrl ? (
                <iframe
                  title="Mapa de la empresa"
                  src={mapPreviewUrl}
                  className="w-full h-72 border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
                  Configura latitud y longitud para ver el mapa.
                </div>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
