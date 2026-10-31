"use strict";

const email = document.getElementById("email");
const code = document.getElementById("code");
const confirmation = document.getElementById("confirmation");
const status = document.getElementById("status");
const requestForm = document.getElementById("request-form");
const confirmForm = document.getElementById("confirm-form");
let busy = false;
let confirmed = false;

email.addEventListener("input", () => { code.value = ""; confirmation.checked = false; status.textContent = ""; });

async function submit(path, body) {
  if (busy || confirmed) return;
  busy = true;
  const controls = [...document.querySelectorAll("input,button")];
  controls.forEach((control) => { control.disabled = true; });
  status.className = "";
  status.textContent = "Procesando…";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`/api/public/account-deletion/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body), signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || "No se pudo procesar la solicitud. Inténtalo nuevamente.");
    if (typeof result?.message !== "string" || !result.message.trim() || (path === "confirm" && result.accepted !== true)) {
      throw new Error("El servidor no confirmó la solicitud. Inténtalo nuevamente.");
    }
    status.textContent = result.message;
    code.value = "";
    confirmation.checked = false;
    if (path === "confirm") {
      confirmed = true;
      requestForm.closest("section").hidden = true;
      confirmForm.closest("section").hidden = true;
      document.querySelector("h1").textContent = "Eliminación confirmada";
    }
  } catch (error) {
    status.className = "error";
    status.textContent = error.name === "AbortError"
      ? "El servidor tardó demasiado. Inténtalo nuevamente."
      : error instanceof TypeError ? "No se pudo conectar. Revisa tu conexión e inténtalo nuevamente." : error.message;
  } finally {
    clearTimeout(timer);
    busy = false;
    controls.forEach((control) => { control.disabled = confirmed; });
  }
}

requestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submit("request", { correo: email.value.trim().toLowerCase() });
});
confirmForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requestForm.reportValidity() || !confirmForm.reportValidity()) return;
  void submit("confirm", { correo: email.value.trim().toLowerCase(), codigo: code.value.trim(), confirmacion: "ELIMINAR" });
});
