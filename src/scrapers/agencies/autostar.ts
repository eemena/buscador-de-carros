import type { AgencyScraper, RawVehicle } from "../../types/vehicle.ts";
import {
  cleanModel,
  convertCurrency,
  normalizeBodyType,
  normalizeBrand,
  normalizeFuelType
} from "../../lib/normalizer.ts";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const AUTOSTAR_API_URL =
  "https://usados.autostar.cr/o/c/atencions/?filter=formularioAtencion/id%20eq%20%2710823562%27&fields=nombre,r_sucursalAtiende_c_sucursal.id,r_sucursalAtiende_c_sucursal.nombre,r_usadoAtencion_c_usado.nombre,r_usadoAtencion_c_usado.tipoVehiculo,r_usadoAtencion_c_usado.combustible,r_usadoAtencion_c_usado.id,r_usadoAtencion_c_usado.anio,r_usadoAtencion_c_usado.kilometraje,r_usadoAtencion_c_usado.precio,r_usadoAtencion_c_usado.jsonImagenes,r_usadoAtencion_c_usado.r_usadoVersion_c_version.id,r_usadoAtencion_c_usado.r_usadoVersion_c_version.name,r_usadoAtencion_c_usado.r_usadoVersion_c_version.r_modeloVersion_c_modelo.id,r_usadoAtencion_c_usado.r_usadoVersion_c_version.r_modeloVersion_c_modelo.nomModelo,r_usadoAtencion_c_usado.r_usadoVersion_c_version.r_modeloVersion_c_modelo.r_marcaModelo_c_marcaVeh.id,r_usadoAtencion_c_usado.r_usadoVersion_c_version.r_modeloVersion_c_modelo.r_marcaModelo_c_marcaVeh.descripcion&nestedFields=r_sucursalAtiende_c_sucursal%2Cr_usadoAtencion_c_usado%2Cr_usadoVersion_c_version%2Cr_modeloVersion_c_modelo%2Cr_marcaModelo_c_marcaVeh&nestedFieldsDepth=6&pageSize=200&page=1";

export const autostarScraper: AgencyScraper = {
  id: "autostar",
  name: "AutoStar Usados",
  baseUrl: "https://usados.autostar.cr/catalogo",

  async scrape(exchangeRate: number): Promise<RawVehicle[]> {
    const res = await fetch(AUTOSTAR_API_URL, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`AutoStar API respondió HTTP ${res.status}`);
    }

    const data = await res.json();
    const items = data?.items || [];
    const vehiclesMap = new Map<string, RawVehicle>();

    for (const item of items) {
      // Skip hidden branch 10507789 per Autostar's own frontend filter
      const sucursalId = item?.r_sucursalAtiende_c_sucursal?.id ?? 0;
      if (sucursalId === 10507789) continue;

      const usado = item?.r_usadoAtencion_c_usado;
      if (!usado) continue;

      const modeloObj = usado?.r_usadoVersion_c_version?.r_modeloVersion_c_modelo;
      const idModelo = modeloObj?.id ?? 0;
      if (!idModelo) continue;

      const rawId = String(usado.id || "").trim();
      if (!rawId) continue;

      const rawPrice = parseFloat(
        String(usado.precio || "0")
          .replace(/\./g, "")
          .replace(/[^\d]/g, "")
      );
      if (!rawPrice || rawPrice < 2000) continue;

      const rawBrand = modeloObj?.r_marcaModelo_c_marcaVeh?.descripcion || "";
      const rawModel = modeloObj?.nomModelo || usado.nombre || "";
      const versionName = usado?.r_usadoVersion_c_version?.name || usado.nombre || "";

      const brand = normalizeBrand(rawBrand, `${rawModel} ${versionName}`);
      const year = parseInt(String(usado.anio || ""), 10) || new Date().getFullYear() - 3;
      const model = cleanModel(rawModel || versionName, brand, year);
      const bodyType = normalizeBodyType(usado.tipoVehiculo, `${brand} ${model} ${versionName}`);

      const { priceUSD, priceCRC } = convertCurrency(rawPrice, "USD", exchangeRate);

      let imageUrl: string | null = null;
      if (usado.jsonImagenes) {
        try {
          const parsedImgs = JSON.parse(usado.jsonImagenes);
          if (Array.isArray(parsedImgs) && parsedImgs.length > 0) {
            imageUrl = parsedImgs[0];
          }
        } catch {
          // ignore JSON parse errors
        }
      }

      const kmNum = usado.kilometraje
        ? parseInt(String(usado.kilometraje).replace(/[^\d]/g, ""), 10)
        : null;

      vehiclesMap.set(rawId, {
        externalId: rawId,
        agencyId: "autostar",
        agencyName: "AutoStar Usados",
        title: `${brand} ${model} ${year}`,
        brand,
        model,
        year,
        bodyType,
        priceOriginal: rawPrice,
        currencyOriginal: "USD",
        priceUSD,
        priceCRC,
        mileageKm: kmNum && !isNaN(kmNum) ? kmNum : null,
        transmission: "Automático",
        fuelType: normalizeFuelType(usado.combustible),
        imageUrl,
        sourceUrl: `https://usados.autostar.cr/catalogo/ficha-producto?idModelo=${rawId}`
      });
    }

    return Array.from(vehiclesMap.values());
  }
};
