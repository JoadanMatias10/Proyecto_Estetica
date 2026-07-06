const DEFAULT_SLOT_MINUTES = 30;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DEFAULT_WEEKLY_SCHEDULE = [
  { day: 0, enabled: false, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 1, enabled: true, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 2, enabled: true, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 3, enabled: true, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 4, enabled: true, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 5, enabled: true, startTime: "10:00", endTime: "18:00", breakStart: "", breakEnd: "" },
  { day: 6, enabled: true, startTime: "10:00", endTime: "15:00", breakStart: "", breakEnd: "" },
];

function normalizeTime(value, fallback = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  return TIME_REGEX.test(normalized) ? normalized : fallback;
}

function timeToMinutes(value) {
  const normalized = normalizeTime(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toLocalDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function dateAtTime(dateKey, time) {
  const date = parseDateKey(dateKey);
  const minutes = timeToMinutes(time);
  if (!date || minutes === null) return null;
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEndOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function normalizeWeeklySchedule(schedule = []) {
  const byDay = new Map(
    Array.isArray(schedule)
      ? schedule.map((item) => [Number(item?.day), item])
      : []
  );

  return DEFAULT_WEEKLY_SCHEDULE.map((defaultDay) => {
    const source = byDay.get(defaultDay.day) || {};
    const startTime = normalizeTime(source.startTime, defaultDay.startTime);
    const endTime = normalizeTime(source.endTime, defaultDay.endTime);
    const breakStart = normalizeTime(source.breakStart, "");
    const breakEnd = normalizeTime(source.breakEnd, "");
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const validRange = startMinutes !== null && endMinutes !== null && startMinutes < endMinutes;

    return {
      day: defaultDay.day,
      enabled: Boolean(source.enabled ?? defaultDay.enabled) && validRange,
      startTime,
      endTime,
      breakStart: breakStart && breakEnd ? breakStart : "",
      breakEnd: breakStart && breakEnd ? breakEnd : "",
    };
  });
}

function normalizeSlotMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SLOT_MINUTES;
  const rounded = Math.round(parsed);
  if (rounded < 15) return 15;
  if (rounded > 240) return 240;
  return rounded;
}

function normalizeDurationMinutes(value, fallback = DEFAULT_SLOT_MINUTES) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  if (rounded < 15) return 15;
  if (rounded > 480) return 480;
  return rounded;
}

function normalizeBlockedPeriods(periods = []) {
  if (!Array.isArray(periods)) return [];

  return periods
    .map((period) => {
      const start = parseDateKey(period?.startDate || toLocalDateKey(new Date(period?.startDate || "")));
      const end = parseDateKey(period?.endDate || toLocalDateKey(new Date(period?.endDate || ""))) || start;
      if (!start || !end) return null;

      const startDate = getStartOfDay(start <= end ? start : end);
      const endDate = getEndOfDay(end >= start ? end : start);
      const allDay = period?.allDay !== false;
      const startTime = allDay ? "" : normalizeTime(period?.startTime, "");
      const endTime = allDay ? "" : normalizeTime(period?.endTime, "");

      if (!allDay) {
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);
        if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) return null;
      }

      return {
        startDate,
        endDate,
        allDay,
        startTime,
        endTime,
        reason: String(period?.reason || "").trim().slice(0, 120),
      };
    })
    .filter(Boolean);
}

function getDefaultAvailability(stylistId) {
  return {
    stylistId,
    slotMinutes: DEFAULT_SLOT_MINUTES,
    weeklySchedule: normalizeWeeklySchedule(),
    blockedPeriods: [],
  };
}

function mapAvailability(record, stylistId = "") {
  const source = record || getDefaultAvailability(stylistId);
  return {
    id: source._id ? String(source._id) : "",
    stylistId: source.stylistId ? String(source.stylistId) : String(stylistId || ""),
    slotMinutes: normalizeSlotMinutes(source.slotMinutes),
    weeklySchedule: normalizeWeeklySchedule(source.weeklySchedule),
    blockedPeriods: Array.isArray(source.blockedPeriods)
      ? source.blockedPeriods.map((period) => ({
        id: period._id ? String(period._id) : "",
        startDate: toLocalDateKey(new Date(period.startDate)),
        endDate: toLocalDateKey(new Date(period.endDate)),
        allDay: period.allDay !== false,
        startTime: period.startTime || "",
        endTime: period.endTime || "",
        reason: period.reason || "",
      }))
      : [],
  };
}

