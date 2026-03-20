import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import Button from "../../components/ui/Button";
import SidebarIcon from "../../components/ui/SidebarIcon";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

const INTERVALO_ACTUALIZACION_MS = 5000;
const AUTO_BACKUP_DOWNLOAD_KEY = "admin_last_auto_backup_download_id";

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function ensureZipFileName(fileName) {
  const normalized = String(fileName || "").trim();
  if (!normalized) return "respaldo.zip";
  if (/\.zip$/i.test(normalized)) return normalized;
  return normalized.replace(/\.json$/i, "") + ".zip";
}

function supportsDirectoryPicker() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function buildBackupFileName(tipo, fechaIso) {
  const stamp = new Date(fechaIso || Date.now()).toISOString().replace(/[:.]/g, "-");
  const typeKey = tipo === "completo" ? "completo" : "colecciones";
  return "respaldo-" + typeKey + "-" + stamp + ".zip";
}

function downloadBinaryFile(filename, blob) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function sanitizeDownloadFileName(fileName) {
  const normalized = String(fileName || "").trim();
  if (!normalized) return `respaldo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  if (/\.(json|zip)$/i.test(normalized)) return normalized;
  return `${normalized}.json`;
}

function parseContentDispositionFilename(contentDisposition, fallback) {
  if (!contentDisposition) return fallback;
  const match =
    /filename\*=UTF-8''([^;\n]+)|filename="([^"]+)"|filename=([^;\n]+)/i.exec(contentDisposition);
  if (!match) return fallback;
  return decodeURIComponent((match[1] || match[2] || match[3] || "").trim().replace(/(^")|("$)/g, ""));
}

function isZipFileName(fileName) {
  return /\.zip$/i.test(String(fileName || "").trim());
}

async function convertirRespaldoABlobZip(blob) {
  const texto = await blob.text();
  const zip = new JSZip();
  zip.file("respaldo.json", texto);
  const zipBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  return new Blob([zipBytes], { type: "application/zip" });
}

function normalizeSchedule(raw = {}) {
  return {
    active: raw.active === true,
    mode: "time",
    tipo: raw.tipo === "colecciones" ? "colecciones" : "completo",
    time: typeof raw.time === "string" ? raw.time.trim() : "",
    colecciones: Array.isArray(raw.colecciones)
      ? Array.from(new Set(raw.colecciones.map((nombre) => String(nombre || "").trim()).filter(Boolean)))
      : [],
    nextRunAt: raw.nextRunAt || "",
    lastRunAt: raw.lastRunAt || "",
    lastError: raw.lastError || "",
  };
}

function sanitizeCollections(raw, disponiblesSet) {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(raw.map((nombre) => String(nombre || "").trim()).filter(Boolean))
  ).filter((nombre) => disponiblesSet.has(nombre));
}

function parseTimeForValidation(value) {
  return /^([01]?\d|2[0-3]):([0-5]?\d)(:[0-5]?\d)?$/.test(String(value || "").trim());
}

async function crearZipRespaldo(respaldo) {
  const zip = new JSZip();
  zip.file("respaldo.json", JSON.stringify(respaldo, null, 2));
  const zipBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  return new Blob([zipBytes], { type: "application/zip" });
}

export default function GestionRespaldos() {
  const [colecciones, setColecciones] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargandoVista, setCargandoVista] = useState(true);
  const [generandoCompleto, setGenerandoCompleto] = useState(false);
  const [generandoColecciones, setGenerandoColecciones] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [mensajeProgramacion, setMensajeProgramacion] = useState("");
  const [errorProgramacion, setErrorProgramacion] = useState("");
  const [guardandoProgramacion, setGuardandoProgramacion] = useState(false);
  const [rutaDestino, setRutaDestino] = useState("");
  const [carpetaHandle, setCarpetaHandle] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState("");
  const [seleccionInicializada, setSeleccionInicializada] = useState(false);
  const autoBackupDownloadRef = useRef(localStorage.getItem(AUTO_BACKUP_DOWNLOAD_KEY) || "");
  const autoDownloadingRef = useRef(false);
  const dispararDescargaAutomaticaRef = useRef(null);
  const descargarRespaldoHistoricoRef = useRef(null);
  const [programacion, setProgramacion] = useState(
    normalizeSchedule({
      active: false,
      mode: "time",
      tipo: "completo",
      time: "",
      colecciones: [],
    })
  );

  const mapaEtiquetas = useMemo(
    () => Object.fromEntries(colecciones.map((item) => [item.nombre, item.etiqueta])),
    [colecciones]
  );

  const totalEstimadoBytes = useMemo(
    () => colecciones.reduce((sum, item) => sum + Number(item.tamanoBytes || 0), 0),
    [colecciones]
  );

  const totalSeleccionadoBytes = useMemo(
    () =>
      colecciones
        .filter((item) => seleccionadas.includes(item.nombre))
        .reduce((sum, item) => sum + Number(item.tamanoBytes || 0), 0),
    [colecciones, seleccionadas]
  );

  const ultimoRespaldo = historial[0] || null;
  const respaldoActivo = generandoCompleto || generandoColecciones;
  const disponiblesSet = useMemo(() => new Set(colecciones.map((item) => item.nombre)), [colecciones]);

  const cargarTodo = useCallback(async () => {
    setCargandoVista(true);
    setError("");
    try {
      const token = getAdminToken();
      const [dataColecciones, dataHistorial, dataProgramacion] = await Promise.all([
        requestJson(endpoints.adminBackupCollections, { token }),
        requestJson(endpoints.adminBackupHistory, { token }),
        requestJson(endpoints.adminBackupSchedule, { token }),
      ]);
      const coleccionesServer = Array.isArray(dataColecciones.colecciones)
        ? dataColecciones.colecciones
        : [];
      const historialServer = Array.isArray(dataHistorial.historial)
        ? dataHistorial.historial
        : [];
      setColecciones(coleccionesServer);
      setHistorial(historialServer);

      const schedule = normalizeSchedule(dataProgramacion?.programacion || {});
      setProgramacion((prev) => ({
        ...prev,
        ...schedule,
      }));
      const disponibles = coleccionesServer.map((item) => item.nombre);
      const disponiblesSetLocal = new Set(disponibles);
      const fromProgramacion = sanitizeCollections(schedule.colecciones, disponiblesSetLocal);

      setSeleccionadas((prev) => {
        if (seleccionInicializada) {
          return prev.filter((nombre) => disponiblesSetLocal.has(nombre));
        }

        if (schedule.tipo === "colecciones" && fromProgramacion.length > 0) {
          return fromProgramacion;
        }
        return disponibles;
      });
      setSeleccionInicializada(true);
      setUltimaActualizacion(new Date().toISOString());
      const dispararDescarga = dispararDescargaAutomaticaRef.current;
      if (typeof dispararDescarga === "function") {
        void dispararDescarga(historialServer);
      }
    } catch (requestError) {
      setError(requestError.message || "No fue posible cargar la informacion de respaldos.");
      setMensajeProgramacion("");
      setErrorProgramacion("");
    } finally {
      setCargandoVista(false);
    }
  }, [seleccionInicializada]);

  const dispararDescargaAutomatica = useCallback(async (historialServer) => {
    if (autoDownloadingRef.current) return;
    if (!Array.isArray(historialServer) || historialServer.length === 0) return;
    if (respaldoActivo) return;

    const respaldoAutomatico = historialServer.find(
      (entry) =>
        String(entry?.updatedBy || "").trim().toLowerCase() === "sistema" &&
        entry?.id
    );

    if (!respaldoAutomatico) return;
    if (autoBackupDownloadRef.current === respaldoAutomatico.id) return;

    autoDownloadingRef.current = true;
    try {
      const descargar = descargarRespaldoHistoricoRef.current;
      const descargado = await (typeof descargar === "function"
        ? descargar(respaldoAutomatico, {
            silencioso: true,
            auto: true,
          })
        : Promise.resolve(false));
      if (descargado && respaldoAutomatico.id) {
        autoBackupDownloadRef.current = respaldoAutomatico.id;
        try {
          localStorage.setItem(AUTO_BACKUP_DOWNLOAD_KEY, respaldoAutomatico.id);
        } catch (_error) {
          // Persistencia local opcional.
        }
      }
    } finally {
      autoDownloadingRef.current = false;
    }
  }, [respaldoActivo]);

  dispararDescargaAutomaticaRef.current = dispararDescargaAutomatica;

  const cargarColeccionesYHistorial = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) {
      setCargandoVista(true);
      setError("");
    }
    try {
      const token = getAdminToken();
      const [dataColecciones, dataHistorial] = await Promise.all([
        requestJson(endpoints.adminBackupCollections, { token }),
        requestJson(endpoints.adminBackupHistory, { token }),
      ]);
      const coleccionesServer = Array.isArray(dataColecciones.colecciones)
        ? dataColecciones.colecciones
        : [];
      const historialServer = Array.isArray(dataHistorial.historial)
        ? dataHistorial.historial
        : [];

      const disponibles = coleccionesServer.map((item) => item.nombre);
      const disponiblesSetLocal = new Set(disponibles);
      setColecciones(coleccionesServer);
      setHistorial(historialServer);
      setSeleccionadas((prev) => prev.filter((nombre) => disponiblesSetLocal.has(nombre)));
      setUltimaActualizacion(new Date().toISOString());
      if (!respaldoActivo) {
        void dispararDescargaAutomatica(historialServer);
      }
    } catch (requestError) {
      if (!silencioso) {
        setError(requestError.message || "No fue posible cargar la informacion de respaldos.");
      }
    } finally {
      if (!silencioso) setCargandoVista(false);
    }
  }, [respaldoActivo, dispararDescargaAutomatica]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  useEffect(() => {
    const refrescarSilencioso = () => {
      if (!respaldoActivo) {
        void cargarColeccionesYHistorial({ silencioso: true });
      }
    };

    const intervalo = window.setInterval(refrescarSilencioso, INTERVALO_ACTUALIZACION_MS);
    const onFocus = () => refrescarSilencioso();
    const onVisible = () => refrescarSilencioso();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cargarColeccionesYHistorial, respaldoActivo]);

  const seleccionarCarpeta = async () => {
    if (!supportsDirectoryPicker()) {
      setMensaje(
        "Tu navegador no permite seleccionar carpeta directamente. El respaldo se descargara."
      );
      return;
    }

    try {
      const handle = await window.showDirectoryPicker();
      setCarpetaHandle(handle);
      setRutaDestino(handle.name || "");
      setMensaje(
        `Carpeta seleccionada: ${handle.name}. El navegador no expone la ruta completa por seguridad.`
      );
    } catch (pickerError) {
      if (pickerError?.name !== "AbortError") {
        setError("No fue posible seleccionar carpeta.");
      }
    }
  };

  const guardarRespaldoLocal = async (fileName, fileBlob) => {
    const nombreArchivoZip = ensureZipFileName(fileName);
    try {
      if (carpetaHandle && typeof carpetaHandle.getFileHandle === "function") {
        const fileHandle = await carpetaHandle.getFileHandle(nombreArchivoZip, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(fileBlob);
        await writable.close();
        setMensaje(`Respaldo ZIP guardado en ${rutaDestino || "carpeta seleccionada"}: ${nombreArchivoZip}`);
        return;
      }
    } catch (_error) {
      // Si falla escritura en carpeta elegida, cae a descarga normal.
    }

    downloadBinaryFile(nombreArchivoZip, fileBlob);
    setMensaje(`Respaldo ZIP descargado: ${nombreArchivoZip}`);
  };

  const descargarRespaldoHistorico = async (entry, { silencioso = false, auto = false } = {}) => {
    const backupId = entry?.id || "";
    if (!backupId) {
      if (!silencioso) {
        setError("No fue posible identificar el respaldo seleccionado.");
      }
      return false;
    }

    try {
      const token = getAdminToken();
      const response = await fetch(endpoints.adminBackupDownload(backupId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = Array.isArray(data.errors) && data.errors.length
          ? data.errors[0]
          : "No fue posible descargar el respaldo.";
        throw new Error(message);
      }

      const respaldoBlob = await response.blob();
      const safeName = sanitizeDownloadFileName(
        parseContentDispositionFilename(
          response.headers.get("content-disposition"),
          entry?.downloadFileName || `respaldo-${entry.tipo || "respaldo"}-${entry.fecha || new Date().toISOString()}.json`
        )
      );
      const isZipResponse = isZipFileName(safeName) || (response.headers.get("content-type") || "").includes("zip");
      const finalFileName = isZipResponse
        ? safeName
        : `${safeName.replace(/\.json$/i, "")}.zip`;
      const archivoBlob = isZipResponse ? respaldoBlob : await convertirRespaldoABlobZip(respaldoBlob);

      if (auto) {
        await guardarRespaldoLocal(finalFileName, archivoBlob);
      } else {
        downloadBinaryFile(finalFileName, archivoBlob);
      }
      if (!silencioso) {
        setMensaje(`Respaldo descargado: ${finalFileName}`);
      }
      return true;
    } catch (downloadError) {
      if (!silencioso) {
        setError(downloadError.message || "No fue posible descargar el respaldo.");
      }
      return false;
    }
  };

  descargarRespaldoHistoricoRef.current = descargarRespaldoHistorico;

  const toggleCollection = (nombreColeccion) => {
    setSeleccionadas((prev) => {
      if (prev.includes(nombreColeccion)) return prev.filter((item) => item !== nombreColeccion);
      return [...prev, nombreColeccion];
    });
  };

  const seleccionarTodo = () => {
    setSeleccionadas(colecciones.map((item) => item.nombre));
  };

  const limpiarSeleccion = () => {
    setSeleccionadas([]);
  };

  const ejecutarRespaldo = async (tipo, { silencioso = false } = {}) => {
    if (tipo === "colecciones" && seleccionadas.length === 0) {
      if (!silencioso) {
        setError("Debes seleccionar al menos una coleccion.");
      }
      return false;
    }
    if (tipo !== "completo" && tipo !== "colecciones") {
      if (!silencioso) {
        setError("Tipo de respaldo invalido.");
      }
      return false;
    }

    if (!silencioso) {
      setError("");
      setMensaje("");
    }

    const setLoading = (value) => {
      if (tipo === "completo") {
        setGenerandoCompleto(value);
      } else {
        setGenerandoColecciones(value);
      }
    };
    try {
      if (respaldoActivo) {
        return false;
      }
      setLoading(true);

      const token = getAdminToken();
      const data = await requestJson(endpoints.adminBackupCreate, {
        method: "POST",
        token,
        body: {
          tipo,
          colecciones: tipo === "colecciones" ? seleccionadas : [],
        },
      });

      const resumen = data.resumen || null;
      const respaldo = data.respaldo || null;
      if (!resumen || !respaldo) {
        throw new Error("Respuesta invalida del servidor al generar respaldo.");
      }

      const archivoZip = await crearZipRespaldo(respaldo);
      const nombreArchivo = buildBackupFileName(tipo, resumen.fecha);
      await guardarRespaldoLocal(nombreArchivo, archivoZip);

      const resumenActualizado = { ...resumen, tamanoZipBytes: Number(archivoZip.size || 0) };
      setHistorial((prev) => [
        resumenActualizado,
        ...prev.filter((item) => item.id !== resumen.id),
      ]);
      await cargarColeccionesYHistorial({ silencioso: true });
      return true;
    } catch (requestError) {
      if (!silencioso) {
        setError(requestError.message || "No fue posible generar el respaldo.");
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const setProgramacionTipo = (tipo) => {
    setProgramacion((prev) => ({
      ...prev,
      tipo: tipo === "colecciones" ? "colecciones" : "completo",
    }));
  };

  const setProgramacionActivo = (value) => {
    setProgramacion((prev) => ({ ...prev, active: Boolean(value) }));
  };

  const setProgramacionHora = (value) => {
    setProgramacion((prev) => ({ ...prev, time: String(value || "").trim() }));
  };

  const guardarProgramacion = async () => {
    setGuardandoProgramacion(true);
    setMensajeProgramacion("");
    setErrorProgramacion("");

    if (!parseTimeForValidation(programacion.time)) {
      setErrorProgramacion("La hora debe tener el formato HH:MM o HH:MM:SS.");
      setGuardandoProgramacion(false);
      return;
    }

    if (programacion.tipo === "colecciones" && seleccionadas.length === 0) {
      setErrorProgramacion("Selecciona al menos una coleccion para programacion por colecciones.");
      setGuardandoProgramacion(false);
      return;
    }

    try {
      const token = getAdminToken();
      const data = await requestJson(endpoints.adminBackupSchedule, {
        method: "PUT",
        token,
        body: {
          active: programacion.active,
          mode: "time",
          tipo: programacion.tipo,
          time: programacion.time || "",
          colecciones: programacion.tipo === "colecciones" ? seleccionadas : [],
        },
      });
      setProgramacion((prev) => ({
        ...prev,
        ...normalizeSchedule(data?.programacion || {}),
      }));
      setMensajeProgramacion(
        `Programacion ${data?.programacion?.active ? "activada" : "guardada"} correctamente en servidor.`
      );
      await cargarColeccionesYHistorial({ silencioso: true });
    } catch (requestError) {
      setErrorProgramacion(requestError.message || "No fue posible guardar la programacion.");
    } finally {
      setGuardandoProgramacion(false);
    }
  };

  const respaldoProgramacionColeccionesResumen = useMemo(() => {
    const list = programacion.colecciones
      .filter((nombre) => disponiblesSet.has(nombre))
      .map((nombre) => mapaEtiquetas[nombre] || nombre);
    if (list.length === 0) {
      return "Sin colecciones seleccionadas";
    }
    return list.join(", ");
  }, [mapaEtiquetas, programacion.colecciones, disponiblesSet]);

  if (cargandoVista) {
    return <LoadingSpinner fullScreen={false} text="Cargando modulo de respaldos..." className="py-14" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Respaldos de Base de Datos</h1>
          <p className="text-slate-500 text-sm">
            Genera respaldos completos o por colecciones directamente desde el servidor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => cargarTodo()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <SidebarIcon name="reports" className="h-4 w-4" />
          Actualizar datos
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Actualizacion automatica cada 5 segundos.
        {ultimaActualizacion ? ` Ultima sincronizacion: ${formatDateTime(ultimaActualizacion)}.` : ""}
      </p>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {mensaje && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensaje}</div>
      )}

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <SidebarIcon name="backup" className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-bold text-slate-800">Respaldo Automatico en Servidor</h2>
        </div>
        <p className="text-sm text-slate-600">
          Define la hora diaria de ejecucion.
          Se ejecuta en el servidor, no depende de esta pantalla.
          La descarga automatica se ejecuta mientras esta interfaz esta abierta.
        </p>
        {errorProgramacion && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorProgramacion}</div>
        )}

        {mensajeProgramacion && (
          <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">{mensajeProgramacion}</div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span>Tipo de respaldo</span>
            <select
              value={programacion.tipo}
              onChange={(event) => setProgramacionTipo(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="completo">Completo</option>
              <option value="colecciones">Por colecciones</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span>Modalidad</span>
            <input
              type="text"
              value="Hora diaria"
              readOnly
              className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2 xl:col-span-4">
            <span>Hora (HH:MM o HH:MM:SS)</span>
            <input
              type="text"
              value={programacion.time}
              onChange={(event) => setProgramacionHora(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="20:30 o 20:30:00"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2 xl:col-span-4">
            <span>Colecciones para programacion por colecciones</span>
            <input
              readOnly
              value={
                programacion.tipo === "colecciones"
                  ? respaldoProgramacionColeccionesResumen
                  : "Solo respaldo completo"
              }
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
            />
            <span className="text-xs text-slate-500">
              Esta seccion usa las mismas selecciones de colecciones del respaldo manual.
            </span>
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={programacion.active}
            onChange={(event) => setProgramacionActivo(event.target.checked)}
          />
          <span>Programacion activa</span>
        </label>

        <div className="mt-4">
          <Button
            type="button"
            onClick={() => guardarProgramacion()}
            disabled={guardandoProgramacion}
            variant="indigo"
            className="py-2 px-4"
          >
            {guardandoProgramacion ? "Guardando..." : "Guardar programacion"}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-700">Estado:</span> {programacion.active ? "Activo" : "Inactivo"}
          </p>
          <p>
            <span className="font-semibold text-slate-700">Proxima ejecucion:</span> {programacion.nextRunAt ? formatDateTime(programacion.nextRunAt) : "Sin programar"}
          </p>
          <p>
            <span className="font-semibold text-slate-700">Ultima ejecucion:</span> {programacion.lastRunAt ? formatDateTime(programacion.lastRunAt) : "Sin ejecutar"}
          </p>
          {programacion.lastError && (
            <p className="font-semibold text-red-600">Ultimo error: {programacion.lastError}</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <SidebarIcon name="inventory" className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-bold text-slate-800">Destino del archivo</h2>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            className="form-input"
            value={rutaDestino}
            onChange={(event) => setRutaDestino(event.target.value)}
            placeholder="Carpeta no seleccionada (se descargara el archivo)"
          />
          <button
            type="button"
            onClick={seleccionarCarpeta}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Seleccionar carpeta
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          En Chrome/Edge puede escribir en la carpeta seleccionada. En otros navegadores se descarga.
          El navegador no permite leer la ruta completa de la carpeta elegida.
        </p>
      </section>

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <SidebarIcon name="backup" className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-bold text-slate-800">Respaldo Completo</h2>
        </div>
        <p className="text-sm text-slate-600">Genera un archivo con todas las colecciones disponibles.</p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Tamano de datos (sin comprimir): <span className="font-bold text-slate-700">{formatBytes(totalEstimadoBytes)}</span>
        </div>
        <div className="mt-5">
          <Button
            type="button"
            onClick={() => ejecutarRespaldo("completo")}
            disabled={respaldoActivo || colecciones.length === 0}
            className="w-full py-3"
            variant="indigo"
          >
            {generandoCompleto ? "Generando respaldo completo..." : "Crear respaldo completo"}
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <SidebarIcon name="reports" className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-bold text-slate-800">Respaldo por Colecciones</h2>
          </div>
          <p className="text-sm text-slate-600">Selecciona solo las colecciones que quieres respaldar.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={seleccionarTodo}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Seleccionar todo
            </button>
            <button
              type="button"
              onClick={limpiarSeleccion}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Limpiar seleccion
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {colecciones.map((item) => (
              <label
                key={item.nombre}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                  seleccionadas.includes(item.nombre)
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={seleccionadas.includes(item.nombre)}
                    onChange={() => toggleCollection(item.nombre)}
                  />
                  {item.etiqueta}
                </span>
                <span className="text-right text-xs font-semibold leading-tight">
                  <span className="block">{formatBytes(item.tamanoBytes)}</span>
                  <span className="block text-[10px] text-slate-500">{Number(item.cantidadDocumentos || 0)} docs</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Tamano de datos seleccionado (sin comprimir): <span className="font-bold text-slate-700">{formatBytes(totalSeleccionadoBytes)}</span>
          </div>

          <div className="mt-5">
            <Button
              type="button"
              onClick={() => ejecutarRespaldo("colecciones")}
              disabled={respaldoActivo || seleccionadas.length === 0}
              className="w-full py-3"
              variant="outline"
            >
              {generandoColecciones ? "Generando respaldo por colecciones..." : "Crear respaldo por colecciones"}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">Resumen</h2>
            <p className="text-xs text-slate-500">Ultimo respaldo: {ultimoRespaldo ? formatDateTime(ultimoRespaldo.fecha) : "Sin respaldos"}</p>
            <p className="text-xs text-slate-500">Colecciones seleccionadas: {seleccionadas.length}</p>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-lg font-bold text-slate-800">Historial de Respaldos</h2>
          <p className="text-xs text-slate-500">Registros guardados desde el servidor.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Hora</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Colecciones</th>
                <th className="px-6 py-4">Documentos</th>
                <th className="px-6 py-4">Tamano</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Descargar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historial.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">{formatDate(entry.fecha)}</td>
                  <td className="px-6 py-4">{formatTime(entry.fecha)}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{entry.tipo}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {(entry.colecciones || []).map((nombre) => mapaEtiquetas[nombre] || nombre).join(", ")}
                  </td>
                  <td className="px-6 py-4">{Number(entry.totalDocumentos || 0)}</td>
                  <td className="px-6 py-4">{formatBytes(entry.tamanoZipBytes ?? entry.tamanoBytes ?? 0)}</td>
                  <td className="px-6 py-4">
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600">
                      {entry.estado || "Completado"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {entry?.id ? (
                      <button
                        type="button"
                        onClick={() => descargarRespaldoHistorico(entry)}
                        className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                      >
                        Descargar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No disponible</span>
                    )}
                  </td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-slate-400">Todavia no hay respaldos generados en esta sesion.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


