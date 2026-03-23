export function formatProductPresentation(product) {
  const cantidadMedida = Number(product?.cantidadMedida);
  const unidadMedida = String(product?.unidadMedida || "").trim().toLowerCase();

  if (!Number.isFinite(cantidadMedida) || cantidadMedida <= 0 || !unidadMedida) {
    return "";
  }

  return `${cantidadMedida} ${unidadMedida}`;
}
