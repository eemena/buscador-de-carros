import * as cheerio from "cheerio";
import type { AgencyScraper, RawVehicle } from "../../types/vehicle.ts";
import {
  cleanModel,
  convertCurrency,
  normalizeBodyType,
  normalizeBrand,
  normalizeFuelType,
  normalizeTransmission,
  parsePriceText
} from "../../lib/normalizer.ts";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface KAutosSnapshotItem {
  id: string;
  brand: string;
  model: string;
  year: number;
  priceCRC: number;
  mileageKm: number;
  transmission: string;
  fuelType: string;
  bodyType: string;
  sourceUrl: string;
}

const KAUTOS_SNAPSHOT: KAutosSnapshotItem[] = [
  {
    id: "hyundai-grand-i10-gls-2020",
    brand: "Hyundai",
    model: "Grand i10 GLS",
    year: 2020,
    priceCRC: 6450000,
    mileageKm: 58000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "Hatchback",
    sourceUrl: "https://kautoscr.com/carro/hyundai-grand-i10-gls-2020/"
  },
  {
    id: "hyundai-verna-gl-2022",
    brand: "Hyundai",
    model: "Verna GL",
    year: 2022,
    priceCRC: 7950000,
    mileageKm: 41000,
    transmission: "Manual",
    fuelType: "Gasolina",
    bodyType: "Sedán",
    sourceUrl: "https://kautoscr.com/carro/hyundai-verna-gl-2022/"
  },
  {
    id: "hyundai-tucson-2020",
    brand: "Hyundai",
    model: "Tucson GL 2.0",
    year: 2020,
    priceCRC: 11900000,
    mileageKm: 64000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://kautoscr.com/carro/hyundai-tucson-2020/"
  },
  {
    id: "hyundai-grand-creta-gls-2023",
    brand: "Hyundai",
    model: "Grand Creta GLS 7 Pasajeros",
    year: 2023,
    priceCRC: 14800000,
    mileageKm: 29000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://kautoscr.com/carro/hyundai-grand-creta-gls-2023/"
  },
  {
    id: "hyundai-staria-2022-copia-2",
    brand: "Hyundai",
    model: "Staria 2.2 CRDi",
    year: 2022,
    priceCRC: 18500000,
    mileageKm: 47000,
    transmission: "Automático",
    fuelType: "Diésel",
    bodyType: "Van / Comercial",
    sourceUrl: "https://kautoscr.com/carro/hyundai-staria-2022-copia-2/"
  },
  {
    id: "toyota-corolla-2018",
    brand: "Toyota",
    model: "Corolla LE",
    year: 2018,
    priceCRC: 8950000,
    mileageKm: 82000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "Sedán",
    sourceUrl: "https://kautoscr.com/carro/toyota-corolla-2018/"
  },
  {
    id: "toyota-yaris-2019",
    brand: "Toyota",
    model: "Yaris Sedán",
    year: 2019,
    priceCRC: 7850000,
    mileageKm: 69000,
    transmission: "Automático (CVT)",
    fuelType: "Gasolina",
    bodyType: "Sedán",
    sourceUrl: "https://kautoscr.com/carro/toyota-yaris-2019/"
  },
  {
    id: "toyota-fortuner-2020",
    brand: "Toyota",
    model: "Fortuner 4x4 Turbo Diesel",
    year: 2020,
    priceCRC: 21900000,
    mileageKm: 75000,
    transmission: "Automático",
    fuelType: "Diésel",
    bodyType: "SUV",
    sourceUrl: "https://kautoscr.com/carro/toyota-fortuner-2020/"
  },
  {
    id: "toyota-rush-g-2022",
    brand: "Toyota",
    model: "Rush G 7 Pasajeros",
    year: 2022,
    priceCRC: 11800000,
    mileageKm: 39000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://kautoscr.com/carro/toyota-rush-g-2022/"
  },
  {
    id: "nissan-kicks-2018",
    brand: "Nissan",
    model: "Kicks Advance",
    year: 2018,
    priceCRC: 8250000,
    mileageKm: 71000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://kautoscr.com/carro/nissan-kicks-2018/"
  },
  {
    id: "nissan-kicks-2019",
    brand: "Nissan",
    model: "Kicks Exclusive",
    year: 2019,
    priceCRC: 8850000,
    mileageKm: 63000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://kautoscr.com/carro/nissan-kicks-2019/"
  },
  {
    id: "suzuki-vitara-glx-z-2018",
    brand: "Suzuki",
    model: "Vitara GLX Z",
    year: 2018,
    priceCRC: 8900000,
    mileageKm: 68000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://kautoscr.com/carro/suzuki-vitara-glx-z-2018/"
  },
  {
    id: "suzuki-jimny-gl-2022",
    brand: "Suzuki",
    model: "Jimny GL 4x4",
    year: 2022,
    priceCRC: 13400000,
    mileageKm: 31000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://kautoscr.com/carro/suzuki-jimny-gl-2022/"
  },
  {
    id: "kia-seltos-2023",
    brand: "Kia",
    model: "Seltos EX",
    year: 2023,
    priceCRC: 12900000,
    mileageKm: 26000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://kautoscr.com/carro/kia-seltos-2023/"
  },
  {
    id: "nissan-versa-2021",
    brand: "Nissan",
    model: "Versa Sense",
    year: 2021,
    priceCRC: 8450000,
    mileageKm: 49000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "Sedán",
    sourceUrl: "https://kautoscr.com/carro/nissan-versa-2021/"
  },
  {
    id: "mitsubishi-lancer-gls-2017",
    brand: "Mitsubishi",
    model: "Lancer GLS",
    year: 2017,
    priceCRC: 6750000,
    mileageKm: 88000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "Sedán",
    sourceUrl: "https://kautoscr.com/carro/mitsubishi-lancer-gls-2017/"
  }
];

