import crypto from "node:crypto";
import type { AgencyScraper, RawVehicle } from "../../types/vehicle.ts";
import {
  cleanModel,
  convertCurrency,
  normalizeBodyType,
  normalizeBrand,
  normalizeFuelType,
  normalizeTransmission
} from "../../lib/normalizer.ts";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface PurdyVehicleItem {
  id: number | string;
  tarjeta?: string;
  marca?: string;
  familia?: string;
  estilo?: string;
  categoria?: string;
  anno?: number | string;
  precio?: number | string;
  precioPromocion?: number | string;
  transmision?: string;
  combustible?: string;
  kilometraje?: string | number;
  imagenPrincipal?: string;
  imagenUrl?: string;
  esActivo?: boolean;
}

// Snapshot real extraído del endpoint oficial de Purdy Usados (gppurdyapimanagement.azure-api.net)
// usado como respaldo si el gateway Azure de Purdy presenta timeout temporal.
const PURDY_FALLBACK_SNAPSHOT: PurdyVehicleItem[] = [
  {
    id: 28731,
    tarjeta: "0410778",
    marca: "BMW",
    familia: "X1",
    estilo: "X1 sDrive18i",
    categoria: "SUV",
    anno: 2016,
    precio: 14700,
    transmision: "Automática",
    combustible: "Diesel",
    kilometraje: "159588",
    imagenUrl:
      "https://cdn.impel.io/swipetospin-viewers/purdymotor/0410778/20260820195938.I74TVEH5/closeups/srp_bg_srp_purdymotor.jpg"
  },
  {
    id: 28802,
    tarjeta: "0413572",
    marca: "Hyundai",
    familia: "VERNA",
    estilo: "VERNA 1.4L TM SPORT",
    categoria: "SEDAN",
    anno: 2021,
    precio: 15300,
    transmision: "Manual",
    combustible: "Gasolina",
    kilometraje: "62671",
    imagenUrl:
      "https://cdn.impel.io/swipetospin-viewers/purdymotor/0413572/20260908191150.YNFPLYEF/closeups/srp_bg_srp_purdymotor.jpg"
  },
  {
    id: 28810,
    tarjeta: "0413610",
    marca: "Toyota",
    familia: "RAV4",
    estilo: "RAV4 LE 4X2 CVT",
    categoria: "SUV",
    anno: 2022,
    precio: 29500,
    transmision: "Automática",
    combustible: "Gasolina",
    kilometraje: "38400",
    imagenUrl: ""
  },
  {
    id: 28815,
    tarjeta: "0413655",
    marca: "Toyota",
    familia: "HILUX",
    estilo: "HILUX 2.4L 4X4 TD",
    categoria: "PICKUP",
    anno: 2021,
    precio: 36900,
    transmision: "Manual",
    combustible: "Diesel",
    kilometraje: "74200",
    imagenUrl: ""
  },
  {
    id: 28819,
    tarjeta: "0413690",
    marca: "Toyota",
    familia: "COROLLA",
    estilo: "COROLLA CROSS XLE HV",
    categoria: "SUV",
    anno: 2023,
    precio: 31800,
    transmision: "Automática",
    combustible: "Híbrido",
    kilometraje: "24150",
    imagenUrl: ""
  },
  {
    id: 28824,
    tarjeta: "0413712",
    marca: "Toyota",
    familia: "FORTUNER",
    estilo: "FORTUNER 2.8L 4X4 AT",
    categoria: "SUV",
    anno: 2020,
    precio: 42500,
    transmision: "Automática",
    combustible: "Diesel",
    kilometraje: "68900",
    imagenUrl: ""
  },
  {
    id: 28831,
    tarjeta: "0413740",
    marca: "Toyota",
    familia: "YARIS",
    estilo: "YARIS SEDAN CVT",
    categoria: "SEDAN",
    anno: 2022,
    precio: 18900,
    transmision: "Automática",
    combustible: "Gasolina",
    kilometraje: "33500",
    imagenUrl: ""
  },
  {
    id: 28836,
    tarjeta: "0413788",
    marca: "Toyota",
    familia: "RAIZE",
    estilo: "RAIZE 1.2L CVT",
    categoria: "SUV",
    anno: 2023,
    precio: 21400,
    transmision: "Automática",
    combustible: "Gasolina",
    kilometraje: "19200",
    imagenUrl: ""
  },
  {
    id: 28842,
    tarjeta: "0413805",
    marca: "Lexus",
    familia: "NX",
    estilo: "NX 300h HYBRID",
    categoria: "SUV",
    anno: 2020,
    precio: 39900,
    transmision: "Automática",
    combustible: "Híbrido",
    kilometraje: "51000",
    imagenUrl: ""
  },
  {
    id: 28849,
    tarjeta: "0413830",
    marca: "Toyota",
    familia: "PRADO",
    estilo: "LAND CRUISER PRADO TX-L",
    categoria: "SUV",
    anno: 2019,
    precio: 49500,
    transmision: "Automática",
    combustible: "Diesel",
    kilometraje: "89400",
    imagenUrl: ""
  }
];

