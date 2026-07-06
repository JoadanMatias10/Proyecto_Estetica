const mongoose = require("mongoose");

const weeklyDaySchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: "10:00", trim: true },
    endTime: { type: String, default: "18:00", trim: true },
    breakStart: { type: String, default: "", trim: true },
    breakEnd: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const blockedPeriodSchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    allDay: { type: Boolean, default: true },
    startTime: { type: String, default: "", trim: true },
    endTime: { type: String, default: "", trim: true },
    reason: { type: String, default: "", trim: true },
  },
  { _id: true }
);

const stylistAvailabilitySchema = new mongoose.Schema(
  {
    stylistId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    slotMinutes: { type: Number, min: 15, max: 240, default: 30 },
    weeklySchedule: { type: [weeklyDaySchema], default: () => [] },
    blockedPeriods: { type: [blockedPeriodSchema], default: () => [] },
  },
  { timestamps: true, collection: "disponibilidad_estilistas" }
);

module.exports = mongoose.model("StylistAvailability", stylistAvailabilitySchema);
