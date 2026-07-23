import React, { useEffect, useMemo, useState } from "react";
import { endpoints, requestJson } from "../../api";
import { getClientToken } from "../../utils/clientStore";

export const MAX_TRANSFER_PROOF_BYTES = 5 * 1024 * 1024;

export function validateTransferPayment(reference, proofFile) {
  if (String(reference || "").trim().length < 4) {
    return "Escribe la referencia de la transferencia.";
  }
  if (!proofFile) {
    return "Adjunta una imagen del comprobante de transferencia.";
  }
  if (proofFile.size > MAX_TRANSFER_PROOF_BYTES) {
    return "El comprobante no puede superar 5 MB.";
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(proofFile.type)) {
    return "El comprobante debe ser una imagen JPG, PNG o WEBP.";
  }
  return "";
}

export function buildClientPaymentBody({
  tipo,
  metodo,
  detalle,
  referencia,
  comprobante,
  appointmentId = "",
}) {
  if (metodo !== "Transferencia") {
    return { tipo, metodo, detalle, appointmentId };
  }

  const formData = new FormData();
  formData.append("tipo", tipo);
  formData.append("metodo", metodo);
  formData.append("detalle", JSON.stringify(detalle));
  if (appointmentId) formData.append("appointmentId", appointmentId);
  formData.append("referencia", String(referencia || "").trim());
  formData.append("comprobante", comprobante);
  return formData;
}

function formatClabe(value) {
  return String(value || "").replace(/(\d{3})(?=\d)/g, "$1 ");
}

export default function TransferenciaFields({
  reference,
  onReferenceChange,
  proofFile,
  onProofFileChange,
}) {
  const [bankTransfer, setBankTransfer] = useState(null);
  const [configError, setConfigError] = useState("");
  const [fileError, setFileError] = useState("");

  useEffect(() => {
    let active = true;

    const loadConfig = async () => {
      setConfigError("");
      try {
        const data = await requestJson(endpoints.clientPaymentConfig, {
          token: getClientToken(),
        });
        if (active) setBankTransfer(data.bankTransfer || null);
      } catch (error) {
        if (active) {
          setConfigError(error.message || "No fue posible cargar los datos para transferencia.");
        }
      }
    };

    loadConfig();
    return () => {
      active = false;
    };
  }, []);

  const fileLabel = useMemo(() => {
    if (!proofFile) return "Ningun archivo seleccionado";
    return `${proofFile.name} (${(proofFile.size / 1024 / 1024).toFixed(2)} MB)`;
  }, [proofFile]);

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    const validationError = nextFile
      ? validateTransferPayment(reference || "0000", nextFile)
      : "";
    const nextFileError = validationError.startsWith("El comprobante") ? validationError : "";

    setFileError(nextFileError);
    onProofFileChange(nextFileError ? null : nextFile);
  };

  return (
    <section className="space-y-4 border-y border-slate-200 py-5">
      <div>
        <h3 className="text-base font-bold text-slate-800">Datos para transferencia</h3>
        {bankTransfer?.message && (
          <p className={`mt-1 text-sm ${bankTransfer.isDemo ? "font-semibold text-amber-700" : "text-slate-500"}`}>
            {bankTransfer.message}
          </p>
        )}
      </div>

      {configError && (
        <div className="border-l-4 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
          {configError}
        </div>
      )}

      {bankTransfer && (
        <dl className="grid grid-cols-1 gap-3 bg-slate-50 px-4 py-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-500">Banco</dt>
            <dd className="mt-1 font-bold text-slate-900">{bankTransfer.bank}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Beneficiario</dt>
            <dd className="mt-1 font-bold text-slate-900">{bankTransfer.beneficiary}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-semibold text-slate-500">CLABE</dt>
            <dd className="mt-1 break-all font-mono text-base font-bold text-slate-900">
              {formatClabe(bankTransfer.clabe)}
            </dd>
          </div>
          {bankTransfer.account && (
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-500">Cuenta</dt>
              <dd className="mt-1 font-mono font-bold text-slate-900">{bankTransfer.account}</dd>
            </div>
          )}
        </dl>
      )}

      <div>
        <label className="form-label" htmlFor="transfer-reference">Referencia de transferencia</label>
        <input
          id="transfer-reference"
          type="text"
          className="form-input"
          value={reference}
          onChange={(event) => onReferenceChange(event.target.value)}
          maxLength={80}
          placeholder="Ej. 458921"
          required
        />
      </div>

      <div>
        <label className="form-label" htmlFor="transfer-proof">Comprobante</label>
        <input
          id="transfer-proof"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="form-input"
          onChange={handleFileChange}
          required
        />
        <p className="mt-2 break-words text-xs text-slate-500">{fileLabel}</p>
        {fileError && <p className="mt-2 text-sm font-semibold text-red-600">{fileError}</p>}
      </div>
    </section>
  );
}
