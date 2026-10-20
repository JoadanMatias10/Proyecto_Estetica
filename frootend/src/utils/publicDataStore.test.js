import {
  sanitizePublicCompanyInfo,
  sanitizePublicProduct,
  sanitizePublicPromotion,
  sanitizePublicService,
} from "./publicDataStore";

describe("publicDataStore sanitizers", () => {
  test("conserva solo campos públicos necesarios de productos", () => {
    const product = sanitizePublicProduct({
      _id: "p1",
      nombre: "Shampoo",
      precio: "120.50",
      categoria: "Cabello",
      stock: 99,
      token: "privado",
    });

    expect(product).toMatchObject({ id: "p1", nombre: "Shampoo", precio: 120.5, categoria: "Cabello" });
    expect(product).not.toHaveProperty("stock");
    expect(product).not.toHaveProperty("token");
  });

  test("normaliza servicios y elimina campos ajenos", () => {
    const service = sanitizePublicService({
      id: "s1",
      nombre: "Corte",
      precio: 250,
      duracion: "30 min",
      credential: "no guardar",
    });

    expect(service).toMatchObject({ id: "s1", nombre: "Corte", precio: 250, tiempo: "30 min" });
    expect(service).not.toHaveProperty("credential");
  });

  test("solo conserva información pública permitida de empresa y promociones", () => {
    const company = sanitizePublicCompanyInfo({ nombre: "Estética", telefono: "123", authSecret: "x" });
    const promotion = sanitizePublicPromotion({ id: "promo", titulo: "Descuento", descuento: "10%", password: "x" });

    expect(company).toMatchObject({ nombre: "Estética", telefono: "123" });
    expect(company).not.toHaveProperty("authSecret");
    expect(promotion).toMatchObject({ id: "promo", titulo: "Descuento", descuento: "10%" });
    expect(promotion).not.toHaveProperty("password");
  });
});