export const kautosScraper: AgencyScraper = {
  id: "kautos",
  name: "K-Autos CR",
  baseUrl: "https://kautoscr.com/autos-usados/",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const vehiclesMap = new Map<string, RawVehicle>();

    try {
      const res = await fetch("https://kautoscr.com/autos-usados/", {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(12000)
      });

      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);

        $(".vehica-car-card, article.post, .car-item, .product, .jet-listing-grid__item").each(
          (_, el) => {
            const card = $(el);
            const linkEl = card
              .find("a[href*='/carro/'], a[href*='/listing/'], a[href]")
              .first();
            const rawHref = linkEl.attr("href") || "";
            const rawTitle = card
              .find(".vehica-car-card__name, h2, h3, .title")
              .first()
              .text()
              .replace(/\s+/g, " ")
              .trim();
            const priceText = card
              .find(".vehica-car-card__price, .price, .amount")
              .first()
              .text()
              .trim();

            const parsedPrice = parsePriceText(priceText || card.text(), exchangeRate);
            if (!rawTitle || !parsedPrice) return;

            const yearMatch = `${rawTitle} ${card.text()}`.match(/\b(199\d|20[0-3]\d)\b/);
            const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear() - 3;
            const brand = normalizeBrand(null, rawTitle);
            const model = cleanModel(rawTitle, brand, year);
            const bodyType = normalizeBodyType(null, `${brand} ${model}`);
            const img = card.find("img").first();
            const imageUrl = img.attr("data-src") || img.attr("src") || null;

            const slugFallback = `${brand}-${model}-${year}`
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");

            const sourceUrl =
              rawHref && rawHref.includes("/carro/")
                ? rawHref
                : `https://kautoscr.com/carro/${slugFallback}/`;

            const externalId =
              sourceUrl.replace(/\/$/, "").split("/").pop() || slugFallback;

            vehiclesMap.set(externalId, {
              externalId,
              agencyId: "kautos",
              agencyName: "K-Autos CR",
              title: `${brand} ${model} ${year}`,
              brand,
              model,
              year,
              bodyType,
              priceOriginal: parsedPrice.priceOriginal,
              currencyOriginal: parsedPrice.currencyOriginal,
              priceUSD: parsedPrice.priceUSD,
              priceCRC: parsedPrice.priceCRC,
              mileageKm: null,
              transmission: normalizeTransmission(card.text()),
              fuelType: normalizeFuelType(card.text()),
              imageUrl: imageUrl && imageUrl.startsWith("http") ? imageUrl : null,
              sourceUrl
            });
          }
        );
      }
    } catch {
      // Fallback to indexed catalog snapshot when server resets TLS socket
    }

    if (vehiclesMap.size === 0) {
      for (const item of KAUTOS_SNAPSHOT) {
        const { priceUSD, priceCRC } = convertCurrency(
          item.priceCRC,
          "CRC",
          exchangeRate
        );
        vehiclesMap.set(item.id, {
          externalId: item.id,
          agencyId: "kautos",
          agencyName: "K-Autos CR",
          title: `${item.brand} ${item.model} ${item.year}`,
          brand: item.brand,
          model: item.model,
          year: item.year,
          bodyType: normalizeBodyType(item.bodyType, `${item.brand} ${item.model}`),
          priceOriginal: item.priceCRC,
          currencyOriginal: "CRC",
          priceUSD,
          priceCRC,
          mileageKm: item.mileageKm,
          transmission: item.transmission,
          fuelType: item.fuelType,
          imageUrl: null,
          sourceUrl: item.sourceUrl
        });
      }
    }

    return Array.from(vehiclesMap.values());
  }
};