function overlaps(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function getBlockForDate(blocks, date) {
  const start = getStartOfDay(date);
  const end = getEndOfDay(date);
  return (blocks || []).filter((block) => {
    const blockStart = new Date(block.startDate);
    const blockEnd = new Date(block.endDate);
    return blockStart <= end && blockEnd >= start;
  });
}

function buildAvailableSlotsForDate({ availability, dateKey, appointments = [], now = new Date(), durationMinutes = null }) {
  const date = parseDateKey(dateKey);
  if (!date) {
    return { date: dateKey, available: false, reason: "Fecha invalida.", slots: [] };
  }

  const mapped = mapAvailability(availability);
  const dayConfig = mapped.weeklySchedule.find((item) => item.day === date.getDay());
  if (!dayConfig?.enabled) {
    return { date: dateKey, available: false, reason: "El estilista no trabaja este dia.", slots: [] };
  }

  const blocks = getBlockForDate(mapped.blockedPeriods, date);
  if (blocks.some((block) => block.allDay)) {
    return { date: dateKey, available: false, reason: "El estilista no esta disponible este dia.", slots: [] };
  }

  const startMinutes = timeToMinutes(dayConfig.startTime);
  const endMinutes = timeToMinutes(dayConfig.endTime);
  const slotMinutes = mapped.slotMinutes;
  const requiredMinutes = Math.max(slotMinutes, normalizeDurationMinutes(durationMinutes || slotMinutes, slotMinutes));
  if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
    return { date: dateKey, available: false, reason: "Horario no configurado.", slots: [] };
  }

  const breakStart = timeToMinutes(dayConfig.breakStart);
  const breakEnd = timeToMinutes(dayConfig.breakEnd);
  const appointmentRanges = (appointments || [])
    .filter((appointment) => appointment.estado !== "cancelada" && appointment.fechaHora)
    .map((appointment) => {
      const apptDate = new Date(appointment.fechaHora);
      if (toLocalDateKey(apptDate) !== dateKey) return null;
      const start = apptDate.getHours() * 60 + apptDate.getMinutes();
      const length = normalizeDurationMinutes(appointment.duracionMinutos || slotMinutes, slotMinutes);
      return { start, end: start + length };
    })
    .filter(Boolean);

  const appointmentMinutes = new Set(
    (appointments || [])
      .filter((appointment) => appointment.estado !== "cancelada" && appointment.fechaHora)
      .map((appointment) => {
        const apptDate = new Date(appointment.fechaHora);
        if (toLocalDateKey(apptDate) !== dateKey) return null;
        return apptDate.getHours() * 60 + apptDate.getMinutes();
      })
      .filter((value) => value !== null)
  );

  const slots = [];
  for (let cursor = startMinutes; cursor + requiredMinutes <= endMinutes; cursor += slotMinutes) {
    const slotEnd = cursor + requiredMinutes;
    const time = minutesToTime(cursor);
    const slotDate = dateAtTime(dateKey, time);
    if (!slotDate || slotDate <= now) continue;

    if (breakStart !== null && breakEnd !== null && breakStart < breakEnd && overlaps(cursor, slotEnd, breakStart, breakEnd)) {
      continue;
    }

    const blockedByPartial = blocks.some((block) => {
      if (block.allDay) return true;
      const blockStart = timeToMinutes(block.startTime);
      const blockEnd = timeToMinutes(block.endTime);
      return blockStart !== null && blockEnd !== null && overlaps(cursor, slotEnd, blockStart, blockEnd);
    });
    if (blockedByPartial) continue;

    if (appointmentMinutes.has(cursor)) continue;
    if (appointmentRanges.some((appointment) => overlaps(cursor, slotEnd, appointment.start, appointment.end))) continue;
    slots.push(time);
  }

  return {
    date: dateKey,
    available: slots.length > 0,
    reason: slots.length > 0 ? "" : "No hay horarios libres.",
    slots,
  };
}

function buildDateRange(fromDate, toDate, maxDays = 62) {
  const days = [];
  const cursor = getStartOfDay(fromDate);
  const end = getStartOfDay(toDate);
  while (cursor <= end && days.length < maxDays) {
    days.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

module.exports = {
  DEFAULT_WEEKLY_SCHEDULE,
  buildAvailableSlotsForDate,
  buildDateRange,
  dateAtTime,
  getDefaultAvailability,
  getEndOfDay,
  getStartOfDay,
  mapAvailability,
  normalizeBlockedPeriods,
  normalizeSlotMinutes,
  normalizeWeeklySchedule,
  parseDateKey,
  toLocalDateKey,
};
