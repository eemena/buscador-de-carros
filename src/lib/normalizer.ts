import type { BodyType, Currency } from "../types/vehicle.ts";

export const DEFAULT_EXCHANGE_RATE = 515; // ₡515 por $1 USD

const BRAND_MAP: Record<string, string> = {
  toyota: "Toyota",
  honda: "Honda",
  nissan: "Nissan",
  hyundai: "Hyundai",
  kia: "Kia",
  mitsubishi: "Mitsubishi",
  mitsibishi: "Mitsubishi",
  suzuki: "Suzuki",
  mazda: "Mazda",
  ford: "Ford",
  chevrolet: "Chevrolet",
  volkswagen: "Volkswagen",
  vw: "Volkswagen",
  audi: "Audi",
  bmw: "BMW",
  "mercedes-benz": "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
  "mercedez benz": "Mercedes-Benz",
  "mercedez-benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  mercedez: "Mercedes-Benz",
  jeep: "Jeep",
  ram: "RAM",
  dodge: "Dodge",
  subaru: "Subaru",
  isuzu: "Isuzu",
  lexus: "Lexus",
  volvo: "Volvo",
  porsche: "Porsche",
  "land rover": "Land Rover",
  "range rover": "Land Rover",
  mini: "MINI",
  peugeot: "Peugeot",
  renault: "Renault",
  citroen: "Citroën",
  citroën: "Citroën",
  fiat: "Fiat",
  chery: "Chery",
  geely: "Geely",
  byd: "BYD",
  mg: "MG",
  gac: "GAC",
  changan: "Changan",
  haval: "Haval",
  "great wall": "Great Wall",
  jac: "JAC",
  dfsk: "DFSK",
  ssangyong: "SsangYong",
  kgm: "KGM",
  jmc: "JMC",
  foton: "Foton",
  maxus: "Maxus",
  omoda: "Omoda",
  jaecoo: "Jaecoo",
  zeekr: "Zeekr",
  tesla: "Tesla",
  cadillac: "Cadillac",
  baic: "BAIC",
  kaiyi: "Kaiyi",
  forland: "Forland",
  arcfox: "Arcfox",
  vgv: "VGV",
  bolden: "Bolden",
  gmc: "GMC",
  acura: "Acura",
  infiniti: "Infiniti",
  lincoln: "Lincoln",
  maserati: "Maserati",
  jaguar: "Jaguar",
  daihatsu: "Daihatsu",
  faw: "FAW",
  jetour: "Jetour",
  "lynk & co": "Lynk & Co",
  "lynk and co": "Lynk & Co",
  "lynk&co": "Lynk & Co",
  "link & co": "Lynk & Co",
  "link and co": "Lynk & Co",
  lynk: "Lynk & Co"
};

