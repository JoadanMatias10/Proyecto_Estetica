const multer = require("multer");

let xlsxCache = null;
let xlsxLoadError = null;

function getXlsx() {
  if (xlsxCache) return xlsxCache;
  if (xlsxLoadError) throw xlsxLoadError;

  try {
    xlsxCache = require("xlsx");
    return xlsxCache;
  } catch (error) {
    xlsxLoadError = error;
    throw error;
  }
}

function registrarCatalogoAdminRoutes(router, contexto) {
  const {
    ProductCategory,
    ProductBrand,
    Product,
    ServiceCategory,
    Service,
    CompanyInfo,
    CarouselSlide,
    sanitizeText,
    sanitizeState,
    sanitizeSegment,
    sanitizeProductUnit,
    sanitizeSalePaymentMethod,
    parsePositiveNumber,
    parsePositiveInteger,
    isValidId,
    findOneCaseInsensitive,
    mapId,
    mapCompanyInfo,
    normalizeCarouselOrder,
    CAROUSEL_BG_OPTIONS,
    estimateBase64Bytes,
    ALLOWED_POLICY_DOCUMENT_TYPES,
    MAX_POLICY_DOCUMENT_BYTES,
    upload,
    cloudinary,
  } = contexto;

const EXCEL_PRODUCT_COLUMNS = [
  "producto",
  "imagen",
  "marca",
  "categoria",
  "precio",
  "stock",
  "acciones",
];

const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const CLOUDINARY_UNAVAILABLE_MESSAGE =
  "La carga de imagenes no esta disponible. Configura CLOUDINARY_NAME, CLOUDINARY_KEY y CLOUDINARY_SECRET en el servidor.";

function isDataUrlImage(value) {
  return /^data:image\//i.test(String(value || "").trim());
}

async function destroyProductImage(publicId) {
  const normalizedPublicId = sanitizeText(publicId);
  if (!normalizedPublicId) return;

  try {
    await cloudinary.uploader.destroy(normalizedPublicId, {
      invalidate: true,
      resource_type: "image",
    });
  } catch (error) {
    console.error("No fue posible eliminar la imagen del producto en Cloudinary:", error);
  }
}

async function cleanupUploadedProductImage(uploadedImage) {
  const uploadedPublicId = sanitizeText(uploadedImage?.filename || uploadedImage?.public_id);
  if (!uploadedPublicId) return;
  await destroyProductImage(uploadedPublicId);
}

function requireCloudinaryUploadSupport(req, res, next) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  const isMultipartRequest = contentType.includes("multipart/form-data");

  if (!isMultipartRequest || cloudinary.isConfigured) {
    return next();
  }

  return res.status(503).json({ errors: [CLOUDINARY_UNAVAILABLE_MESSAGE] });
}

function normalizeImportHeader(value) {
  return sanitizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeImportText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return sanitizeText(String(value));
}

function normalizeImportNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = normalizeImportText(value).replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeCatalogLookup(value) {
  return normalizeImportText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickImportValue(row, keys) {
  const normalizedRow = {};

  Object.entries(row || {}).forEach(([key, value]) => {
    normalizedRow[normalizeImportHeader(key)] = value;
  });

  for (const key of keys) {
    const normalizedKey = normalizeImportHeader(key);
    if (Object.prototype.hasOwnProperty.call(normalizedRow, normalizedKey)) {
      return normalizedRow[normalizedKey];
    }
  }

  return "";
}

router.get("/product-categories", async (_req, res) => {
  const categories = await ProductCategory.find().sort({ nombre: 1 }).lean();
  return res.json({ categories: categories.map(mapId) });
});

router.post("/product-categories", async (req, res) => {
  const nombre = sanitizeText(req.body.nombre);
  const estado = sanitizeState(req.body.estado);
  const descripcion = sanitizeText(req.body.descripcion);

  const errors = [];
  if (!nombre) errors.push("Nombre de categoria es obligatorio.");
  if (errors.length) return res.status(400).json({ errors });

  const duplicated = await findOneCaseInsensitive(ProductCategory, "nombre", nombre);
  if (duplicated) {
    return res.status(409).json({ errors: ["Ya existe una categoria con ese nombre."] });
  }

  const category = await ProductCategory.create({ nombre, estado, descripcion });
  return res.status(201).json({ category: mapId(category.toObject()) });
});

router.put("/product-categories/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Categoria invalida."] });
  }

  const current = await ProductCategory.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Categoria no encontrada."] });
  }

  const nombre = sanitizeText(req.body.nombre);
  const estado = sanitizeState(req.body.estado);
  const descripcion = sanitizeText(req.body.descripcion);

  const errors = [];
  if (!nombre) errors.push("Nombre de categoria es obligatorio.");
  if (errors.length) return res.status(400).json({ errors });

  const duplicated = await findOneCaseInsensitive(ProductCategory, "nombre", nombre, id);
  if (duplicated) {
    return res.status(409).json({ errors: ["Ya existe una categoria con ese nombre."] });
  }

  const previousName = current.nombre;
  current.nombre = nombre;
  current.estado = estado;
  current.descripcion = descripcion;
  await current.save();

  if (previousName !== nombre) {
    await Product.updateMany({ categoria: previousName }, { categoria: nombre });
  }

  return res.json({ category: mapId(current.toObject()) });
});

router.delete("/product-categories/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Categoria invalida."] });
  }

  const current = await ProductCategory.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Categoria no encontrada."] });
  }

  const usedByProducts = await Product.countDocuments({ categoria: current.nombre });
  if (usedByProducts > 0) {
    return res.status(409).json({
      errors: ["No puedes eliminar la categoria porque esta en uso por productos."],
    });
  }

  await ProductCategory.deleteOne({ _id: id });
  return res.json({ message: "Categoria eliminada." });
});

router.get("/product-brands", async (_req, res) => {
  const brands = await ProductBrand.find().sort({ nombre: 1 }).lean();
  return res.json({ brands: brands.map(mapId) });
});

router.post("/product-brands", async (req, res) => {
  const nombre = sanitizeText(req.body.nombre);
  const pais = sanitizeText(req.body.pais);
  const estado = sanitizeState(req.body.estado);

  if (!nombre) {
    return res.status(400).json({ errors: ["Nombre de marca es obligatorio."] });
  }

  const duplicated = await findOneCaseInsensitive(ProductBrand, "nombre", nombre);
  if (duplicated) {
    return res.status(409).json({ errors: ["Ya existe una marca con ese nombre."] });
  }

  const brand = await ProductBrand.create({ nombre, pais, estado });
  return res.status(201).json({ brand: mapId(brand.toObject()) });
});

router.put("/product-brands/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Marca invalida."] });
  }

  const current = await ProductBrand.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Marca no encontrada."] });
  }

  const nombre = sanitizeText(req.body.nombre);
  const pais = sanitizeText(req.body.pais);
  const estado = sanitizeState(req.body.estado);

  if (!nombre) {
    return res.status(400).json({ errors: ["Nombre de marca es obligatorio."] });
  }

  const duplicated = await findOneCaseInsensitive(ProductBrand, "nombre", nombre, id);
  if (duplicated) {
    return res.status(409).json({ errors: ["Ya existe una marca con ese nombre."] });
  }

  const previousName = current.nombre;
  current.nombre = nombre;
  current.pais = pais;
  current.estado = estado;
  await current.save();

  if (previousName !== nombre) {
    await Product.updateMany({ marca: previousName }, { marca: nombre });
  }

  return res.json({ brand: mapId(current.toObject()) });
});

router.delete("/product-brands/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Marca invalida."] });
  }

  const current = await ProductBrand.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Marca no encontrada."] });
  }

  const usedByProducts = await Product.countDocuments({ marca: current.nombre });
  if (usedByProducts > 0) {
    return res.status(409).json({
      errors: ["No puedes eliminar la marca porque esta en uso por productos."],
    });
  }

  await ProductBrand.deleteOne({ _id: id });
  return res.json({ message: "Marca eliminada." });
});

router.get("/products", async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 }).lean();
  return res.json({ products: products.map(mapId) });
});

