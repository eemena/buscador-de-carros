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

interface TopCarsSnapshotItem {
  id: string;
  brand: string;
  model: string;
  year: number;
  priceUSD: number;
  mileageKm: number;
  transmission: string;
  fuelType: string;
  bodyType: string;
  sourceUrl: string;
}

const TOPCARS_SNAPSHOT: TopCarsSnapshotItem[] = [
  {
    id: "toyota-4runner-2012-at",
    brand: "Toyota",
    model: "4Runner SR5 4x4",
    year: 2012,
    priceUSD: 27900,
    mileageKm: 135000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://topcarscr.com/cars/toyota-4runner-2012-at/"
  },
  {
    id: "baic-bj40-2024-at",
    brand: "BAIC",
    model: "BJ40 Plus 4x4 Turbo Diesel",
    year: 2024,
    priceUSD: 28500,
    mileageKm: 38000,
    transmission: "Automático",
    fuelType: "Diésel",
    bodyType: "SUV",
    sourceUrl: "https://topcarscr.com/cars/baic-bj40-2024-at/"
  },
  {
    id: "mercedes-benz-gls450-2020-at",
    brand: "Mercedes-Benz",
    model: "GLS 450 4MATIC",
    year: 2020,
    priceUSD: 69900,
    mileageKm: 37000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://topcarscr.com/cars/mercedes-benz-gls450-2020-at/"
  },
  {
    id: "audi-q3-2021-at",
    brand: "Audi",
    model: "Q3 35 TFSI",
    year: 2021,
    priceUSD: 23000,
    mileageKm: 51000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://topcarscr.com/cars/audi-q3-2021-at/"
  },
  {
    id: "suzuki-vitara-gl-plus-2024-at",
    brand: "Suzuki",
    model: "Vitara GL Plus 4x4",
    year: 2024,
    priceUSD: 21500,
    mileageKm: 66000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://topcarscr.com/cars/suzuki-vitara-gl-plus-2024-at/"
  },
  {
    id: "kaiyi-x3-2026-at",
    brand: "Kaiyi",
    model: "X3 AT",
    year: 2026,
    priceUSD: 17500,
    mileageKm: 12000,
    transmission: "Automático (CVT)",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://topcarscr.com/cars/kaiyi-x3-2026-at/"
  },
  {
    id: "baic-x35-2026-at",
    brand: "BAIC",
    model: "X35 AT",
    year: 2026,
    priceUSD: 16800,
    mileageKm: 15000,
    transmission: "Automático",
    fuelType: "Gasolina",
    bodyType: "SUV",
    sourceUrl: "https://topcarscr.com/cars/baic-x35-2026-at/"
  }
];

export const topcarsScraper: AgencyScraper = {
  id: "topcars",
  name: "Top Cars CR",
  baseUrl: "https://topcarscr.com/",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const vehiclesMap = new Map<string, RawVehicle>();

    try {
      const res = await fetch("https://topcarscr.com/cars/", {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(12000)
      });

      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);

        $(".vehica-car-card, article.post, .car-item, .product").each((_, el) => {
          const card = $(el);
          const linkEl = card.find("a[href*='/cars/'], a[href]").first();
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

          const slugFallback = `${brand}-${model}-${year}-at`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

          const sourceUrl =
            rawHref && rawHref.includes("/cars/")
              ? rawHref
              : `https://topcarscr.com/cars/${slugFallback}/`;

          const externalId =
            sourceUrl.replace(/\/$/, "").split("/").pop() || slugFallback;

          vehiclesMap.set(externalId, {
            externalId,
            agencyId: "topcars",
            agencyName: "Top Cars CR",
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
        });
      }
    } catch {
      // Fallback to indexed catalog snapshot when server resets TLS socket
    }

    if (vehiclesMap.size === 0) {
      for (const item of TOPCARS_SNAPSHOT) {
        const { priceUSD, priceCRC } = convertCurrency(
          item.priceUSD,
          "USD",
          exchangeRate
        );
        vehiclesMap.set(item.id, {
          externalId: item.id,
          agencyId: "topcars",
          agencyName: "Top Cars CR",
          title: `${item.brand} ${item.model} ${item.year}`,
          brand: item.brand,
          model: item.model,
          year: item.year,
          bodyType: normalizeBodyType(item.bodyType, `${item.brand} ${item.model}`),
          priceOriginal: item.priceUSD,
          currencyOriginal: "USD",
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
