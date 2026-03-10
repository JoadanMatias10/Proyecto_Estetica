require("dotenv").config();
const mongoose = require("mongoose");

const ProductCategory = require("../models/CategoriaProducto");
const ProductBrand = require("../models/MarcaProducto");
const Product = require("../models/Producto");
const ServiceCategory = require("../models/CategoriaServicio");
const Service = require("../models/Servicio");
const CompanyInfo = require("../models/InformacionEmpresa");
const {
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_PRODUCT_BRANDS,
  DEFAULT_PRODUCTS,
  DEFAULT_SERVICE_CATEGORIES,
  DEFAULT_SERVICES,
  DEFAULT_COMPANY_INFO,
} = require("../utils/datosCatalogoPredeterminado");

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "Estetica_Panamericana";
  if (!mongoUri) {
    throw new Error("MONGODB_URI no configurado.");
  }

  await mongoose.connect(mongoUri, { dbName });

  const categoryNames = DEFAULT_PRODUCT_CATEGORIES.map((item) => item.nombre);
  const brandNames = DEFAULT_PRODUCT_BRANDS.map((item) => item.nombre);
  const productNames = DEFAULT_PRODUCTS.map((item) => item.nombre);
  const serviceNames = DEFAULT_SERVICES.map((item) => item.nombre);
  const serviceCategoryPairs = DEFAULT_SERVICE_CATEGORIES.map((item) => ({
    nombre: item.nombre,
    segmento: item.segmento,
  }));

  const [products, productCategories, productBrands, services, serviceCategories] = await Promise.all([
    Product.deleteMany({ nombre: { $in: productNames } }),
    ProductCategory.deleteMany({ nombre: { $in: categoryNames } }),
    ProductBrand.deleteMany({ nombre: { $in: brandNames } }),
    Service.deleteMany({ nombre: { $in: serviceNames } }),
    ServiceCategory.deleteMany({ $or: serviceCategoryPairs }),
  ]);

  let company = "none";
  const companyInfo = await CompanyInfo.findOne({ key: "main" });
  if (companyInfo) {
    const isDefault =
      companyInfo.nombre === DEFAULT_COMPANY_INFO.nombre &&
      companyInfo.direccion === DEFAULT_COMPANY_INFO.direccion &&
      companyInfo.telefono === DEFAULT_COMPANY_INFO.telefono &&
      companyInfo.email === DEFAULT_COMPANY_INFO.email;

    if (isDefault) {
      await CompanyInfo.deleteOne({ _id: companyInfo._id });
      company = "deleted-default";
    }
  }

  console.log(
    JSON.stringify({
      products: products.deletedCount,
      productCategories: productCategories.deletedCount,
      productBrands: productBrands.deletedCount,
      services: services.deletedCount,
      serviceCategories: serviceCategories.deletedCount,
      company,
    })
  );

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Error limpiando datos estaticos:", error.message);
    try {
      await mongoose.disconnect();
    } catch (_error) {
      // ignore
    }
    process.exit(1);
  });