router.get("/products/export", async (_req, res) => {
  let xlsx;
  try {
    xlsx = getXlsx();
  } catch (_error) {
    return res.status(503).json({
      errors: ["La exportacion de productos no esta disponible. Instala la dependencia xlsx en el servidor."],
    });
  }

  const products = await Product.find().sort({ createdAt: -1 }).lean();
  const rows = products.map((product) => ({
    producto: product.nombre || "",
    imagen: product.imagen || "",
    marca: product.marca || "",
    categoria: product.categoria || "",
    precio: Number(product.precio || 0),
    stock: Number(product.stock || 0),
    acciones: "",
  }));

  const worksheet = xlsx.utils.json_to_sheet(rows, { header: EXCEL_PRODUCT_COLUMNS });
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Productos");
  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  const fileName = `productos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return res.send(buffer);
});

router.post("/products/import", excelUpload.single("archivo"), async (req, res) => {
  let xlsx;
  try {
    xlsx = getXlsx();
  } catch (_error) {
    return res.status(503).json({
      errors: ["La importacion de productos no esta disponible. Instala la dependencia xlsx en el servidor."],
    });
  }

  const archivo = req.file;
  if (!archivo) {
    return res.status(400).json({ errors: ["Debes seleccionar un archivo Excel."] });
  }

  const archivoNombre = sanitizeText(archivo.originalname || "").toLowerCase();
  if (!archivoNombre.endsWith(".xlsx") && !archivoNombre.endsWith(".xls")) {
    return res.status(400).json({ errors: ["Formato invalido. Subir archivo .xlsx o .xls."] });
  }

  let rows;
  try {
    const workbook = xlsx.read(archivo.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return res.status(400).json({ errors: ["El archivo no contiene hojas validas."] });
    }
    rows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });
  } catch (_error) {
    return res.status(400).json({ errors: ["No fue posible leer el archivo Excel."] });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ errors: ["El archivo esta vacio."] });
  }

  try {
    const categoryNames = await ProductCategory.find().select("nombre").lean();
    const brandNames = await ProductBrand.find().select("nombre").lean();
    const categoryMap = new Map(
      categoryNames.map((item) => [normalizeCatalogLookup(item.nombre), sanitizeText(item.nombre)])
    );
    const brandMap = new Map(
      brandNames.map((item) => [normalizeCatalogLookup(item.nombre), sanitizeText(item.nombre)])
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    const processedKeys = new Set();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const line = index + 2;
      const rowErrors = [];

      const nombre = normalizeImportText(pickImportValue(row, ["producto", "nombre", "name", "product name"]));
      const marcaRaw = normalizeImportText(pickImportValue(row, ["marca", "brand", "marca producto"]));
      const categoriaRaw = normalizeImportText(pickImportValue(row, ["categoria", "category", "categoria producto"]));
      const imagen = normalizeImportText(pickImportValue(row, ["imagen", "image"]));
      const precio = normalizeImportNumber(pickImportValue(row, ["precio", "price"]));
      const stock = normalizeImportNumber(pickImportValue(row, ["stock", "existencias", "cantidad"]));
      const marcaLookup = normalizeCatalogLookup(marcaRaw);
      const categoriaLookup = normalizeCatalogLookup(categoriaRaw);
      const marca = brandMap.get(marcaLookup) || marcaRaw;
      const categoria = categoryMap.get(categoriaLookup) || categoriaRaw;

      const importKey = `${nombre.toLowerCase()}-${marca.toLowerCase()}-${categoria.toLowerCase()}`;

      if (!nombre) rowErrors.push("El nombre es obligatorio.");
      if (!marca) rowErrors.push("La marca es obligatoria.");
      if (!categoria) rowErrors.push("La categoria es obligatoria.");
      if (!Number.isFinite(precio) || precio < 0) rowErrors.push("Precio invalido.");
      if (!Number.isFinite(stock) || stock < 0) rowErrors.push("Stock invalido.");
      if (!categoryMap.has(categoriaLookup)) rowErrors.push("La categoria no existe.");
      if (!brandMap.has(marcaLookup)) rowErrors.push("La marca no existe.");
      if (processedKeys.has(importKey)) rowErrors.push("Producto duplicado dentro del mismo archivo.");

      if (rowErrors.length) {
        errors.push(`Fila ${line}: ${rowErrors.join(" ")}`);
        skipped += 1;
        continue;
      }

      processedKeys.add(importKey);
      const productData = {
        nombre,
        marca,
        precio,
        stock,
        categoria,
      };

      if (imagen) {
        productData.imagen = imagen;
        productData.imagenPublicId = "";
      }

      const existingByName = await Product.findOne({ nombre, marca, categoria });
      if (existingByName) {
        const previousImagePublicId = sanitizeText(existingByName.imagenPublicId);
        Object.assign(existingByName, productData);
        await existingByName.save();
        if (imagen && previousImagePublicId) {
          await destroyProductImage(previousImagePublicId);
        }
        updated += 1;
        continue;
      }

      await Product.create(productData);
      created += 1;
    }

    return res.json({
      totalRows: rows.length,
      processedRows: created + updated,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (error) {
    return res.status(400).json({
      errors: [error?.message || "No fue posible importar el archivo."],
    });
  }
});

router.post("/products", requireCloudinaryUploadSupport, upload.single("imagen"), async (req, res) => {
  const uploadedImage = req.file;
  const nombre = sanitizeText(req.body.nombre);
  const marca = sanitizeText(req.body.marca);
  const categoria = sanitizeText(req.body.categoria);
  const descripcion = sanitizeText(req.body.descripcion);
  const imagen = sanitizeText(uploadedImage?.path || req.body.imagen);
  const imagenPublicId = sanitizeText(uploadedImage?.filename || req.body.imagenPublicId);
  const imagenNombre = sanitizeText(uploadedImage?.originalname || req.body.imagenNombre);
  const precio = parsePositiveNumber(req.body.precio, NaN);
  const stock = parsePositiveNumber(req.body.stock, NaN);
  const cantidadMedida = parsePositiveNumber(req.body.cantidadMedida, NaN);
  const unidadMedida = sanitizeProductUnit(req.body.unidadMedida);
  const rating = parsePositiveNumber(req.body.rating, 4.8);

  const errors = [];
  if (!nombre) errors.push("Nombre de producto es obligatorio.");
  if (!marca) errors.push("Marca es obligatoria.");
  if (!categoria) errors.push("Categoria es obligatoria.");
  if (!Number.isFinite(precio)) errors.push("Precio invalido.");
  if (!Number.isFinite(stock)) errors.push("Stock invalido.");
  if (!Number.isFinite(cantidadMedida) || cantidadMedida <= 0) errors.push("Cantidad de medida invalida.");
  if (!unidadMedida) errors.push("Unidad de medida invalida.");
  if (!imagen) errors.push("La imagen del producto es obligatoria.");
  if (isDataUrlImage(imagen)) errors.push("La imagen debe enviarse como archivo o URL valida, no en base64.");

  const category = await ProductCategory.findOne({ nombre: categoria });
  if (!category) {
    errors.push("La categoria seleccionada no existe.");
  }

  const brand = await ProductBrand.findOne({ nombre: marca });
  if (!brand) errors.push("La marca seleccionada no existe.");

  if (errors.length) {
    await cleanupUploadedProductImage(uploadedImage);
    return res.status(400).json({ errors });
  }

  try {
    const product = await Product.create({
      nombre,
      marca,
      precio,
      stock,
      cantidadMedida,
      unidadMedida,
      categoria,
      descripcion,
      imagen,
      imagenPublicId,
      imagenNombre,
      rating: Math.min(Math.max(rating, 0), 5),
    });

    return res.status(201).json({ product: mapId(product.toObject()) });
  } catch (error) {
    await cleanupUploadedProductImage(uploadedImage);
    throw error;
  }
});

router.put("/products/:id", requireCloudinaryUploadSupport, upload.single("imagen"), async (req, res) => {
  const uploadedImage = req.file;
  const { id } = req.params;
  if (!isValidId(id)) {
    await cleanupUploadedProductImage(uploadedImage);
    return res.status(400).json({ errors: ["Producto invalido."] });
  }

  const current = await Product.findById(id);
  if (!current) {
    await cleanupUploadedProductImage(uploadedImage);
    return res.status(404).json({ errors: ["Producto no encontrado."] });
  }

  const nombre = sanitizeText(req.body.nombre);
  const marca = sanitizeText(req.body.marca);
  const categoria = sanitizeText(req.body.categoria);
  const descripcion = sanitizeText(req.body.descripcion);
  const imagen = sanitizeText(uploadedImage?.path || req.body.imagen);
  const imagenPublicId = sanitizeText(uploadedImage?.filename || req.body.imagenPublicId);
  const imagenNombre = sanitizeText(uploadedImage?.originalname || req.body.imagenNombre);
  const precio = parsePositiveNumber(req.body.precio, NaN);
  const stock = parsePositiveNumber(req.body.stock, NaN);
  const cantidadMedida = parsePositiveNumber(req.body.cantidadMedida, NaN);
  const unidadMedida = sanitizeProductUnit(req.body.unidadMedida);
  const rating = parsePositiveNumber(req.body.rating, current.rating || 4.8);

  const errors = [];
  if (!nombre) errors.push("Nombre de producto es obligatorio.");
  if (!marca) errors.push("Marca es obligatoria.");
  if (!categoria) errors.push("Categoria es obligatoria.");
  if (!Number.isFinite(precio)) errors.push("Precio invalido.");
  if (!Number.isFinite(stock)) errors.push("Stock invalido.");
  if (!Number.isFinite(cantidadMedida) || cantidadMedida <= 0) errors.push("Cantidad de medida invalida.");
  if (!unidadMedida) errors.push("Unidad de medida invalida.");
  if (isDataUrlImage(imagen)) errors.push("La imagen debe enviarse como archivo o URL valida, no en base64.");

  const category = await ProductCategory.findOne({ nombre: categoria });
  if (!category) {
    errors.push("La categoria seleccionada no existe.");
  }

  const brand = await ProductBrand.findOne({ nombre: marca });
  if (!brand) errors.push("La marca seleccionada no existe.");

  if (errors.length) {
    await cleanupUploadedProductImage(uploadedImage);
    return res.status(400).json({ errors });
  }

  const previousImagePublicId = sanitizeText(current.imagenPublicId);

  try {
    current.nombre = nombre;
    current.marca = marca;
    current.precio = precio;
    current.stock = stock;
    current.cantidadMedida = cantidadMedida;
    current.unidadMedida = unidadMedida;
    current.categoria = categoria;
    current.descripcion = descripcion;
    current.rating = Math.min(Math.max(rating, 0), 5);

    if (uploadedImage?.path) {
      current.imagen = imagen;
      current.imagenPublicId = imagenPublicId;
      current.imagenNombre = imagenNombre;
    } else if (imagen) {
      current.imagen = imagen;
      current.imagenPublicId = imagenPublicId;
      current.imagenNombre = imagenNombre || current.imagenNombre;
    }

    await current.save();

    if (uploadedImage?.path && previousImagePublicId && previousImagePublicId !== imagenPublicId) {
      await destroyProductImage(previousImagePublicId);
    }

    return res.json({ product: mapId(current.toObject()) });
  } catch (error) {
    await cleanupUploadedProductImage(uploadedImage);
    throw error;
  }
});

router.delete("/products/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Producto invalido."] });
  }

  const deleted = await Product.findByIdAndDelete(id);
  if (!deleted) {
    return res.status(404).json({ errors: ["Producto no encontrado."] });
  }
  await destroyProductImage(deleted.imagenPublicId);
  return res.json({ message: "Producto eliminado." });
});

router.get("/service-categories", async (_req, res) => {
  const categories = await ServiceCategory.find().sort({ segmento: 1, nombre: 1 }).lean();
  return res.json({ categories: categories.map(mapId) });
});

router.post("/service-categories", async (req, res) => {
  const nombre = sanitizeText(req.body.nombre);
  const segmento = sanitizeSegment(req.body.segmento);
  const estado = sanitizeState(req.body.estado);
  const descripcion = sanitizeText(req.body.descripcion);

  if (!nombre) {
    return res.status(400).json({ errors: ["Nombre de categoria es obligatorio."] });
  }

  const duplicated = await findOneCaseInsensitive(
    ServiceCategory,
    "nombre",
    nombre,
    null,
    { segmento }
  );
  if (duplicated) {
    return res.status(409).json({ errors: ["Esa categoria ya existe para el segmento seleccionado."] });
  }

  const category = await ServiceCategory.create({ nombre, segmento, estado, descripcion });
  return res.status(201).json({ category: mapId(category.toObject()) });
});

router.put("/service-categories/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Categoria invalida."] });
  }

  const current = await ServiceCategory.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Categoria no encontrada."] });
  }

  const nombre = sanitizeText(req.body.nombre);
  const segmento = sanitizeSegment(req.body.segmento);
  const estado = sanitizeState(req.body.estado);
  const descripcion = sanitizeText(req.body.descripcion);

  if (!nombre) {
    return res.status(400).json({ errors: ["Nombre de categoria es obligatorio."] });
  }

  const duplicated = await findOneCaseInsensitive(
    ServiceCategory,
    "nombre",
    nombre,
    id,
    { segmento }
  );
  if (duplicated) {
    return res.status(409).json({ errors: ["Esa categoria ya existe para el segmento seleccionado."] });
  }

  const previousSegment = current.segmento;
  const previousName = current.nombre;
  current.nombre = nombre;
  current.segmento = segmento;
  current.estado = estado;
  current.descripcion = descripcion;
  await current.save();

  if (previousSegment !== segmento || previousName !== nombre) {
    await Service.updateMany(
      { segmento: previousSegment, subcategoria: previousName },
      { segmento, subcategoria: nombre }
    );
  }

  return res.json({ category: mapId(current.toObject()) });
});

router.delete("/service-categories/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Categoria invalida."] });
  }

  const current = await ServiceCategory.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Categoria no encontrada."] });
  }

  const usedByServices = await Service.countDocuments({
    segmento: current.segmento,
    subcategoria: current.nombre,
  });
  if (usedByServices > 0) {
    return res.status(409).json({
      errors: ["No puedes eliminar la categoria porque esta en uso por servicios."],
    });
  }

  await ServiceCategory.deleteOne({ _id: id });
  return res.json({ message: "Categoria eliminada." });
});

router.get("/services", async (_req, res) => {
  const services = await Service.find().sort({ createdAt: -1 }).lean();
  return res.json({ services: services.map(mapId) });
});

router.post("/services", async (req, res) => {
  const nombre = sanitizeText(req.body.nombre);
  const segmento = sanitizeSegment(req.body.segmento);
  const subcategoria = sanitizeText(req.body.subcategoria);
  const descripcion = sanitizeText(req.body.descripcion);
  const imagen = sanitizeText(req.body.imagen);
  const imagenNombre = sanitizeText(req.body.imagenNombre);
  const tiempo = sanitizeText(req.body.tiempo);
  const precio = parsePositiveNumber(req.body.precio, NaN);

  const errors = [];
  if (!nombre) errors.push("Nombre de servicio es obligatorio.");
  if (!subcategoria) errors.push("Subcategoria es obligatoria.");
  if (!tiempo) errors.push("Tiempo estimado es obligatorio.");
  if (!Number.isFinite(precio)) errors.push("Precio invalido.");
  if (!imagen) errors.push("La imagen del servicio es obligatoria.");

  const category = await ServiceCategory.findOne({ segmento, nombre: subcategoria });
  if (!category) {
    errors.push("La subcategoria no existe para el segmento seleccionado.");
  }

  if (errors.length) return res.status(400).json({ errors });

  const service = await Service.create({
    nombre,
    segmento,
    subcategoria,
    precio,
    tiempo,
    descripcion,
    imagen,
    imagenNombre,
  });

  return res.status(201).json({ service: mapId(service.toObject()) });
});

router.put("/services/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Servicio invalido."] });
  }

  const current = await Service.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Servicio no encontrado."] });
  }

  const nombre = sanitizeText(req.body.nombre);
  const segmento = sanitizeSegment(req.body.segmento);
  const subcategoria = sanitizeText(req.body.subcategoria);
  const descripcion = sanitizeText(req.body.descripcion);
  const imagen = sanitizeText(req.body.imagen);
  const imagenNombre = sanitizeText(req.body.imagenNombre);
  const tiempo = sanitizeText(req.body.tiempo);
  const precio = parsePositiveNumber(req.body.precio, NaN);

  const errors = [];
  if (!nombre) errors.push("Nombre de servicio es obligatorio.");
  if (!subcategoria) errors.push("Subcategoria es obligatoria.");
  if (!tiempo) errors.push("Tiempo estimado es obligatorio.");
  if (!Number.isFinite(precio)) errors.push("Precio invalido.");

  const category = await ServiceCategory.findOne({ segmento, nombre: subcategoria });
  if (!category) {
    errors.push("La subcategoria no existe para el segmento seleccionado.");
  }

  if (errors.length) return res.status(400).json({ errors });

  current.nombre = nombre;
  current.segmento = segmento;
  current.subcategoria = subcategoria;
  current.precio = precio;
  current.tiempo = tiempo;
  current.descripcion = descripcion;
  current.imagen = imagen || current.imagen || "";
  current.imagenNombre = imagenNombre;
  await current.save();

  return res.json({ service: mapId(current.toObject()) });
});

router.delete("/services/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Servicio invalido."] });
  }

  const deleted = await Service.findByIdAndDelete(id);
  if (!deleted) {
    return res.status(404).json({ errors: ["Servicio no encontrado."] });
  }
  return res.json({ message: "Servicio eliminado." });
});

router.get("/company-info", async (_req, res) => {
  const info = await CompanyInfo.findOne({ key: "main" }).lean();
  return res.json({ companyInfo: mapCompanyInfo(info) });
});

router.put("/company-info", async (req, res) => {
  const payload = {
    nombre: sanitizeText(req.body.nombre),
    direccion: sanitizeText(req.body.direccion),
    telefono: sanitizeText(req.body.telefono),
    email: sanitizeText(req.body.email).toLowerCase(),
    mision: sanitizeText(req.body.mision),
    vision: sanitizeText(req.body.vision),
    valores: sanitizeText(req.body.valores),
    facebook: sanitizeText(req.body.facebook),
    instagram: sanitizeText(req.body.instagram),
    quienesSomosTexto: sanitizeText(req.body.quienesSomosTexto),
    quienesSomosEsencia: sanitizeText(req.body.quienesSomosEsencia),
    horarioLunesSabado: sanitizeText(req.body.horarioLunesSabado),
    horarioDomingo: sanitizeText(req.body.horarioDomingo),
    mapLat: sanitizeText(req.body.mapLat),
    mapLng: sanitizeText(req.body.mapLng),
    mapZoom: sanitizeText(req.body.mapZoom || "15"),
    mapGoogleUrl: sanitizeText(req.body.mapGoogleUrl),
    politicasDocumento: sanitizeText(req.body.politicasDocumento),
    politicasDocumentoNombre: sanitizeText(req.body.politicasDocumentoNombre),
    politicasDocumentoTipo: sanitizeText(req.body.politicasDocumentoTipo),
  };

  if (payload.politicasDocumento) {
    const docMatch = payload.politicasDocumento.match(/^data:([^;]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!docMatch) {
      return res.status(400).json({ errors: ["Documento de politicas invalido."] });
    }

    const detectedMimeType = String(docMatch[1] || "").toLowerCase();
    if (!ALLOWED_POLICY_DOCUMENT_TYPES.has(detectedMimeType)) {
      return res.status(400).json({ errors: ["Tipo de documento no permitido."] });
    }

    if (estimateBase64Bytes(docMatch[2]) > MAX_POLICY_DOCUMENT_BYTES) {
      return res.status(400).json({ errors: ["El documento excede el limite de 5 MB."] });
    }

    payload.politicasDocumentoTipo = detectedMimeType;
  } else {
    payload.politicasDocumentoNombre = "";
    payload.politicasDocumentoTipo = "";
  }

  const info = await CompanyInfo.findOneAndUpdate(
    { key: "main" },
    { $set: payload, $setOnInsert: { key: "main" } },
    { upsert: true, new: true }
  ).lean();

  return res.json({ companyInfo: mapCompanyInfo(info) });
});

router.get("/carousel", async (_req, res) => {
  const slides = await CarouselSlide.find().sort({ orden: 1, createdAt: 1 }).lean();
  return res.json({ slides: slides.map(mapId) });
});

router.post("/carousel", async (req, res) => {
  const title = sanitizeText(req.body.title);
  const description = sanitizeText(req.body.description);
  const image = sanitizeText(req.body.image);
  const estado = sanitizeState(req.body.estado);
  const bgColor = CAROUSEL_BG_OPTIONS.includes(req.body.bgColor)
    ? req.body.bgColor
    : CAROUSEL_BG_OPTIONS[0];

  const errors = [];
  if (!title) errors.push("Titulo es obligatorio.");
  if (!description) errors.push("Descripcion es obligatoria.");
  if (!image) errors.push("Imagen es obligatoria.");
  if (errors.length) return res.status(400).json({ errors });

  const maxOrderSlide = await CarouselSlide.findOne().sort({ orden: -1 }).lean();
  const orden = maxOrderSlide ? maxOrderSlide.orden + 1 : 0;

  const slide = await CarouselSlide.create({ title, description, image, bgColor, estado, orden });
  return res.status(201).json({ slide: mapId(slide.toObject()) });
});

router.put("/carousel/reorder", async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (ids.length === 0) {
    return res.status(400).json({ errors: ["Debes enviar el orden de slides."] });
  }

  const normalizedIds = ids.filter((id) => isValidId(id)).map((id) => id.toString());
  if (normalizedIds.length !== ids.length) {
    return res.status(400).json({ errors: ["Uno o mas ids de slide son invalidos."] });
  }

  const existingSlides = await CarouselSlide.find({ _id: { $in: normalizedIds } }).select("_id");
  if (existingSlides.length !== normalizedIds.length) {
    return res.status(400).json({ errors: ["El orden contiene slides inexistentes."] });
  }

  await Promise.all(
    normalizedIds.map((id, index) =>
      CarouselSlide.updateOne({ _id: id }, { orden: index })
    )
  );

  const slides = await CarouselSlide.find().sort({ orden: 1, createdAt: 1 }).lean();
  return res.json({ slides: slides.map(mapId) });
});

router.put("/carousel/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Slide invalido."] });
  }

  const current = await CarouselSlide.findById(id);
  if (!current) {
    return res.status(404).json({ errors: ["Slide no encontrado."] });
  }

  const title = sanitizeText(req.body.title);
  const description = sanitizeText(req.body.description);
  const image = sanitizeText(req.body.image);
  const estado = sanitizeState(req.body.estado);
  const bgColor = CAROUSEL_BG_OPTIONS.includes(req.body.bgColor)
    ? req.body.bgColor
    : CAROUSEL_BG_OPTIONS[0];

  const errors = [];
  if (!title) errors.push("Titulo es obligatorio.");
  if (!description) errors.push("Descripcion es obligatoria.");
  if (!image) errors.push("Imagen es obligatoria.");
  if (errors.length) return res.status(400).json({ errors });

  current.title = title;
  current.description = description;
  current.image = image;
  current.estado = estado;
  current.bgColor = bgColor;
  await current.save();

  return res.json({ slide: mapId(current.toObject()) });
});

router.delete("/carousel/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ errors: ["Slide invalido."] });
  }

  const deleted = await CarouselSlide.findByIdAndDelete(id);
  if (!deleted) {
    return res.status(404).json({ errors: ["Slide no encontrado."] });
  }

  await normalizeCarouselOrder();

  return res.json({ message: "Slide eliminado." });
});
}

module.exports = registrarCatalogoAdminRoutes;