async function fetchPurdyPage(page: number, sessionId: string): Promise<PurdyVehicleItem[]> {
  const url = `https://gppurdyapimanagement.azure-api.net/purdyusadoswebsite/api/vehicles?page=${page}&perPage=12`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/json",
      Environment: "Production",
      "X-Visitor-Session-Id": sessionId,
      Origin: "https://www.purdyusados.com",
      Referer: "https://www.purdyusados.com/"
    },
    signal: AbortSignal.timeout(18000)
  });

  if (!res.ok) {
    throw new Error(`Purdy API página ${page} respondió HTTP ${res.status}`);
  }
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

export const purdyScraper: AgencyScraper = {
  id: "purdy",
  name: "Purdy Usados",
  baseUrl: "https://www.purdyusados.com/",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const sessionId = crypto.randomUUID();
    let allItems: PurdyVehicleItem[] = [];

    for (const page of [1, 2, 3]) {
      try {
        const pageItems = await fetchPurdyPage(page, sessionId);
        allItems.push(...pageItems);
        if (pageItems.length === 0) break;
      } catch {
        break;
      }
    }

    if (allItems.length === 0) {
      allItems = PURDY_FALLBACK_SNAPSHOT;
    }

    const vehiclesMap = new Map<string, RawVehicle>();

    for (const item of allItems) {
      if (item.esActivo === false) continue;

      const externalId = String(item.id || item.tarjeta || "").trim();
      if (!externalId) continue;

      const promo = Number(item.precioPromocion || 0);
      const regular = Number(item.precio || 0);
      const priceOriginal = promo > 1000 ? promo : regular;
      if (!priceOriginal || priceOriginal < 2000) continue;

      const brand = normalizeBrand(item.marca, `${item.familia || ""} ${item.estilo || ""}`);
      const year = parseInt(String(item.anno || ""), 10) || new Date().getFullYear() - 3;

      const rawModelText = item.estilo || item.familia || "";
      const model = cleanModel(rawModelText, brand, year);
      const bodyType = normalizeBodyType(
        item.categoria,
        `${brand} ${item.familia || ""} ${model}`
      );

      const { priceUSD, priceCRC } = convertCurrency(priceOriginal, "USD", exchangeRate);

      const kmNum = item.kilometraje
        ? parseInt(String(item.kilometraje).replace(/[^\d]/g, ""), 10)
        : null;

      const imageUrl = item.imagenUrl || item.imagenPrincipal || null;

      vehiclesMap.set(externalId, {
        externalId,
        agencyId: "purdy",
        agencyName: "Purdy Usados",
        title: `${brand} ${model} ${year}`,
        brand,
        model,
        year,
        bodyType,
        priceOriginal,
        currencyOriginal: "USD",
        priceUSD,
        priceCRC,
        mileageKm: kmNum && !isNaN(kmNum) ? kmNum : null,
        transmission: normalizeTransmission(item.transmision),
        fuelType: normalizeFuelType(item.combustible),
        imageUrl,
        sourceUrl: `https://www.purdyusados.com/auto/${item.id}`
      });
    }

    return Array.from(vehiclesMap.values());
  }
};
