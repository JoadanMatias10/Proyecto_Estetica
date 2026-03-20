const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/Usuario");
const ProductCategory = require("../models/CategoriaProducto");
const ProductBrand = require("../models/MarcaProducto");
const Product = require("../models/Producto");
const ServiceCategory = require("../models/CategoriaServicio");
const Service = require("../models/Servicio");
const CompanyInfo = require("../models/InformacionEmpresa");
const CarouselSlide = require("../models/DiapositivaCarrusel");
const { hashPassword, verifyPassword } = require("../utils/contrasena");
const { createToken } = require("../utils/auth");
const {
  normalizeString,
  validateName,
  validateEmail,
  validatePhone,
  validatePassword,
} = require("../utils/validadores");

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function mapId(record) {
  if (!record) return null;
  return {
    id: record._id.toString(),
    ...record,
    _id: undefined,
    __v: undefined,
  };
}

function mapCompanyInfo(record) {
  const source = record || {};
  return {
    nombre: source.nombre || "",
    direccion: source.direccion || "",
    telefono: source.telefono || "",
    email: source.email || "",
    mision: source.mision || "",
    vision: source.vision || "",
    valores: source.valores || "",
    facebook: source.facebook || "",
    instagram: source.instagram || "",
    quienesSomosTexto: source.quienesSomosTexto || "",
    quienesSomosEsencia: source.quienesSomosEsencia || "",
    horarioLunesSabado: source.horarioLunesSabado || "",
    horarioDomingo: source.horarioDomingo || "",
    mapLat: source.mapLat || "",
    mapLng: source.mapLng || "",
    mapZoom: source.mapZoom || "15",
    mapGoogleUrl: source.mapGoogleUrl || "",
    politicasDocumento: source.politicasDocumento || "",
    politicasDocumentoNombre: source.politicasDocumentoNombre || "",
    politicasDocumentoTipo: source.politicasDocumentoTipo || "",
  };
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

router.post("/register", async (req, res) => {
  try {
    const errors = [];
    const { nombre, apellidoPaterno, apellidoMaterno, telefono, correo, password } = req.body;

    validateName(nombre, "Nombre", errors);
    validateName(apellidoPaterno, "Apellido paterno", errors);
    validateName(apellidoMaterno, "Apellido materno", errors);
    validatePhone(telefono, errors);
    validateEmail(correo, errors);
    validatePassword(password, errors);

    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const normalizedEmail = normalizeEmail(correo);
    const normalizedPhone = normalizeString(telefono);

    const existingByEmail = normalizedEmail
      ? User.findOne({ correo: { $eq: normalizedEmail } })
      : Promise.resolve(null);
    const existingByPhone = normalizedPhone
      ? User.findOne({ telefono: { $eq: normalizedPhone } })
      : Promise.resolve(null);
    const [existingEmail, existingPhone] = await Promise.all([existingByEmail, existingByPhone]);

    if (existingEmail || existingPhone) {
      return res.status(409).json({
        errors: ["El correo o telefono ya estan registrados."],
      });
    }

    const { hash, salt } = hashPassword(password);
    const user = await User.create({
      nombre: normalizeString(nombre),
      apellidoPaterno: normalizeString(apellidoPaterno),
      apellidoMaterno: normalizeString(apellidoMaterno),
      telefono: normalizedPhone,
      correo: normalizedEmail,
      passwordHash: hash,
      passwordSalt: salt,
      role: "client",
    });

    return res.status(201).json({
      message: "Registro exitoso.",
      token: createToken({ id: user._id, correo: user.correo, role: user.role }),
      user: {
        id: user._id,
        nombre: user.nombre,
        apellidoPaterno: user.apellidoPaterno,
        apellidoMaterno: user.apellidoMaterno,
        telefono: user.telefono,
        correo: user.correo,
        role: user.role,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        errors: ["El correo o telefono ya estan registrados."],
      });
    }

    console.error("Error en /api/public/register:", error);
    return res.status(500).json({
      errors: ["No fue posible completar el registro."],
    });
  }
});

router.post("/login", async (req, res) => {
  const errors = [];
  const { correo, password } = req.body;
  const identifier = normalizeEmail(correo);

  if (!identifier) {
    errors.push("Correo o usuario es obligatorio.");
  }
  if (!password) {
    errors.push("Contrasena es obligatoria.");
  }

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  // Login por correo o username: se consulta con valores exactos sanitizados y separados por campo.
  const [userByEmail, userByUsername] = await Promise.all([
    identifier ? User.findOne({ correo: { $eq: identifier } }) : Promise.resolve(null),
    identifier ? User.findOne({ username: { $eq: identifier } }) : Promise.resolve(null),
  ]);
  const user = userByEmail || userByUsername;
  if (!user) {
    return res.status(401).json({ errors: ["Credenciales invalidas."] });
  }

  const isValid = verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ errors: ["Credenciales invalidas."] });
  }

  return res.json({
    message: "Inicio de sesion correcto.",
    token: createToken({ id: user._id, correo: user.correo, role: user.role }),
    user: {
      id: user._id,
      nombre: user.nombre,
      correo: user.correo,
      role: user.role,
    },
  });
});

