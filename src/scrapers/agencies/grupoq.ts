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

async function fetchGrupoQPage(page: number): Promise<string> {
  const res = await fetch(`https://grupoqusadoscr.com/vehiculos?page=${page}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) {
    throw new Error(`Grupo Q página ${page} respondió HTTP ${res.status}`);
  }
  return res.text();
}

export const grupoqScraper: AgencyScraper = {
  id: "grupoq",
  name: "Grupo Q Usados",
  baseUrl: "https://grupoqusadoscr.com/",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const pages = [1, 2, 3, 4, 5];
    const settled = await Promise.allSettled(pages.map((p) => fetchGrupoQPage(p)));
    const vehiclesMap = new Map<string, RawVehicle>();

    for (const res of settled) {
      if (res.status !== "fulfilled") continue;
      const $ = cheerio.load(res.value);

      $(".vehicle-card-item").each((_, el) => {
        const card = $(el);
        const linkEl = card.find("a[href*='/vehiculos/']").first();
        const href = linkEl.attr("href") || "";
        if (!href) return;

        const sourceUrl = href.startsWith("http")
          ? href
          : `https://grupoqusadoscr.com${href.startsWith("/") ? "" : "/"}${href}`;

        // URL pattern: /vehiculos/<category>/<brand>/<slug>-<year>-<id>
        const urlParts = sourceUrl.split("/").filter(Boolean);
        const slugPart = urlParts[urlParts.length - 1] || "";
        const brandFromUrl = urlParts[urlParts.length - 2] || "";
        const categoryFromUrl = urlParts[urlParts.length - 3] || "";

        const idMatch = slugPart.match(/-(\d+)$/);
        const externalId = idMatch ? idMatch[1] : slugPart;

        const rawTitle = card.find("h3").first().text().replace(/\s+/g, " ").trim();
        if (!rawTitle) return;

        // Subtitle e.g. "2024 | 4x4 | T/A"
        const subtitle = card
          .find("p")
          .filter((__, pEl) => $(pEl).text().includes("|"))
          .first()
          .text()
          .replace(/\s+/g, " ")
          .trim();

        const yearMatch =
          subtitle.match(/\b(199\d|20[0-3]\d)\b/) ||
          slugPart.match(/-(199\d|20[0-3]\d)-\d+$/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear() - 2;

        // Price text
        let priceText = "";
        card.find("p").each((__, pEl) => {
          const txt = $(pEl).text().replace(/\s+/g, " ").trim();
          if (/[\$₡]/.test(txt)) {
            priceText = txt;
          }
        });

        const parsedPrice = parsePriceText(priceText, exchangeRate);
        if (!parsedPrice) return;

        const transmission =
          /\bt\/m\b|manual/i.test(subtitle) || /-tm-/i.test(slugPart)
            ? "Manual"
            : normalizeTransmission(subtitle);

        const imgEl = card.find("img[src*='/storage/vehicles/']").first();
        const imageUrl = imgEl.attr("src") || null;

        const brand = normalizeBrand(brandFromUrl, rawTitle);
        const model = cleanModel(rawTitle, brand, year);
        const bodyType = normalizeBodyType(
          categoryFromUrl,
          `${brand} ${model} ${rawTitle}`
        );

        vehiclesMap.set(externalId, {
          externalId,
          agencyId: "grupoq",
          agencyName: "Grupo Q Usados",
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
          transmission,
          fuelType: "Gasolina",
          imageUrl,
          sourceUrl
        });
      });
    }

    if (vehiclesMap.size === 0) {
      throw new Error("No se encontraron vehículos en Grupo Q Usados");
    }

    return Array.from(vehiclesMap.values());
  }
};
