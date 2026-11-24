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

export const carsotScraper: AgencyScraper = {
  id: "carsot",
  name: "Carsot CR",
  baseUrl: "https://carsotcr.com/",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const res = await fetch("https://carsotcr.com/", {
      headers: { "User-Agent": USER_AGENT }
    });
    if (!res.ok) {
      throw new Error(`Carsot respondió HTTP ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const vehiclesMap = new Map<string, RawVehicle>();

    $(".vehica-car-card").each((_, el) => {
      const card = $(el);
      const rawId = card.attr("id")?.replace("vehica-car-", "").trim();
      const nameLink = card.find(".vehica-car-card__name").first();
      const rawTitle = nameLink.text().replace(/\s+/g, " ").trim();
      const sourceUrl =
        nameLink.attr("href") ||
        card.find("a.vehica-car-card-link").attr("href") ||
        "https://carsotcr.com/";

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
          if (!isNaN(num)) mileageKm = num;
        } else if (/autom|manual|cvt|mec/i.test(txt)) {
          transmission = normalizeTransmission(txt);
        } else if (/gasol|dies|diés|electr|eléctr|hibr|híbr/i.test(txt)) {
          fuelType = normalizeFuelType(txt);
        }
      });

      // Extract image from data-srcset, data-src, or src
      let imageUrl: string | null = null;
      const img = card.find("img").first();
      const srcset = img.attr("data-srcset") || img.attr("srcset");
      if (srcset) {
        const firstEntry = srcset.split(",")[0]?.trim().split(/\s+/)[0];
        if (firstEntry && firstEntry.startsWith("http")) {
          imageUrl = firstEntry;
        }
      }
      if (!imageUrl) {
        const src = img.attr("data-src") || img.attr("src");
        if (src && src.startsWith("http")) {
          imageUrl = src;
        }
      }

      // Clean promotional text out of title if present
      const cleanTitle = rawTitle
        .replace(/precio\s+regular.*$/i, "")
        .replace(/\(\s*precio.*$/i, "")
        .trim();

      const brand = normalizeBrand(null, cleanTitle);
      const model = cleanModel(cleanTitle, brand, year);
      const bodyType = normalizeBodyType(null, `${brand} ${model} ${cleanTitle}`);
      const externalId = rawId || sourceUrl.replace(/\/$/, "").split("/").pop() || cleanTitle;

      vehiclesMap.set(externalId, {
        externalId,
        agencyId: "carsot",
        agencyName: "Carsot CR",
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
