import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { endpoints, requestJson } from "../../api";

function getAdminToken() {
  return localStorage.getItem("adminToken") || "";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistorialVentas() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    totalVentas: 0,
    totalRegistros: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadSales = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const token = getAdminToken();
        const data = await requestJson(endpoints.adminSales(), { token });
        const sales = Array.isArray(data.sales) ? data.sales : [];

        const parsedRows = sales.flatMap((sale) =>
          (Array.isArray(sale.items) ? sale.items : []).map((item, index) => ({
            id: `${sale.id}-${index}`,
            ventaId: sale.id,
            fecha: sale.createdAt,
            detalle: item.producto,
            usuario: sale.usuario || "Admin",
            cantidad: Number(item.cantidad || 0),
            monto: Number(item.subtotal || 0),
          }))
        );

        setRows(parsedRows);
        setSummary({
          totalVentas: Number(data.summary?.total || 0),
          totalRegistros: Number(data.summary?.totalRegistros || 0),
        });
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar historial de ventas.");
      } finally {
        setLoading(false);
      }
    };

    loadSales();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historial de Ventas</h1>
          <p className="text-slate-500 text-sm">Consulta las ventas registradas en el sistema.</p>
        </div>
        <Link to="/admin/ventas/nueva">
          <Button
            variant="outline"
            aria-label="Nueva Venta"
            title="Nueva Venta"
            className="h-10 px-4 text-sm text-black border-2 border-slate-300 bg-white hover:bg-slate-50"
          >
            Nueva Venta
          </Button>
        </Link>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-white text-xs sm:text-sm text-slate-600 flex flex-wrap gap-4">
          <span>Total ventas: <strong className="text-slate-800">{formatCurrency(summary.totalVentas)}</strong></span>
          <span>Registros: <strong className="text-slate-800">{summary.totalRegistros}</strong></span>
        </div>

        {loading ? (
          <LoadingSpinner fullScreen={false} text="Cargando historial..." className="py-12" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Venta</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Cantidad</th>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{sale.ventaId}</td>
                    <td className="px-6 py-4">{formatDate(sale.fecha)}</td>
                    <td className="px-6 py-4">{sale.detalle}</td>
                    <td className="px-6 py-4">{sale.cantidad}</td>
                    <td className="px-6 py-4">{sale.usuario}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(sale.monto)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                      No hay ventas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
