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

interface FilterCarsAjaxResponse {
  success?: boolean;
  data?: {
    html?: string;
    pagination?: string;
    current_page?: number;
  };
}

interface WpVehiculoSummary {
  id: number;
  class_list?: string[];
}

async function fetchWpBodyTypesMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    for (const page of [1, 2]) {
      const res = await fetch(
        `https://qualitymotorsusados.com/wp-json/wp/v2/vehiculos?per_page=100&page=${page}&_fields=id,class_list`,
        {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(12000)
        }
      );
      if (!res.ok) break;
      const items = (await res.json()) as WpVehiculoSummary[];
      if (!Array.isArray(items) || items.length === 0) break;
      for (const item of items) {
        if (!item?.id || !Array.isArray(item.class_list)) continue;
        const tipoClass = item.class_list.find((c) => c.startsWith("tipo-de-vehiculo-"));
        if (tipoClass) {
          map.set(
            String(item.id),
            tipoClass.replace(/^tipo-de-vehiculo-/, "").replace(/-/g, " ")
          );
        }
      }
      const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
      if (page >= totalPages) break;
    }
  } catch {
    // Fallback to title/model inference if WP REST metadata fails
  }
  return map;
}

async function fetchAjaxPage(
  nonce: string,
  paged: number
): Promise<FilterCarsAjaxResponse> {
  const body = new URLSearchParams({
    action: "filter_cars",
    precio_min: "0",
    precio_max: "999999",
    km_min: "0",
    km_max: "999999",
    paged: String(paged),
    nonce
  });

  const res = await fetch("https://qualitymotorsusados.com/wp-admin/admin-ajax.php", {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://qualitymotorsusados.com/vehiculos/"
    },
    body: body.toString(),
    signal: AbortSignal.timeout(20000)
  });

  if (!res.ok) {
    throw new Error(`Quality Motors AJAX respondió HTTP ${res.status} en página ${paged}`);
  }

  return (await res.json()) as FilterCarsAjaxResponse;
}

export const qualitymotorsScraper: AgencyScraper = {
  id: "qualitymotors",
  name: "Quality Motors Usados",
  baseUrl: "https://qualitymotorsusados.com/vehiculos/",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const pageRes = await fetch("https://qualitymotorsusados.com/vehiculos/", {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20000)
    });

    if (!pageRes.ok) {
      throw new Error(`Quality Motors respondió HTTP ${pageRes.status}`);
    }

    const pageHtml = await pageRes.text();
    const nonceMatch = pageHtml.match(/"nonce"\s*:\s*"([^"]+)"/);
    if (!nonceMatch || !nonceMatch[1]) {
      throw new Error("No se encontró el nonce AJAX en Quality Motors");
    }
    const nonce = nonceMatch[1];

    const [firstPage, wpBodyTypesMap] = await Promise.all([
      fetchAjaxPage(nonce, 1),
      fetchWpBodyTypesMap()
    ]);

    if (!firstPage.success || !firstPage.data?.html) {
      throw new Error("Quality Motors AJAX no devolvió resultados válidos");
    }

    // Determine max page from pagination HTML
    let maxPage = 1;
    if (firstPage.data.pagination) {
      const $pag = cheerio.load(firstPage.data.pagination);
      $pag(".pagination-btn").each((_, el) => {
        const p = parseInt($pag(el).attr("data-page") || "0", 10);
        if (!isNaN(p) && p > maxPage) {
          maxPage = p;
        }
      });
    }

    const htmlPages: string[] = [firstPage.data.html];
    if (maxPage > 1) {
      const extraPageNumbers = Array.from(
        { length: Math.min(maxPage, 15) - 1 },
        (_, i) => i + 2
      );
      const extraResponses = await Promise.all(
        extraPageNumbers.map((p) =>
          fetchAjaxPage(nonce, p).catch(() => null)
        )
      );
      for (const resp of extraResponses) {
        if (resp?.success && resp.data?.html) {
          htmlPages.push(resp.data.html);
        }
      }
    }

    const vehiclesMap = new Map<string, RawVehicle>();

    for (const html of htmlPages) {
      const $ = cheerio.load(html);

      $(".card-journey-small").each((_, el) => {
        const card = $(el);
        const titleLink = card.find(".card-title a").first();
        const rawHref =
          titleLink.attr("href")?.trim() ||
          card.find(".card-image a").first().attr("href")?.trim() ||
          "";

        const sourceUrl = rawHref.startsWith("http")
          ? rawHref
          : rawHref
            ? `https://qualitymotorsusados.com${rawHref.startsWith("/") ? "" : "/"}${rawHref}`
            : "https://qualitymotorsusados.com/vehiculos/";

        const yearSpanText = titleLink.find("span").text().trim();
        const titleClone = titleLink.clone();
        titleClone.find("span").remove();
        const rawTitle = titleClone.text().replace(/\s+/g, " ").trim();
        if (!rawTitle) return;

        const priceText = card.find(".card-price").text().replace(/\s+/g, " ").trim();
        const parsedPrice = parsePriceText(priceText, exchangeRate);
        if (!parsedPrice) return;

        let year = new Date().getFullYear() - 2;
        const yearMatch =
          yearSpanText.match(/\b(199\d|20[0-3]\d)\b/) ||
          rawTitle.match(/\b(199\d|20[0-3]\d)\b/);
        if (yearMatch) {
          year = parseInt(yearMatch[1], 10);
        }

        let mileageKm: number | null = null;
        const milesText = card.find(".card-miles").text().replace(/[^\d]/g, "").trim();
        if (milesText) {
          const parsedMiles = parseInt(milesText, 10);
          if (!isNaN(parsedMiles) && parsedMiles >= 0) {
            mileageKm = parsedMiles;
          }
        }

        const gearText = card.find(".card-gear").text().replace(/\s+/g, " ").trim();
        const fuelText = card.find(".card-fuel").text().replace(/\s+/g, " ").trim();

        const transmission = normalizeTransmission(gearText);
        const fuelType = normalizeFuelType(fuelText || rawTitle);

        const imgEl = card.find(".card-image img").first();
        const rawImg = imgEl.attr("src")?.trim() || imgEl.attr("data-src")?.trim() || "";
        const imageUrl = rawImg
          ? rawImg.startsWith("http")
            ? rawImg
            : `https://qualitymotorsusados.com${rawImg.startsWith("/") ? "" : "/"}${rawImg}`
          : null;

        const carId =
          card.find("[data-car-id]").attr("data-car-id")?.trim() ||
          sourceUrl.replace(/\/$/, "").split("/").pop() ||
          `${rawTitle}-${year}`;

        const brand = normalizeBrand(null, rawTitle);
        const model = cleanModel(rawTitle, brand, year);
        const wpRawBodyType = wpBodyTypesMap.get(carId) || null;
        const bodyType = normalizeBodyType(wpRawBodyType, `${brand} ${model} ${rawTitle}`);
        const engine = normalizeEngine(fuelText, `${brand} ${model} ${rawTitle}`, fuelType);

        vehiclesMap.set(carId, {
          externalId: carId,
          agencyId: "qualitymotors",
          agencyName: "Quality Motors Usados",
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
    }

    return Array.from(vehiclesMap.values());
  }
};
