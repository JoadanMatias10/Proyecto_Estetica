require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const publicRoutes = require("./routes/publico");
const clientRoutes = require("./routes/cliente");
const stylistRoutes = require("./routes/estilista");
const adminRoutes = require("./routes/administrador");
const alexaRoutes = require("./routes/alexa");
const { startClientNotificationScheduler } = require("./utils/clientNotifications");
const { ensureCatalogData } = require("./utils/sembrarDatosCatalogo");
const { createAccountDeletionRouter } = require("./routes/accountDeletion");
const { startAccountDeletionWorker } = require("./utils/accountDeletion");
const { createPrivacyPolicyRouter } = require("./routes/privacyPolicy");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

//app.use(cors());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      "https://proyecto-estetica.vercel.app"
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/public/account-deletion", createAccountDeletionRouter());
app.use("/api/public/privacy-policy", createPrivacyPolicyRouter());
app.use("/api/public", publicRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/stylist", stylistRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/alexa", alexaRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada." });
});

app.use((error, _req, res, _next) => {
  if (error?.name === "MulterError" && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ errors: ["La imagen excede el limite de 5 MB."] });
  }

  console.error("Error procesando solicitud:", error);
  return res.status(500).json({ error: "Error interno del servidor." });
});

async function start() {
  if (!MONGODB_URI) {
    throw new Error("Falta configurar MONGODB_URI en el archivo .env");
  }
  if (!process.env.AUTH_SECRET) {
    throw new Error("Falta configurar AUTH_SECRET en el archivo .env");
  }

  await mongoose.connect(MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || "Estetica_Panamericana",
  });
  await require("./models/SolicitudEliminacionCuenta").init();
  await ensureCatalogData();
  startClientNotificationScheduler();
  startAccountDeletionWorker();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Error iniciando el servidor:", error);
  process.exit(1);
});
