import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { AGENCIES, type AgencySyncStatus, type RawVehicle, type Vehicle } from "../types/vehicle.ts";
import { normalizeEngine } from "./normalizer.ts";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "carros.db");

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      externalId TEXT NOT NULL,
      agencyId TEXT NOT NULL,
      agencyName TEXT NOT NULL,
      title TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      bodyType TEXT NOT NULL,
      priceOriginal REAL NOT NULL,
      currencyOriginal TEXT NOT NULL,
      priceUSD REAL NOT NULL,
      priceCRC REAL NOT NULL,
      mileageKm INTEGER,
      transmission TEXT,
      fuelType TEXT,
      engine TEXT,
      imageUrl TEXT,
      sourceUrl TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_agency ON vehicles(agencyId);
    CREATE INDEX IF NOT EXISTS idx_vehicles_brand ON vehicles(brand);
    CREATE INDEX IF NOT EXISTS idx_vehicles_year ON vehicles(year);
    CREATE INDEX IF NOT EXISTS idx_vehicles_priceUSD ON vehicles(priceUSD);

    CREATE TABLE IF NOT EXISTS agency_sync_status (
      agencyId TEXT PRIMARY KEY,
      agencyName TEXT NOT NULL,
      lastSyncedAt TEXT,
      vehicleCount INTEGER NOT NULL DEFAULT 0,
      lastStatus TEXT NOT NULL DEFAULT 'idle',
      lastError TEXT
    );
  `);

  // Ensure all configured agencies have a status row
  const insertAgency = db.prepare(`
    INSERT OR IGNORE INTO agency_sync_status (agencyId, agencyName, lastSyncedAt, vehicleCount, lastStatus, lastError)
    VALUES (?, ?, NULL, 0, 'idle', NULL)
  `);
  for (const agency of AGENCIES) {
    insertAgency.run(agency.id, agency.name);
  }

  dbInstance = db;
  return db;
}

export function replaceAgencyVehicles(agencyId: string, agencyName: string, vehicles: RawVehicle[]): number {
  const db = getDb();
  const now = new Date().toISOString();

  db.exec("BEGIN TRANSACTION");
  try {
    if (vehicles.length > 0) {
      db.prepare("DELETE FROM vehicles WHERE agencyId = ?").run(agencyId);

      const insert = db.prepare(`
        INSERT OR REPLACE INTO vehicles (
          id, externalId, agencyId, agencyName, title, brand, model, year, bodyType,
          priceOriginal, currencyOriginal, priceUSD, priceCRC,
          mileageKm, transmission, fuelType, engine, imageUrl, sourceUrl, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const v of vehicles) {
        const id = `${v.agencyId}:${v.externalId}`;
        const computedEngine = normalizeEngine(
          v.engine,
          `${v.brand} ${v.model} ${v.title} ${v.sourceUrl}`,
          v.fuelType
        );
        insert.run(
          id,
          v.externalId,
          v.agencyId,
          v.agencyName,
          v.title,
          v.brand,
          v.model,
          v.year,
          v.bodyType,
          v.priceOriginal,
          v.currencyOriginal,
          v.priceUSD,
          v.priceCRC,
          v.mileageKm ?? null,
          v.transmission ?? "Automático",
          v.fuelType ?? "Gasolina",
          computedEngine !== "N/D" ? computedEngine : v.engine ?? null,
          v.imageUrl ?? null,
          v.sourceUrl,
          now
        );
      }
    }

    const countRow = db
      .prepare("SELECT COUNT(*) as total FROM vehicles WHERE agencyId = ?")
      .get(agencyId) as { total: number };

    db.prepare(`
      INSERT OR REPLACE INTO agency_sync_status (agencyId, agencyName, lastSyncedAt, vehicleCount, lastStatus, lastError)
      VALUES (?, ?, ?, ?, 'ok', NULL)
    `).run(agencyId, agencyName, now, countRow.total);

    db.exec("COMMIT");
    return countRow.total;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function markAgencySyncError(agencyId: string, agencyName: string, errorMsg: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const countRow = db
    .prepare("SELECT COUNT(*) as total FROM vehicles WHERE agencyId = ?")
    .get(agencyId) as { total: number };

  db.prepare(`
    INSERT OR REPLACE INTO agency_sync_status (agencyId, agencyName, lastSyncedAt, vehicleCount, lastStatus, lastError)
    VALUES (?, ?, ?, ?, 'error', ?)
  `).run(agencyId, agencyName, now, countRow?.total ?? 0, errorMsg);
}

export function getAllVehicles(): Vehicle[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM vehicles ORDER BY priceUSD ASC, year DESC")
    .all() as unknown as Vehicle[];
  return rows.map((v) => ({
    ...v,
    engine:
      v.engine && v.engine !== "N/D"
        ? v.engine
        : normalizeEngine(
            v.engine,
            `${v.brand} ${v.model} ${v.title} ${v.sourceUrl}`,
            v.fuelType
          )
  }));
}

export function getAgencyStatuses(): AgencySyncStatus[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM agency_sync_status ORDER BY agencyName ASC")
    .all() as unknown as AgencySyncStatus[];
  return rows;
}
