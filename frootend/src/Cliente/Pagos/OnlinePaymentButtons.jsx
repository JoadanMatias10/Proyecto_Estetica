import React from "react";

export default function OnlinePaymentButtons({ onSelect }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-bold text-slate-700">Pago en linea</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("Mercado Pago")}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#009EE3] px-4 font-bold text-white shadow-sm transition-colors hover:bg-[#0089c7] focus:outline-none focus:ring-4 focus:ring-sky-200"
          aria-label="Pagar con Mercado Pago"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/15">
            <img
              src="/mercadopago.svg"
              alt=""
              aria-hidden="true"
              className="h-6 w-6 brightness-0 invert"
            />
          </span>
          Pagar con Mercado Pago
        </button>

        <button
          type="button"
          onClick={() => onSelect("PayPal")}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#FFC439] px-4 font-bold text-[#003087] shadow-sm transition-colors hover:bg-[#f2b72e] focus:outline-none focus:ring-4 focus:ring-amber-200"
          aria-label="Pagar con PayPal"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/55">
            <img
              src="/paypal.svg"
              alt=""
              aria-hidden="true"
              className="h-6 w-6 opacity-90"
            />
          </span>
          Pagar con PayPal
        </button>
      </div>
    </div>
  );
}
