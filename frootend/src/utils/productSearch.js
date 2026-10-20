const VOICE_COMMAND_WORDS = new Set([
  "a",
  "al",
  "algo",
  "algun",
  "alguna",
  "algunos",
  "algunas",
  "busca",
  "buscar",
  "buscame",
  "con",
  "cual",
  "cuales",
  "dame",
  "de",
  "del",
  "di",
  "donde",
  "el",
  "en",
  "encuentra",
  "encontrar",
  "encuentrame",
  "ensena",
  "ensenar",
  "ensename",
  "esta",
  "este",
  "estos",
  "estas",
  "favor",
  "hay",
  "la",
  "las",
  "lo",
  "los",
  "me",
  "mi",
  "muestra",
  "mostrar",
  "muestrame",
  "necesito",
  "para",
  "podrias",
  "por",
  "porfa",
  "que",
  "quiero",
  "quisiera",
  "tener",
  "tienen",
  "tienes",
  "un",
  "una",
  "unos",
  "unas",
  "ver",
  "y",
]);

const GENERIC_CATALOG_WORDS = new Set([
  "articulo",
  "articulos",
  "catalogo",
  "linea",
  "marca",
  "producto",
  "productos",
]);

const HAIR_CONTEXT_WORDS = new Set(["cabello", "pelo"]);

const TOKEN_ALIASES = {
  cabellera: "cabello",
  cabellos: "cabello",
  champu: "shampoo",
  champus: "shampoo",
  cheratina: "queratina",
  ialuronico: "hialuronico",
  mascara: "mascarilla",
  mascaras: "mascarilla",
  mascarilla: "mascarilla",
  mascarillas: "mascarilla",
  maschera: "mascarilla",
  mascheras: "mascarilla",
  pelos: "pelo",
  shampu: "shampoo",
  shampoos: "shampoo",
};

const SEARCH_FIELDS = [
  { key: "nombre", weight: 12, primary: true },
  { key: "categoria", weight: 8, primary: true },
  { key: "marca", weight: 6, primary: true },
  { key: "descripcion", weight: 2, primary: false },
];

/**
 * Makes typed and dictated Spanish comparable without changing the text shown
 * in the search box. For example, "champú de argán" becomes
 * "champu de argan" before its meaningful tokens are extracted.
 */
export function normalizeProductSearchText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function canonicalizeToken(token) {
  return TOKEN_ALIASES[token] || token;
}

function unique(tokens) {
  return Array.from(new Set(tokens));
}

export function getProductSearchTokens(query) {
  const normalized = normalizeProductSearchText(query);
  if (!normalized) return [];

  const withoutCommands = normalized
    .split(" ")
    .filter(Boolean)
    .map(canonicalizeToken)
    .filter((token) => !VOICE_COMMAND_WORDS.has(token))
    .filter((token) => !GENERIC_CATALOG_WORDS.has(token));

  // In phrases such as "shampoo para cabello", "cabello" describes the
  // destination rather than narrowing the product line. It remains useful on
  // its own, where it correctly matches the Cabello category.
  const withoutHairContext = withoutCommands.length > 1
    ? withoutCommands.filter((token) => !HAIR_CONTEXT_WORDS.has(token))
    : withoutCommands;

  return unique(withoutHairContext.length ? withoutHairContext : withoutCommands);
}

function buildFieldIndex(value) {
  const text = normalizeProductSearchText(value);
  return {
    text,
    tokens: unique(text.split(" ").filter(Boolean).map(canonicalizeToken)),
  };
}

function getTokenMatchQuality(queryToken, field) {
  if (field.tokens.includes(queryToken)) return 1;

  // Preserve the useful behavior of manual partial searches ("plati",
  // "ialuro") while keeping matches inside a word, not across arbitrary text.
  if (queryToken.length >= 3 && field.tokens.some((token) => token.startsWith(queryToken))) {
    return 0.75;
  }

  return 0;
}

function rankProduct(product, queryTokens, originalIndex) {
  const fields = SEARCH_FIELDS.map((definition) => ({
    ...definition,
    ...buildFieldIndex(product?.[definition.key]),
  }));

  let score = 0;
  let matchesAllFields = true;
  let matchesAllPrimaryFields = true;

  queryTokens.forEach((queryToken) => {
    const matches = fields
      .map((field) => ({ field, quality: getTokenMatchQuality(queryToken, field) }))
      .filter(({ quality }) => quality > 0);

    if (!matches.length) {
      matchesAllFields = false;
      matchesAllPrimaryFields = false;
      return;
    }

    const bestMatch = matches.reduce((best, current) => {
      const currentScore = current.field.weight * current.quality;
      const bestScore = best.field.weight * best.quality;
      return currentScore > bestScore ? current : best;
    });

    score += bestMatch.field.weight * bestMatch.quality;
    if (!matches.some(({ field }) => field.primary)) matchesAllPrimaryFields = false;
  });

  return {
    product,
    originalIndex,
    score,
    matchesAllFields,
    matchesAllPrimaryFields,
  };
}

/**
 * Filters and ranks products for both typed text and a full speech transcript.
 * Identity fields (name, category and brand) win over incidental mentions in
 * descriptions. Descriptions are still used as a fallback for useful searches
 * such as "anti frizz" or "protección térmica".
 */
export function filterProductsBySearch(products, query) {
  const productList = Array.isArray(products) ? products : [];
  const queryTokens = getProductSearchTokens(query);
  if (!queryTokens.length) return productList;

  const rankedMatches = productList
    .map((product, originalIndex) => rankProduct(product, queryTokens, originalIndex))
    .filter((entry) => entry.matchesAllFields);

  const primaryMatches = rankedMatches.filter((entry) => entry.matchesAllPrimaryFields);
  const relevantMatches = primaryMatches.length ? primaryMatches : rankedMatches;

  return relevantMatches
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)
    .map((entry) => entry.product);
}
