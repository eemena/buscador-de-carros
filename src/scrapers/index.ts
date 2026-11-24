import type { AgencyScraper } from "../types/vehicle.ts";
import { carsotScraper } from "./agencies/carsot.ts";
import { seminuevoscrScraper } from "./agencies/seminuevoscr.ts";
import { purdyScraper } from "./agencies/purdy.ts";
import { autostarScraper } from "./agencies/autostar.ts";
import { veinsaScraper } from "./agencies/veinsa.ts";
import { hondaScraper } from "./agencies/honda.ts";
import { grupoqScraper } from "./agencies/grupoq.ts";
import { topcarsScraper } from "./agencies/topcars.ts";
import { kautosScraper } from "./agencies/kautos.ts";
import { starcarsScraper } from "./agencies/starcars.ts";
import { chitocarsScraper } from "./agencies/chitocars.ts";
import { parqueautomotrizScraper } from "./agencies/parqueautomotriz.ts";
import { qualitymotorsScraper } from "./agencies/qualitymotors.ts";
import { DEFAULT_EXCHANGE_RATE } from "../lib/normalizer.ts";
import { markAgencySyncError, replaceAgencyVehicles } from "../lib/db.ts";

/**
 * Registro central de adaptadores de agencias.
 * Para agregar una nueva agencia:
 * 1. Crea un archivo en `src/scrapers/agencies/<nueva-agencia>.ts` que implemente `AgencyScraper`
 * 2. Agrégalo al arreglo `SCRAPERS` aquí abajo y a `AGENCIES` en `src/types/vehicle.ts`.
 */
export const SCRAPERS: AgencyScraper[] = [
  carsotScraper,
  seminuevoscrScraper,
  purdyScraper,
  autostarScraper,
  veinsaScraper,
  hondaScraper,
  grupoqScraper,
  topcarsScraper,
  kautosScraper,
  starcarsScraper,
  chitocarsScraper,
  parqueautomotrizScraper,
  qualitymotorsScraper
];

export interface SyncAgencyResult {
  agencyId: string;
  agencyName: string;
  ok: boolean;
  count: number;
  error?: string;
}

export async function syncAgencies(
  agencyIds?: string[],
  exchangeRate: number = DEFAULT_EXCHANGE_RATE
): Promise<SyncAgencyResult[]> {
  const targets =
    agencyIds && agencyIds.length > 0
      ? SCRAPERS.filter((s) => agencyIds.includes(s.id))
      : SCRAPERS;

  const results: SyncAgencyResult[] = [];

  await Promise.all(
    targets.map(async (scraper) => {
      try {
        const vehicles = await scraper.scrape(exchangeRate);
        const totalSaved = replaceAgencyVehicles(scraper.id, scraper.name, vehicles);
        results.push({
          agencyId: scraper.id,
          agencyName: scraper.name,
          ok: true,
          count: totalSaved
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        markAgencySyncError(scraper.id, scraper.name, errorMsg);
        results.push({
          agencyId: scraper.id,
          agencyName: scraper.name,
          ok: false,
          count: 0,
          error: errorMsg
        });
      }
    })
  );

  return results;
}
