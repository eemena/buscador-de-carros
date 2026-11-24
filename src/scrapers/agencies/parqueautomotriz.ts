import * as cheerio from "cheerio";
import type { AgencyScraper, RawVehicle } from "../../types/vehicle.ts";
import {
  cleanModel,
  normalizeBodyType,
  normalizeBrand,
  normalizeEngine,
  normalizeFuelType,
  normalizeTransmission,
  parsePriceText
} from "../../lib/normalizer.ts";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const parqueautomotrizScraper: AgencyScraper = {
  id: "parqueautomotriz",
  name: "Parque Automotriz",
  baseUrl: "https://www.parqueautomotriz.com/catalogo",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const res = await fetch("https://www.parqueautomotriz.com/catalogo", {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) {
      throw new Error(`Parque Automotriz respondió HTTP ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const vehiclesMap = new Map<string, RawVehicle>();

    $('[data-testid="slide-show-gallery"]').each((idx, galleryEl) => {
      const gallery = $(galleryEl);
      const compId = gallery.attr("id") || `item-${idx}`;

      const titleBlock = gallery.next('[data-testid="richTextElement"]');
      const specsBlock = titleBlock.next('[data-testid="richTextElement"]');

      const rawTitle = titleBlock.text().replace(/\s+/g, " ").trim();
      if (
        !rawTitle ||
        rawTitle.includes("press to zoom") ||
        rawTitle.toLowerCase() === "parque automotriz"
      ) {
        return;
      }

      const lines = specsBlock
        .find("p")
        .map((_, p) => $(p).text().replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim())
        .get()
        .filter(Boolean);

      if (lines.length === 0) return;

      const fullSpecsText = lines.join(" | ");
      const priceLine = lines.find((l) => /valor|precio|\$|₡/i.test(l)) || fullSpecsText;
      const parsedPrice = parsePriceText(priceLine, exchangeRate);
      if (!parsedPrice) return;

      let year = new Date().getFullYear() - 4;
      const yearLine = lines.find((l) => /a[ñn]o|\b(199\d|20[0-3]\d)\b/i.test(l));
      const yearMatch = (yearLine || fullSpecsText).match(/\b(199\d|20[0-3]\d)\b/);
      if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
      }

      let mileageKm: number | null = null;
      const kmLine = lines.find((l) => /\bkm|kms\b/i.test(l) && !/autonom/i.test(l));
      if (kmLine) {
        const num = parseInt(kmLine.replace(/[^\d]/g, ""), 10);
        if (!isNaN(num) && num > 0) mileageKm = num;
      }

      const rawEngineLine = lines.find((l) => /motor|\bcc\b|\d{4}\s*cc|\d\.\d\s*l/i.test(l));
      const fuelType = normalizeFuelType(fullSpecsText);
      const transmission = normalizeTransmission(fullSpecsText);
      const brand = normalizeBrand(null, rawTitle);
      const model = cleanModel(rawTitle, brand, year);
      const bodyType = normalizeBodyType(null, `${brand} ${model} ${fullSpecsText}`);
      const engine = normalizeEngine(rawEngineLine, `${brand} ${model} ${fullSpecsText}`, fuelType);

      const imgSrc = gallery.find("img").first().attr("src") || null;

      vehiclesMap.set(compId, {
        externalId: compId,
        agencyId: "parqueautomotriz",
        agencyName: "Parque Automotriz",
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
        engine,
        imageUrl: imgSrc,
        sourceUrl: `https://www.parqueautomotriz.com/catalogo#${compId}`
      });
    });

    return Array.from(vehiclesMap.values());
  }
};
