require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const publicRoutes = require("./routes/publico");
const clientRoutes = require("./routes/cliente");
const adminRoutes = require("./routes/administrador");
const { ensureCatalogData } = require("./utils/sembrarDatosCatalogo");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

//app.use(cors());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://proyecto-estetica.vercel.app"
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/public", publicRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada." });
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
  await ensureCatalogData();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Error iniciando el servidor:", error);
  process.exit(1);
});