router.post("/recover", async (req, res) => {
  const errors = [];
  const { correo } = req.body;
  validateEmail(correo, errors);

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  // Recuperacion: email normalizado y usado en comparacion exacta.
  const normalizedRecoverEmail = normalizeEmail(correo);
  const user = await User.findOne({ correo: { $eq: normalizedRecoverEmail } });
  if (!user) {
    return res.status(404).json({ errors: ["No existe una cuenta con ese correo."] });
  }

  return res.json({
    message: "Se envio un enlace de recuperacion al correo.",
  });
});

router.get("/company-info", async (_req, res) => {
  const record = await CompanyInfo.findOne({ key: "main" }).lean();
  return res.json({ companyInfo: mapCompanyInfo(record) });
});

router.get("/product-categories", async (_req, res) => {
  const categories = await ProductCategory.find({ estado: "Activa" }).sort({ nombre: 1 }).lean();
  return res.json({ categories: categories.map(mapId) });
});

router.get("/product-brands", async (_req, res) => {
  const brands = await ProductBrand.find({ estado: "Activa" }).sort({ nombre: 1 }).lean();
  return res.json({ brands: brands.map(mapId) });
});

router.get("/products", async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 }).lean();
  return res.json({ products: products.map(mapId) });
});

router.get("/products/:id", async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ errors: ["Producto no encontrado."] });
  }
  // findById reemplazado por ObjectId estrictamente construido desde parametro validado.
  const product = await Product.findOne({ _id: { $eq: new mongoose.Types.ObjectId(req.params.id) } }).lean();
  if (!product) {
    return res.status(404).json({ errors: ["Producto no encontrado."] });
  }
  return res.json({ product: mapId(product) });
});

router.get("/service-categories", async (_req, res) => {
  const categories = await ServiceCategory.find({ estado: "Activa" }).sort({ segmento: 1, nombre: 1 }).lean();
  return res.json({ categories: categories.map(mapId) });
});

router.get("/services", async (_req, res) => {
  const services = await Service.find().sort({ createdAt: -1 }).lean();
  return res.json({ services: services.map(mapId) });
});

router.get("/carousel", async (_req, res) => {
  const slides = await CarouselSlide.find({ estado: "Activa" }).sort({ orden: 1, createdAt: 1 }).lean();
  return res.json({ slides: slides.map(mapId) });
});

router.get("/bootstrap", async (_req, res) => {
  const [company, categories, brands, products, serviceCategories, services, slides] = await Promise.all([
    CompanyInfo.findOne({ key: "main" }).lean(),
    ProductCategory.find({ estado: "Activa" }).sort({ nombre: 1 }).lean(),
    ProductBrand.find({ estado: "Activa" }).sort({ nombre: 1 }).lean(),
    Product.find().sort({ createdAt: -1 }).lean(),
    ServiceCategory.find({ estado: "Activa" }).sort({ segmento: 1, nombre: 1 }).lean(),
    Service.find().sort({ createdAt: -1 }).lean(),
    CarouselSlide.find({ estado: "Activa" }).sort({ orden: 1, createdAt: 1 }).lean(),
  ]);

  return res.json({
    companyInfo: mapCompanyInfo(company),
    productCategories: categories.map(mapId),
    productBrands: brands.map(mapId),
    products: products.map(mapId),
    serviceCategories: serviceCategories.map(mapId),
    services: services.map(mapId),
    carouselSlides: slides.map(mapId),
  });
});

module.exports = router;
