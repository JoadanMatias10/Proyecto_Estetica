import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { endpoints, requestJson } from "../../api";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { getClientToken } from "../../utils/clientStore";

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CalendarioDisponibilidad() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [stylists, setStylists] = useState([]);
  const [selectedStylistId, setSelectedStylistId] = useState("");
  const [availabilityDays, setAvailabilityDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadStylists = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const token = getClientToken();
        const data = await requestJson(endpoints.clientStylists, { token });
        const loadedStylists = Array.isArray(data.stylists) ? data.stylists : [];
        setStylists(loadedStylists);
        setSelectedStylistId(loadedStylists[0]?.id || "");
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar estilistas.");
      } finally {
        setIsLoading(false);
      }
    };

    loadStylists();
  }, []);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!selectedStylistId) {
        setAvailabilityDays([]);
        return;
      }

      setAvailabilityLoading(true);
      setErrorMessage("");
      try {
        const token = getClientToken();
        const desde = toDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
        const hasta = toDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
        const data = await requestJson(
          endpoints.clientStylistAvailability(selectedStylistId, { desde, hasta }),
          { token }
        );
        setAvailabilityDays(Array.isArray(data.days) ? data.days : []);
      } catch (error) {
        setErrorMessage(error.message || "No fue posible cargar la disponibilidad.");
      } finally {
        setAvailabilityLoading(false);
      }
    };

    loadAvailability();
  }, [selectedStylistId, currentDate]);

  const availabilityByDay = useMemo(() => {
    return availabilityDays.reduce((acc, day) => {
      acc[day.date] = day;
      return acc;
    }, {});
  }, [availabilityDays]);

  const selectedDayData = selectedDay ? availabilityByDay[selectedDay] : null;
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const todayKey = toDateKey(new Date());
  const days = [];

  for (let index = 0; index < firstDay; index += 1) {
    days.push(<div key={`empty-${index}`} className="min-h-12 rounded-md bg-slate-50/50 sm:min-h-24 sm:rounded-xl" />);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayKey = toDateKey(dayDate);
    const availability = availabilityByDay[dayKey];
    const isPast = dayKey < todayKey;
    const isAvailable = Boolean(availability?.available) && !isPast;
    const isSelected = selectedDay === dayKey;
    const status = isPast ? "No disponible" : isAvailable ? "Disponible" : "No disponible";

    days.push(
      <button
        type="button"
        key={dayKey}
        onClick={() => setSelectedDay(dayKey)}
        aria-label={`${day}: ${status}`}
        className={`flex min-h-12 min-w-0 flex-col justify-between rounded-md border p-1 text-left shadow-sm transition-all duration-300 sm:min-h-24 sm:rounded-xl sm:border-2 sm:p-2
          ${isSelected ? "ring-4 ring-violet-200" : ""}
          ${isPast
            ? "bg-slate-50 border-slate-200 text-slate-400"
            : isAvailable
              ? "bg-emerald-50 border-emerald-200 hover:border-emerald-300"
              : "bg-rose-50 border-rose-200 hover:border-rose-300"
          }`}
      >
        <span className={`text-sm font-bold sm:text-lg ${isPast ? "text-slate-400" : isAvailable ? "text-emerald-700" : "text-rose-700"}`}>
          {day}
        </span>
        <div className="space-y-1">
          <span className={`hidden rounded-lg px-2 py-1 text-xs font-bold sm:inline-block ${isPast
            ? "bg-slate-100 text-slate-500"
            : isAvailable
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
            }`}>
            {status}
          </span>
          <span
            className={`mx-auto block h-2 w-2 rounded-full sm:hidden ${
              isPast ? "bg-slate-300" : isAvailable ? "bg-emerald-500" : "bg-rose-400"
            }`}
            aria-hidden="true"
          />
          {isAvailable && (
            <div className="hidden text-[11px] font-semibold text-emerald-700 md:block">
              {availability.slots.length} horarios
            </div>
          )}
        </div>
      </button>
    );
  }

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    setSelectedDay("");
  };

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  if (isLoading) {
    return <LoadingSpinner text="Cargando calendario..." fullScreen={false} className="py-24" />;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Calendario de disponibilidad</h1>
          <p className="page-subtitle mt-1">Consulta dias y horarios libres por estilista.</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto">
          <select
            className="form-input w-full sm:min-w-56 md:w-auto"
            value={selectedStylistId}
            onChange={(event) => {
              setSelectedStylistId(event.target.value);
              setSelectedDay("");
            }}
            disabled={stylists.length === 0}
          >
            {stylists.length === 0 ? (
              <option>No hay estilistas disponibles</option>
            ) : (
              stylists.map((stylist) => (
                <option key={stylist.id} value={stylist.id}>
                  {stylist.nombre}
                </option>
              ))
            )}
          </select>

          <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:w-auto sm:gap-4">
            <button onClick={() => changeMonth(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-violet-50 text-violet-600 transition-colors">{"<"}</button>
            <span className="min-w-0 flex-1 text-center text-base font-bold text-slate-800 sm:w-36 sm:flex-none sm:text-lg">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
            <button onClick={() => changeMonth(1)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-violet-50 text-violet-600 transition-colors">{">"}</button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {availabilityLoading ? (
        <LoadingSpinner text="Cargando disponibilidad..." fullScreen={false} className="py-16" />
      ) : (
        <div className="card p-2 shadow-xl sm:p-4 md:p-6">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center sm:mb-4 sm:gap-2 md:gap-4">
            {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"].map((day) => (
              <div key={day} className="font-bold text-violet-400 text-xs uppercase tracking-wider md:text-sm">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2 md:gap-4">
            {days}
          </div>
        </div>
      )}

      {selectedDayData && (
        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-500">Horarios para {selectedDay}</div>
              <div className="text-lg font-bold text-slate-800">
                {selectedDayData.available ? `${selectedDayData.slots.length} horarios libres` : selectedDayData.reason || "No disponible"}
              </div>
            </div>
            {selectedDayData.available && (
              <Link to={`/cliente/citas?stylistId=${encodeURIComponent(selectedStylistId)}&date=${encodeURIComponent(selectedDay)}`}>
                <Button className="px-6 py-3 rounded-xl">Agendar este dia</Button>
              </Link>
            )}
          </div>
          {selectedDayData.available && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedDayData.slots.map((slot) => (
                <span key={slot} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {slot}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex flex-wrap gap-5 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
            <span className="text-sm text-slate-600 font-medium">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-rose-500"></div>
            <span className="text-sm text-slate-600 font-medium">No disponible</span>
          </div>
        </div>
        <Link to="/cliente/citas">
          <Button className="px-6 py-3 rounded-xl">Agendar cita</Button>
        </Link>
      </div>
    </div>
  );
}
