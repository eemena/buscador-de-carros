export type Currency = "USD" | "CRC";

export type BodyType =
  | "SUV"
  | "Sedán"
  | "Pick-up"
  | "Hatchback"
  | "Crossover"
  | "Coupe"
  | "Van / Comercial"
  | "Otro";

export interface AgencyMeta {
  id: string;
  name: string;
  baseUrl: string;
  color: string;
}

export const AGENCIES: AgencyMeta[] = [
  {
    id: "carsot",
    name: "Carsot CR",
    baseUrl: "https://carsotcr.com/",
    color: "#ef4444"
  },
  {
    id: "seminuevoscr",
    name: "Seminuevos CR (Danissa)",
    baseUrl: "https://www.seminuevoscr.com/",
    color: "#3b82f6"
  },
  {
    id: "purdy",
    name: "Purdy Usados",
    baseUrl: "https://www.purdyusados.com/",
    color: "#dc2626"
  },
  {
    id: "autostar",
    name: "AutoStar Usados",
    baseUrl: "https://usados.autostar.cr/",
    color: "#0ea5e9"
  },
  {
    id: "veinsa",
    name: "Veinsa Usados",
    baseUrl: "https://veinsausados.com/",
    color: "#f59e0b"
  },
  {
    id: "honda",
    name: "Honda Costa Rica (Faco)",
    baseUrl: "https://www.hondacostarica.com/",
    color: "#10b981"
  },
  {
    id: "grupoq",
    name: "Grupo Q Usados",
    baseUrl: "https://grupoqusadoscr.com/",
    color: "#2563eb"
  },
  {
    id: "topcars",
    name: "Top Cars CR",
    baseUrl: "https://topcarscr.com/",
    color: "#a855f7"
  },
  {
    id: "kautos",
    name: "K-Autos CR",
    baseUrl: "https://kautoscr.com/autos-usados/",
    color: "#ec4899"
  },
  {
    id: "starcars",
    name: "StarCars CR",
    baseUrl: "https://starcars.com/",
    color: "#14b8a6"
  },
  {
    id: "chitocars",
    name: "Chito Cars",
    baseUrl: "https://chitocars.com/vehiculos.php",
    color: "#f97316"
  },
  {
    id: "parqueautomotriz",
    name: "Parque Automotriz",
    baseUrl: "https://www.parqueautomotriz.com/catalogo",
    color: "#84cc16"
  },
  {
    id: "qualitymotors",
    name: "Quality Motors Usados",
    baseUrl: "https://qualitymotorsusados.com/vehiculos/",
    color: "#0038c6"
  }
];

export interface RawVehicle {
  externalId: string;
  agencyId: string;
  agencyName: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  bodyType: BodyType;
  priceOriginal: number;
  currencyOriginal: Currency;
  priceUSD: number;
  priceCRC: number;
  mileageKm?: number | null;
  transmission?: string | null;
  fuelType?: string | null;
  engine?: string | null;
  imageUrl?: string | null;
  sourceUrl: string;
}

export interface Vehicle extends RawVehicle {
  id: string;
  updatedAt: string;
}

export interface AgencySyncStatus {
  agencyId: string;
  agencyName: string;
  lastSyncedAt: string | null;
  vehicleCount: number;
  lastStatus: "ok" | "error" | "idle";
  lastError?: string | null;
}

export interface AgencyScraper {
  id: string;
  name: string;
  baseUrl: string;
  scrape(exchangeRate: number): Promise<RawVehicle[]>;
}
