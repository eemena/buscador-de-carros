import * as cheerio from "cheerio";
import type { AgencyScraper, RawVehicle } from "../../types/vehicle.ts";
import {
  cleanModel,
  normalizeBodyType,
  normalizeBrand,
  normalizeFuelType,
  normalizeTransmission,
  parsePriceText
} from "../../lib/normalizer.ts";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const starcarsScraper: AgencyScraper = {
  id: "starcars",
  name: "StarCars CR",
  baseUrl: "https://starcars.com/",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const res = await fetch("https://starcars.com/vehiculosenventa/", {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) {
      throw new Error(`StarCars respondió HTTP ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const vehiclesMap = new Map<string, RawVehicle>();

    $(".vehica-car-card").each((_, el) => {
      const card = $(el);
      const rawId =
        card.attr("data-id") ||
        card.attr("id")?.replace("vehica-car-", "").trim();

      const nameLink = card.find(".vehica-car-card__name").first();
      const rawTitle = nameLink.text().replace(/\s+/g, " ").trim();
      const sourceUrl =
        nameLink.attr("href") ||
        card.find("a.vehica-car-card-link").attr("href") ||
        "https://starcars.com/vehiculosenventa/";

      if (!rawTitle) return;

      const priceText = card.find(".vehica-car-card__price").first().text().trim();
      const parsedPrice =
        parsePriceText(priceText, exchangeRate) ||
        parsePriceText(rawTitle, exchangeRate);
      if (!parsedPrice) return;

      let year = new Date().getFullYear() - 3;
      let mileageKm: number | null = null;
      let transmission = "Automático";
      let fuelType = "Gasolina";

      card.find(".vehica-car-card__info__single").each((__, infoEl) => {
        const txt = $(infoEl).text().replace(/\s+/g, " ").trim();
        if (/^(199\d|20[0-3]\d)$/.test(txt)) {
          year = parseInt(txt, 10);
        } else if (/km/i.test(txt)) {
          const num = parseInt(txt.replace(/[^\d]/g, ""), 10);
          if (!isNaN(num) && num > 0) mileageKm = num;
        } else if (/autom|manual|cvt|mec/i.test(txt)) {
          transmission = normalizeTransmission(txt);
        } else if (/gasol|dies|diés|electr|eléctr|hibr|híbr/i.test(txt)) {
          fuelType = normalizeFuelType(txt);
        }
      });

      // Also check if year is in title
      const titleYearMatch = rawTitle.match(/\b(199\d|20[0-3]\d)\b/);
      if (titleYearMatch) {
        year = parseInt(titleYearMatch[1], 10);
      }

      let imageUrl: string | null = null;
      const img = card.find("img").first();
      const dataSrc = img.attr("data-src") || img.attr("src");
      if (dataSrc && dataSrc.startsWith("http")) {
        imageUrl = dataSrc;
      } else {
        const srcset = img.attr("data-srcset") || img.attr("srcset");
        if (srcset) {
          const firstEntry = srcset.split(",")[0]?.trim().split(/\s+/)[0];
          if (firstEntry && firstEntry.startsWith("http")) {
            imageUrl = firstEntry;
          }
        }
      }

      // Clean trailing "- 33673" ID from StarCars title
      const cleanTitle = rawTitle.replace(/\s*-\s*\d+\s*$/, "").trim();
      const brand = normalizeBrand(null, cleanTitle);
      const model = cleanModel(cleanTitle, brand, year);
      const bodyType = normalizeBodyType(null, `${brand} ${model} ${cleanTitle}`);
      const externalId =
        rawId || sourceUrl.replace(/\/$/, "").split("/").pop() || cleanTitle;

      vehiclesMap.set(externalId, {
        externalId,
        agencyId: "starcars",
        agencyName: "StarCars CR",
        title: `${brand} ${model} ${year}`,
        brand,
        model,
        year,
        bodyType,
        priceOriginal: parsedPrice.priceOriginal,
        currencyOriginal: parsedPrice.currencyOriginal,
        priceUSD: parsedPrice.priceUSD,
        priceCRC: parsedPrice.priceCRC,
        mileageKm,
        transmission,
        fuelType,
        imageUrl,
        sourceUrl
      });
    });

    return Array.from(vehiclesMap.values());
  }
};
