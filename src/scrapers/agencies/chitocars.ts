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

export const chitocarsScraper: AgencyScraper = {
  id: "chitocars",
  name: "Chito Cars",
  baseUrl: "https://chitocars.com/vehiculos.php",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const res = await fetch("https://chitocars.com/vehiculos.php", {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) {
      throw new Error(`Chito Cars respondió HTTP ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const vehiclesMap = new Map<string, RawVehicle>();

    $("a.tarjeta-vehiculo").each((_, el) => {
      const card = $(el);
      const rawHref = card.attr("href") || "";
      const sourceUrl = rawHref.startsWith("http")
        ? rawHref
        : `https://chitocars.com${rawHref.startsWith("/") ? "" : "/"}${rawHref}`;

      const idMatch = rawHref.match(/id=(\d+)/);
      const rawTitle = card.find(".tarjeta-titulo").text().replace(/\s+/g, " ").trim();
      if (!rawTitle) return;

      const priceText = card.find(".tarjeta-precio").text().replace(/\s+/g, " ").trim();
      const parsedPrice = parsePriceText(priceText, exchangeRate);
      if (!parsedPrice) return;

      let year = new Date().getFullYear() - 3;
      const anioText = card.find(".tarjeta-anio").text().trim();
      if (/^(199\d|20[0-3]\d)$/.test(anioText)) {
        year = parseInt(anioText, 10);
      } else {
        const yMatch = rawTitle.match(/\b(199\d|20[0-3]\d)\b/);
        if (yMatch) year = parseInt(yMatch[1], 10);
      }

      let mileageKm: number | null = null;
      let transmission = "Automático";

      card.find(".tarjeta-detalles span").each((__, spanEl) => {
        const txt = $(spanEl).text().replace(/\s+/g, " ").trim();
        if (/km/i.test(txt)) {
          const num = parseInt(txt.replace(/[^\d]/g, ""), 10);
          if (!isNaN(num) && num > 0) mileageKm = num;
        } else if (/autom|manual|cvt|mec/i.test(txt)) {
          transmission = normalizeTransmission(txt);
        }
      });

      const imgSrc = card.find("img").first().attr("src") || "";
      const imageUrl = imgSrc
        ? imgSrc.startsWith("http")
          ? imgSrc
          : `https://chitocars.com${imgSrc.startsWith("/") ? "" : "/"}${encodeURI(imgSrc)}`
        : null;

      // Strip transmission & 4x4 suffixes from title so model stays clean
      const cleanedTitleForModel = rawTitle
        .replace(/\b(autom[aá]tic[oa]|manual|4x4|4x2|awd)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      const brand = normalizeBrand(null, rawTitle);
      const model = cleanModel(cleanedTitleForModel, brand, year);
      const bodyType = normalizeBodyType(null, `${brand} ${model} ${rawTitle}`);
      const fuelType = normalizeFuelType(rawTitle);
      const engine = normalizeEngine(null, `${brand} ${model} ${rawTitle}`, fuelType);

      const externalId = idMatch ? idMatch[1] : `${brand}-${model}-${year}`;

      vehiclesMap.set(externalId, {
        externalId,
        agencyId: "chitocars",
        agencyName: "Chito Cars",
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
        imageUrl,
        sourceUrl
      });
    });

    return Array.from(vehiclesMap.values());
  }
};
