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

const DEFAULT_BEARER =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vZGV2LXZlaW5zYW1vdG9ycy1zdGFnLmF6dXJld2Vic2l0ZXMubmV0IiwiaWF0IjoxNzEwODU4MzIwLCJuYmYiOjE3MTA4NTgzMjAsImV4cCI6MTcxMTQ2MzEyMCwiZGF0YSI6eyJ1c2VyIjp7ImlkIjozLCJkZXZpY2UiOiIiLCJwYXNzIjoiZjE0OGJlNWRhNWVkODVmYzc0MjA1NTI4Yjg5NDI0YjUifX19.x8qFI_eQsBbVBRzeLiFgueSeYRUGKt221n5FULwaX94";

interface VeinsaRawCar {
  item?: string;
  placa?: string;
  estado_2?: string;
  foto_frontal_1?: string;
  foto_frontal_2?: string;
  precio_lista?: string | number;
  precio_promocional?: string | number;
  marca?: string;
  modelo?: string;
  marca_modelo?: string;
  ano?: string | number;
  transmision?: string;
  combustible?: string;
  kilometraje?: string | number;
  estilo?: string;
  categoria?: string;
}

function buildVeinsaSlug(marca: string, modelo: string, placa: string): string {
  const base = `${marca} ${modelo}`
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return `${base}-${placa}`;
}

export const veinsaScraper: AgencyScraper = {
  id: "veinsa",
  name: "Veinsa Usados",
  baseUrl: "https://veinsausados.com/",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const res = await fetch(
      "https://veinsausados.com/wp-json/veinsausados/v1/home-veinsausados?limit=-1",
      {
        headers: {
          "User-Agent": USER_AGENT,
          Authorization: `Bearer ${DEFAULT_BEARER}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!res.ok) {
      throw new Error(`Veinsa API respondió HTTP ${res.status}`);
    }

    const data = await res.json();
    const home = data?.home || {};

    const buckets: Array<{ key: string; hintType?: string; cars: VeinsaRawCar[] }> = [
      { key: "featured_cars", cars: home.featured_cars?.cars || [] },
      { key: "veinsamotors_cars", cars: home.veinsamotors_cars?.cars || [] },
      { key: "premium_cars", cars: home.premium_cars?.cars || [] },
      { key: "pickup_cars", hintType: "Pick-up", cars: home.pickup_cars?.cars || [] },
      { key: "commercials_cars", hintType: "Van / Comercial", cars: home.commercials_cars?.cars || [] },
      { key: "electric_cars", hintType: "Eléctrico", cars: home.electric_cars?.cars || [] }
    ];

    const vehiclesMap = new Map<string, RawVehicle>();

    for (const bucket of buckets) {
      if (!Array.isArray(bucket.cars)) continue;
      for (const car of bucket.cars) {
        const externalId = String(car.placa || car.item || "").trim();
        if (!externalId) continue;

        const promo = parseFloat(String(car.precio_promocional || "0").replace(/[^\d.]/g, ""));
        const lista = parseFloat(String(car.precio_lista || "0").replace(/[^\d.]/g, ""));
        const priceOriginal = promo > 1000 ? promo : lista;
        if (!priceOriginal || priceOriginal < 2000) continue;

        const brand = normalizeBrand(car.marca, car.marca_modelo);
        const year = parseInt(String(car.ano || ""), 10) || new Date().getFullYear() - 3;
        const model = cleanModel(car.modelo || car.marca_modelo || "", brand, year);

        const bodyType = normalizeBodyType(
          bucket.hintType === "Pick-up" || bucket.hintType === "Van / Comercial"
            ? bucket.hintType
            : car.estilo || car.categoria,
          `${brand} ${model}`
        );

        const { priceUSD, priceCRC } = convertCurrency(priceOriginal, "USD", exchangeRate);
        const slug = buildVeinsaSlug(car.marca || brand, car.modelo || model, externalId);
        const sourceUrl = `https://veinsausados.com/caracteristica-del-vehiculo/${slug}`;

        const imageUrl =
          car.foto_frontal_1 || car.foto_frontal_2 || null;

        const fuelType =
          bucket.hintType === "Eléctrico"
            ? "Eléctrico"
            : normalizeFuelType(car.combustible);

        const kmRaw = car.kilometraje ? parseInt(String(car.kilometraje).replace(/[^\d]/g, ""), 10) : null;

        vehiclesMap.set(externalId, {
          externalId,
          agencyId: "veinsa",
          agencyName: "Veinsa Usados",
          title: `${brand} ${model} ${year}`,
          brand,
          model,
          year,
          bodyType,
          priceOriginal,
          currencyOriginal: "USD",
          priceUSD,
          priceCRC,
          mileageKm: kmRaw && !isNaN(kmRaw) ? kmRaw : null,
          transmission: normalizeTransmission(car.transmision),
          fuelType,
          imageUrl,
          sourceUrl
        });
      }
    }

    return Array.from(vehiclesMap.values());
  }
};
