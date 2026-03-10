import React, { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import Button from "../../components/ui/Button";
import SidebarIcon from "../../components/ui/SidebarIcon";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

const INTERVALO_ACTUALIZACION_MS = 5000;

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
  });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function supportsDirectoryPicker() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function buildBackupFileName(tipo, fechaIso) {
  const stamp = new Date(fechaIso || Date.now()).toISOString().replace(/[:.]/g, "-");
  const typeKey = tipo === "completo" ? "completo" : "colecciones";
  return `respaldo-${typeKey}-${stamp}.zip`;
}

function ensureZipFileName(fileName) {
  const normalized = String(fileName || "").trim();
  if (!normalized) return "respaldo.zip";
  if (/\.zip$/i.test(normalized)) return normalized;
  return normalized.replace(/\.json$/i, "") + ".zip";
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
  const [rutaDestino, setRutaDestino] = useState("");
  const [carpetaHandle, setCarpetaHandle] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState("");
  const [seleccionInicializada, setSeleccionInicializada] = useState(false);

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

  const cargarDatos = useCallback(async ({ silencioso = false } = {}) => {
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

      setColecciones(coleccionesServer);
      setHistorial(historialServer);

      setSeleccionadas((prev) => {
        const disponibles = coleccionesServer.map((item) => item.nombre);
        const seleccionFiltrada = prev.filter((nombre) => disponibles.includes(nombre));
        if (!seleccionInicializada) {
          if (seleccionFiltrada.length > 0) return seleccionFiltrada;
          return disponibles;
        }
        return seleccionFiltrada;
      });
      if (!seleccionInicializada) {
        setSeleccionInicializada(true);
      }
      setUltimaActualizacion(new Date().toISOString());
    } catch (requestError) {
      if (!silencioso) {
        setError(requestError.message || "No fue posible cargar la informacion de respaldos.");
      }
    } finally {
      if (!silencioso) {
        setCargandoVista(false);
      }
    }
  }, [seleccionInicializada]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    const refrescarSilencioso = () => {
      if (document.visibilityState === "visible" && !generandoCompleto && !generandoColecciones) {
        cargarDatos({ silencioso: true });
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
  }, [cargarDatos, generandoCompleto, generandoColecciones]);

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

  const ejecutarRespaldo = async (tipo) => {
    if (tipo === "colecciones" && seleccionadas.length === 0) {
      setError("Debes seleccionar al menos una coleccion.");
      return;
    }

    setError("");
    setMensaje("");
    if (tipo === "completo") setGenerandoCompleto(true);
    if (tipo === "colecciones") setGenerandoColecciones(true);

    try {
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
      const tamanoZipBytes = Number(archivoZip.size || 0);
      const nombreArchivo = buildBackupFileName(tipo, resumen.fecha);
      await guardarRespaldoLocal(nombreArchivo, archivoZip);

      setHistorial((prev) => [
        { ...resumen, tamanoZipBytes },
        ...prev.filter((item) => item.id !== resumen.id),
      ]);
    } catch (requestError) {
      setError(requestError.message || "No fue posible generar el respaldo.");
    } finally {
      if (tipo === "completo") setGenerandoCompleto(false);
      if (tipo === "colecciones") setGenerandoColecciones(false);
    }
  };

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
          onClick={() => cargarDatos()}
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {mensaje}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Ultimo respaldo</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {ultimoRespaldo ? formatDateTime(ultimoRespaldo.fecha) : "Sin respaldos"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Tamano total de datos</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">{formatBytes(totalEstimadoBytes)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Sin comprimir</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Colecciones seleccionadas</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">{seleccionadas.length}</p>
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <SidebarIcon name="backup" className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-bold text-slate-800">Respaldo Completo</h2>
          </div>
          <p className="text-sm text-slate-600">
            Genera un archivo con todas las colecciones disponibles.
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Tamano de datos (sin comprimir):{" "}
            <span className="font-bold text-slate-700">{formatBytes(totalEstimadoBytes)}</span>
          </div>
          <div className="mt-5">
            <Button
              type="button"
              onClick={() => ejecutarRespaldo("completo")}
              disabled={generandoCompleto || colecciones.length === 0}
              className="w-full py-3"
              variant="indigo"
            >
              {generandoCompleto ? "Generando respaldo completo..." : "Crear respaldo completo"}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <SidebarIcon name="reports" className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-bold text-slate-800">Respaldo por Colecciones</h2>
          </div>
          <p className="text-sm text-slate-600">
            Selecciona solo las colecciones que quieres respaldar.
          </p>

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
            Tamano de datos seleccionado (sin comprimir):{" "}
            <span className="font-bold text-slate-700">{formatBytes(totalSeleccionadoBytes)}</span>
          </div>

          <div className="mt-5">
            <Button
              type="button"
              onClick={() => ejecutarRespaldo("colecciones")}
              disabled={generandoColecciones || seleccionadas.length === 0}
              className="w-full py-3"
              variant="outline"
            >
              {generandoColecciones ? "Generando respaldo por colecciones..." : "Crear respaldo por colecciones"}
            </Button>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-lg font-bold text-slate-800">Historial de Respaldos</h2>
          <p className="text-xs text-slate-500">Registros generados desde el servidor en esta sesion.</p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historial.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">{formatDate(entry.fecha)}</td>
                  <td className="px-6 py-4">{formatTime(entry.fecha)}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{entry.tipo}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {(entry.colecciones || [])
                      .map((nombre) => mapaEtiquetas[nombre] || nombre)
                      .join(", ")}
                  </td>
                  <td className="px-6 py-4">{Number(entry.totalDocumentos || 0)}</td>
                  <td className="px-6 py-4">
                    {formatBytes(entry.tamanoZipBytes ?? entry.tamanoBytes ?? 0)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600">
                      {entry.estado || "Completado"}
                    </span>
                  </td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                    Todavia no hay respaldos generados en esta sesion.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
