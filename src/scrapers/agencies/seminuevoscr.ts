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

interface SeminuevosItem {
  ID: string;
  PLACA?: string;
  MARCA: string;
  MODELO: string;
  ANO: string;
  COMB?: string;
  TRANS?: string;
  IDFOTO?: string;
  PRECIO: string;
  PRECIOESP?: string;
  TIPO?: string;
  LCN?: string;
  ESTILO?: string;
  KILOMETRAJE?: string;
}

export const seminuevoscrScraper: AgencyScraper = {
  id: "seminuevoscr",
  name: "Seminuevos CR (Danissa)",
  baseUrl: "https://www.seminuevoscr.com/",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const pageRes = await fetch("https://www.seminuevoscr.com/listado", {
      headers: { "User-Agent": USER_AGENT }
    });
    if (!pageRes.ok) {
      throw new Error(`SeminuevosCR listado respondió HTTP ${pageRes.status}`);
    }
    const html = await pageRes.text();
    const cookie = pageRes.headers.get("set-cookie") || "";

    const tokenMatch = html.match(
      /"action"\s*:\s*"getAutosList"\s*,\s*"token"\s*:\s*"([a-f0-9]+)"/i
    );
    const token = tokenMatch ? tokenMatch[1] : "b3b161bd807bd2051839c48d3b897eb9";

    const body = new URLSearchParams({
      action: "getAutosList",
      token,
      indicador: "R",
      marca: "ALL",
      certificado: "N",
      filtros: "ANY|ANY|ANY|ANY|ANY|ANY|ANY|ANY|ANY|ANY",
      orden: "ANY|ANY|ANY|ANY"
    });

    const apiRes = await fetch("https://www.seminuevoscr.com/seminuevos_functions.php", {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://www.seminuevoscr.com/listado",
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: body.toString()
    });

    if (!apiRes.ok) {
      throw new Error(`SeminuevosCR API respondió HTTP ${apiRes.status}`);
    }

    const items = (await apiRes.json()) as SeminuevosItem[];
    if (!Array.isArray(items)) return [];

    const results: RawVehicle[] = [];
    for (const item of items) {
      const priceRegular = parseFloat(item.PRECIO || "0");
      const priceSpecial = parseFloat(item.PRECIOESP || "0");
      const priceOriginal =
        item.TIPO === "O" && priceSpecial > 0 ? priceSpecial : priceRegular;

      if (!priceOriginal || priceOriginal < 2000) continue;

      const brand = normalizeBrand(item.MARCA);
      const year = parseInt(item.ANO, 10) || new Date().getFullYear() - 3;
      const model = cleanModel(item.MODELO, brand, year);
      const bodyType = normalizeBodyType(item.ESTILO, `${brand} ${model}`);
      const { priceUSD, priceCRC } = convertCurrency(priceOriginal, "USD", exchangeRate);

      const imageUrl = item.IDFOTO
        ? `https://valorenlinea.com/sn_fotos/${item.IDFOTO}`
        : null;

      results.push({
        externalId: String(item.ID || item.PLACA || `${brand}-${model}-${year}`),
        agencyId: "seminuevoscr",
        agencyName: "Seminuevos CR (Danissa)",
        title: `${brand} ${model} ${year}`,
        brand,
        model,
        year,
        bodyType,
        priceOriginal,
        currencyOriginal: "USD",
        priceUSD,
        priceCRC,
        mileageKm: item.KILOMETRAJE ? parseInt(item.KILOMETRAJE.replace(/[^\d]/g, ""), 10) : null,
        transmission: normalizeTransmission(item.TRANS),
        fuelType: normalizeFuelType(item.COMB),
        imageUrl,
        sourceUrl: `https://www.seminuevoscr.com/item/${item.ID}`
      });
    }

    return results;
  }
};
