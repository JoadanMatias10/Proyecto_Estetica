import {
  filterProductsBySearch,
  getProductSearchTokens,
  normalizeProductSearchText,
} from "./productSearch";

const PRODUCTS = [
  {
    id: "argan-shampoo",
    nombre: "SHAMPOO DI ARGAN",
    marca: "Avyna",
    categoria: "Cabello",
    descripcion: "Nutrición intensa y brillo para la fibra capilar.",
  },
  {
    id: "platino-shampoo",
    nombre: "Shampoo Platino",
    marca: "Avyna",
    categoria: "Coloración",
    descripcion: "Matiza reflejos amarillos de cabellos rubios.",
  },
  {
    id: "argan-mask",
    nombre: "MASCHERA DI ARGAN",
    marca: "Avyna",
    categoria: "Cabello",
    descripcion: "Mascarilla de hidratación intensiva.",
  },
  {
    id: "agave-lotion",
    nombre: "Lozione Di Agave",
    marca: "Avyna",
    categoria: "Cuidado del Cuero Cabelludo",
    descripcion: "Se aplica a través del shampoo para purificar el cuero cabelludo.",
  },
  {
    id: "argan-fluid",
    nombre: "Lisciante di Argan",
    marca: "Avyna",
    categoria: "Cabello",
    descripcion: "Control anti frizz y protección térmica para secadora.",
  },
  {
    id: "other-brand",
    nombre: "Gel Extra Forte",
    marca: "Otra Marca",
    categoria: "Peinado y Styling",
    descripcion: "Fijación fuerte.",
  },
];

describe("productSearch", () => {
  test("normaliza mayúsculas, acentos, puntuación y etiquetas", () => {
    expect(normalizeProductSearchText("<b>Champú de ARGÁN</b> ¿sí?")).toBe("champu de argan si");
  });

  test("extrae los términos útiles de una frase natural de voz", () => {
    expect(getProductSearchTokens("Búscame un champú para el cabello, por favor")).toEqual(["shampoo"]);
  });

  test("encuentra shampoo de argán aunque el dictado use champú y acentos", () => {
    expect(filterProductsBySearch(PRODUCTS, "Muéstrame champú de argán").map(({ id }) => id)).toEqual([
      "argan-shampoo",
    ]);
  });

  test("una frase genérica para cabello devuelve shampoos por nombre, no menciones incidentales", () => {
    expect(filterProductsBySearch(PRODUCTS, "busca shampoo para cabello").map(({ id }) => id)).toEqual([
      "argan-shampoo",
      "platino-shampoo",
    ]);
  });

  test("admite búsqueda manual parcial y sin acento", () => {
    expect(filterProductsBySearch(PRODUCTS, "plati").map(({ id }) => id)).toEqual(["platino-shampoo"]);
    expect(filterProductsBySearch(PRODUCTS, "coloracion").map(({ id }) => id)).toEqual([
      "platino-shampoo",
    ]);
  });

  test("usa la descripción como respaldo cuando no hay coincidencias de identidad", () => {
    expect(filterProductsBySearch(PRODUCTS, "anti frizz").map(({ id }) => id)).toEqual(["argan-fluid"]);
  });

  test("busca también por marca y conserva el orden original si no hay consulta", () => {
    expect(filterProductsBySearch(PRODUCTS, "marca otra marca").map(({ id }) => id)).toEqual([
      "other-brand",
    ]);
    expect(filterProductsBySearch(PRODUCTS, "")).toEqual(PRODUCTS);
  });
});