export function normalizeBrand(rawBrand?: string | null, titleFallback?: string): string {
  const candidate = (rawBrand || "").trim().toLowerCase();
  if (candidate && BRAND_MAP[candidate]) {
    return BRAND_MAP[candidate];
  }
  if (candidate) {
    for (const [key, val] of Object.entries(BRAND_MAP)) {
      if (candidate.includes(key)) return val;
    }
    return rawBrand!
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  if (titleFallback) {
    const lowerTitle = titleFallback.toLowerCase();
    for (const [key, val] of Object.entries(BRAND_MAP)) {
      const regex = new RegExp(`\\b${key.replace("-", "[-\\s]?")}\\b`, "i");
      if (regex.test(lowerTitle)) return val;
    }
  }
  return "Otra";
}

export function cleanModel(rawModel: string, brand: string, year?: number): string {
  let m = (rawModel || "").trim();
  const brandEscaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const brandRegex = new RegExp(`^${brandEscaped}\\s+`, "i");
  m = m.replace(brandRegex, "");
  m = m.replace(/^(mitsibishi|mercedez[\s-]*benz|mercedes[\s-]*benz|link\s*&\s*co|lynk\s*&\s*co)\s+/i, "");
  if (year) {
    m = m.replace(new RegExp(`\\b${year}\\b`, "g"), "");
  }
  m = m.replace(/\s+/g, " ").trim();
  return m || "Modelo General";
}

export function normalizeBodyType(rawType?: string | null, titleAndModel?: string): BodyType {
  const combined = `${rawType || ""} ${titleAndModel || ""}`.toLowerCase();

  if (
    /\b(pick[\s-]?up|pickup|doble cabina|cabina sencilla|hilux|frontier|np300|l200|triton|ranger|amarok|d-max|dmax|colorado|silverado|f-150|f150|ram 1500|ram 700|bt-50|bt50|poer|wingle|t60|vigorous|saveiro|strada|maverick|gladiator|tacoma|tundra)\b/i.test(
      combined
    )
  ) {
    return "Pick-up";
  }

  if (
    /\b(van|panel|microbus|microbús|furgon|furgón|comercial|camion|camión|hiace|urvan|staria|h-1|h1|k2500|k2700|sprinter|vito|kangoo|partner|berlingo|n300|town|transporter|crafter)\b/i.test(
      combined
    )
  ) {
    return "Van / Comercial";
  }

  if (/\b(coupe|coupé|convertible|cabrio|mustang|camaro|corvette|911|cayman|boxster|brz|86|supra|z4|tt)\b/i.test(combined)) {
    return "Coupe";
  }

  if (/\b(crossover|cuv|raize|kicks|venue|kona|wr-v|wrv|nivus|taigun|t-cross|tcross|fronx|s-presso|spresso|cx-3|cx3|cx-30|cx30|corolla cross|hr-v|hrv|yariscross|yaris cross|soul|seltos|groove|tracker|trax|captiva|duster|stepway|tiggo 2|tiggo 4|coolray|gx3)\b/i.test(combined)) {
    if (rawType && /crossover/i.test(rawType)) return "Crossover";
  }

  if (
    /\b(suv|4x4|todo[\s-]*terreno|todoterreno|station[\s-]*wagon|camioneta|rav4|rav-4|cr-v|crv|pilot|passport|tucson|santa fe|palisade|creta|venue|kona|sportage|sorento|seltos|sonet|ev3|ev5|ev6|ev9|niro|x-trail|xtrail|qashqai|kicks|pathfinder|patrol|murano|terra|prado|fortuner|4runner|land cruiser|rush|raize|corolla cross|highlander|sequoia|montero|outlander|asx|eclipse cross|xpander|x-pander|vitara|grand vitara|jimny|s-cross|scross|fronx|cx-5|cx5|cx-30|cx30|cx-60|cx60|cx-9|cx9|cx-90|escape|explorer|bronco|edge|expedition|territory|ecosport|tracker|trailblazer|tahoe|suburban|equinox|captiva|blazer|groove|tiguan|taos|t-cross|tcross|touareg|teramont|nivus|q2|q3|q5|q7|q8|e-tron|x1|x2|x3|x4|x5|x6|x7|ix|gla|glb|glc|gle|gls|eqa|eqb|eqc|eqe|g-class|wrangler|cherokee|grand cherokee|grand cherooke|compass|renegade|longitude|forester|outback|xv|crosstrek|evoltis|mux|mu-x|rx|nx|ux|gx|lx|xc40|xc60|xc90|ex30|ex 30|macan|cayenne|defender|discovery|evoque|velar|2008|3008|5008|koleos|duster|kardian|arkana|tiggo|coolray|azkarra|okavango|starray|ex5|geometry|yuan|song|tang|zs|hs|rx5|marvel r|gs3|gs4|gs8|cs15|cs35|cs55|jolion|h6|dargo|js2|js3|js4|js6|js8|glory|korando|rexton|torres|tivoli|omoda|jaecoo|dashing|x50|x70|t2|t77|lynk)\b/i.test(
      combined
    )
  ) {
    return "SUV";
  }

  if (
    /\b(hatchback|hatch|compacto|picanto|morning|grand i10|i10|i20|swift|baleno|celerio|ignis|alto|s-presso|march|tiida|fit|jazz|yaris hb|agya|aygo|golf|polo|up|fabia|ibiza|leon|a1|serie 1|118i|120i|clase a|a200|a250|cooper|208|clio|kwid|sandero|500|mobi|argo|dolphin|seagull|mg3)\b/i.test(
      combined
    )
  ) {
    return "Hatchback";
  }

  if (
    /\b(sedan|sedán|automovil|automóvil|corolla|camry|yaris|civic|accord|city|sentra|versa|altima|tiida|almera|elantra|accent|sonata|grand i10 sedan|visto|rio|cerato|forte|soluto|optima|k3|lancer|mirage g4|attrage|ciaz|dzire|mazda 2|mazda 3|mazda 6|jetta|virtus|vento|passat|bora|voyage|a3|a4|a5|a6|a7|a8|serie 2|serie 3|serie 4|serie 5|318i|320i|328i|330i|520i|530i|clase c|clase e|clase s|c180|c200|c250|c300|cla|e200|e300|impreza|legacy|s60|s90|301|logan|cronos|arrizo|emgrand|mg5|mg gt|alvin|alsvin)\b/i.test(
      combined
    )
  ) {
    return "Sedán";
  }

  return "Otro";
}

export function normalizeTransmission(raw?: string | null): string {
  if (!raw) return "Automático";
  const lower = raw.toLowerCase();
  if (/\b(man|manual|m\/t|mt|mecanico|mecánico|mec)\b/.test(lower)) {
    return "Manual";
  }
  if (/\b(cvt|iv-t|ivt)\b/.test(lower)) {
    return "Automático (CVT)";
  }
  return "Automático";
}

export function normalizeFuelType(raw?: string | null): string {
  if (!raw) return "Gasolina";
  const lower = raw.toLowerCase();
  if (/\b(elec|eléc|electrico|eléctrico|ev|bev)\b/.test(lower)) return "Eléctrico";
  if (/\b(hib|híb|hibrido|híbrido|hev|phev|hybrid)\b/.test(lower)) return "Híbrido";
  if (/\b(die|dié|diesel|diésel|tdi|crdi|d4d)\b/.test(lower)) return "Diésel";
  return "Gasolina";
}

const KNOWN_MODEL_ENGINES: Array<{ pattern: RegExp; engine: string }> = [
  { pattern: /\b(e-tron|ev|bev|dolphin|seagull|yuan|tang|song|ix|eqa|eqb|eqc|eqe|bz4x)\b/i, engine: "Eléctrico" },
  { pattern: /\b(hilux|fortuner|prado)\b.*\b2[.,]8/i, engine: "2.8L (2800 cc)" },
  { pattern: /\b(hilux|fortuner)\b/i, engine: "2.4L / 2.8L (2400-2800 cc)" },
  { pattern: /\b(l200|montero\s*sport)\b/i, engine: "2.4L (2400 cc)" },
  { pattern: /\b(d-max|dmax|mu-x|mux)\b.*\b3[.,]0/i, engine: "3.0L (3000 cc)" },
  { pattern: /\b(d-max|dmax)\b/i, engine: "2.5L / 3.0L" },
  { pattern: /\b(frontier|np300|x-trail|xtrail|outlander|rav4\s*h[ií]brido|cx-5\s*2\.5)\b/i, engine: "2.5L (2500 cc)" },
  { pattern: /\b(rav4|corolla|corolla\s*cross|qashqai|tucson|sportage|cx-5|cx-30|xv|forester|sentra|cerato|elantra|hr-v|hrv|zr-v)\b/i, engine: "2.0L (2000 cc)" },
  { pattern: /\b(cr-v|crv|civic|coolray|tiggo\s*7|tiggo\s*8|hs|jolion|h6)\b/i, engine: "1.5L Turbo (1500 cc)" },
  { pattern: /\b(yaris|rush|avanza|ertiga|xl7|creta|seltos|sonet|carens|city|wr-v|fit|versa|almera|baleno|fronx|jimny|zs)\b/i, engine: "1.5L (1500 cc)" },
  { pattern: /\b(vitara|s-cross|scross|kicks|march|tiida|accent|rio|soluto|venue)\b/i, engine: "1.6L (1600 cc)" },
  { pattern: /\b(tiguan|taos|q3|golf|jetta|t-cross|nivus|verna|swift\s*boosterjet)\b/i, engine: "1.4L (1400 cc)" },
  { pattern: /\b(raize|grand\s*i10|i10|picanto|swift|ignis|kwid)\b/i, engine: "1.2L (1200 cc)" },
  { pattern: /\b(alto|s-presso|spresso|celerio)\b/i, engine: "1.0L (1000 cc)" },
  { pattern: /\b(q5|x3|glc|a4|320i|330i|c200|c300|amarok|ranger)\b/i, engine: "2.0L Turbo (2000 cc)" },
  { pattern: /\b(pilot|passport|highlander|4runner|pathfinder|santa\s*fe\s*v6|montero\s*v6)\b/i, engine: "3.5L (3500 cc)" }
];

export function normalizeEngine(
  rawEngine?: string | number | null,
  fallbackContext?: string | null,
  fuelType?: string | null
): string {
  const combined = `${rawEngine ?? ""} ${fallbackContext ?? ""}`.trim();

  if (fuelType && /el[eé]ctrico/i.test(fuelType)) {
    return "Eléctrico";
  }

  // 1. Explicit cc like "2000 cc", "2,500cc", "1500 c.c.", "2400cc"
  const ccExplicit = combined.match(/\b([1-6][.,]?\d{3})\s*(?:cc|c\.c\.|cm3)\b/i);
  if (ccExplicit && ccExplicit[1]) {
    const cc = parseInt(ccExplicit[1].replace(/[.,]/g, ""), 10);
    if (cc >= 800 && cc <= 6800) {
      const liters = (cc / 1000).toFixed(1);
      return `${liters}L (${cc} cc)`;
    }
  }

  // 2. Explicit liters like "1.5L", "2.0 L", "2.4T", "1.5 Turbo", "2.8 TD", or standalone decimal "1.5", "2.0", "2.5"
  const literMatch = combined.match(/\b([0-6][.,]\d)\s*(l|lt|lts|litros|t|turbo|td|tdi|crdi|tsi|tfsi)?\b/i);
  if (literMatch && literMatch[1]) {
    const litersFloat = parseFloat(literMatch[1].replace(",", "."));
    if (litersFloat >= 0.8 && litersFloat <= 6.8) {
      const cc = Math.round(litersFloat * 1000);
      const isTurbo =
        /\b(t|turbo|td|tdi|tsi|tfsi)\b/i.test(literMatch[2] || "") ||
        /\bturbo\b/i.test(combined);
      return `${litersFloat.toFixed(1)}L${isTurbo ? " Turbo" : ""} (${cc} cc)`;
    }
  }

  // 3. Bare 4-digit engine sizes commonly written in titles/specs (1000, 1200, 1300, 1400, 1500, 1600, 1800, 2000, 2200, 2400, 2500, 2700, 2800, 3000, 3200, 3500, 4000)
  const bareCcMatch = combined.match(
    /\b(1000|1200|1300|1400|1500|1600|1800|2200|2400|2500|2700|2800|3000|3200|3500|4000)\b/
  );
  if (bareCcMatch && bareCcMatch[1]) {
    const cc = parseInt(bareCcMatch[1], 10);
    // Avoid matching vehicle year if year is 2000
    const liters = (cc / 1000).toFixed(1);
    return `${liters}L (${cc} cc)`;
  }

  // 4. Infer from well-known model specifications in Costa Rica if not explicitly in title
  for (const entry of KNOWN_MODEL_ENGINES) {
    if (entry.pattern.test(combined)) {
      return entry.engine;
    }
  }

  return "N/D";
}

export function convertCurrency(
  amount: number,
  currency: Currency,
  exchangeRate: number = DEFAULT_EXCHANGE_RATE
): { priceUSD: number; priceCRC: number } {
  const rate = exchangeRate > 0 ? exchangeRate : DEFAULT_EXCHANGE_RATE;
  if (currency === "USD") {
    return {
      priceUSD: Math.round(amount),
      priceCRC: Math.round(amount * rate)
    };
  } else {
    return {
      priceUSD: Math.round(amount / rate),
      priceCRC: Math.round(amount)
    };
  }
}

export function parsePriceText(rawText: string, exchangeRate: number = DEFAULT_EXCHANGE_RATE): {
  priceOriginal: number;
  currencyOriginal: Currency;
  priceUSD: number;
  priceCRC: number;
} | null {
  if (!rawText) return null;
  const cleaned = rawText.replace(/\s+/g, " ").trim();

  const isCRC = /[₡¢]|colones|\bcrc\b/i.test(cleaned) && !/\$|usd|d[oó]lares/i.test(cleaned);
  const isUSD = /\$|\busd\b|d[oó]lares/i.test(cleaned);

  // Extract numbers
  const numberMatches = cleaned.match(/[\d.,]+/g);
  if (!numberMatches) return null;

  for (const numStr of numberMatches) {
    // Remove thousand separators
    let normalized = numStr.replace(/[^\d.,]/g, "");
    // Handle decimals if ends with .00 or ,00
    normalized = normalized.replace(/[.,]\d{2}$/, "");
    normalized = normalized.replace(/[.,]/g, "");
    const value = parseInt(normalized, 10);
    if (isNaN(value) || value < 1500) continue;

    // Heuristic: In Costa Rica, used cars in USD are typically $3,000 - $250,000.
    // Used cars in CRC are typically ₡1,500,000 - ₡150,000,000.
    let currency: Currency = "USD";
    if (value >= 1200000) {
      currency = "CRC";
    } else if (isCRC && value >= 500000) {
      currency = "CRC";
    } else if (isUSD || value < 500000) {
      currency = "USD";
    }

    const { priceUSD, priceCRC } = convertCurrency(value, currency, exchangeRate);
    if (priceUSD < 2000 || priceUSD > 350000) continue;

    return {
      priceOriginal: value,
      currencyOriginal: currency,
      priceUSD,
      priceCRC
    };
  }

  return null;
}
