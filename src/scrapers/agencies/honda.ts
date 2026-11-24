import * as cheerio from "cheerio";
import type { AgencyScraper, RawVehicle } from "../../types/vehicle.ts";
import {
  cleanModel,
  normalizeBodyType,
  normalizeBrand,
  normalizeTransmission,
  parsePriceText
} from "../../lib/normalizer.ts";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const hondaScraper: AgencyScraper = {
  id: "honda",
  name: "Honda Costa Rica (Faco)",
  baseUrl: "https://www.hondacostarica.com/autos-usados",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const res = await fetch("https://www.hondacostarica.com/autos-usados", {
      headers: { "User-Agent": USER_AGENT }
    });
    if (!res.ok) {
      throw new Error(`Honda Costa Rica respondió HTTP ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const vehiclesMap = new Map<string, RawVehicle>();

    $(".PreOwned-item").each((_, el) => {
      const card = $(el);
      const linkEl = card.find("a[href*='/autos-usados/detalle/']").first();
      const relHref = linkEl.attr("href") || "";
      const sourceUrl = relHref.startsWith("http")
        ? relHref
        : `https://www.hondacostarica.com${relHref.startsWith("/") ? "" : "/"}${relHref}`;

      const externalId = relHref.split("/").pop() || "";

      const h2 = card.find(".PreOwned-item_name h2").first();
      const yearText = h2.find("strong").text().trim();
      const year = parseInt(yearText, 10) || new Date().getFullYear() - 3;

      const fullTitle = h2.text().replace(/\s+/g, " ").trim();
      const nameWithoutYear = fullTitle.replace(yearText, "").trim();

      const priceText = card.find(".PreOwned-item_price").text().replace(/\s+/g, " ").trim();
      const parsedPrice = parsePriceText(priceText, exchangeRate);
      if (!parsedPrice) return;

      const specsText = card
        .find(".PreOwned-item_name span")
        .text()
        .replace(/\s+/g, " ")
        .trim();

      let mileageKm: number | null = null;
      const kmMatch = specsText.match(/([\d,.]+)\s*km/i);
      if (kmMatch) {
        const parsedKm = parseInt(kmMatch[1].replace(/[^\d]/g, ""), 10);
        if (!isNaN(parsedKm)) mileageKm = parsedKm;
      }

      const transmission = normalizeTransmission(specsText);
      const brand = normalizeBrand(null, nameWithoutYear);
      const model = cleanModel(nameWithoutYear, brand, year);
      const bodyType = normalizeBodyType(null, `${brand} ${model}`);

      const img = card.find("figure img").first();
      const imgSrc = img.attr("src") || img.attr("data-src") || null;
      const imageUrl =
        imgSrc && !imgSrc.includes("no-image") ? imgSrc : null;

      if (!externalId) return;

      vehiclesMap.set(externalId, {
        externalId,
        agencyId: "honda",
        agencyName: "Honda Costa Rica (Faco)",
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
        fuelType: "Gasolina",
        imageUrl,
        sourceUrl
      });
    });

    return Array.from(vehiclesMap.values());
  }
};
