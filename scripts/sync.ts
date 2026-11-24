import { syncAgencies } from "../src/scrapers/index.ts";

async function main() {
  const args = process.argv.slice(2);
  const agencyIds = args.length > 0 ? args : undefined;
  console.log(
    agencyIds
      ? `Sincronizando agencias: ${agencyIds.join(", ")}...`
      : "Sincronizando inventarios de las 6 agencias de Costa Rica..."
  );
  const t0 = Date.now();
  const results = await syncAgencies(agencyIds);
  console.log(`\nSincronización completada en ${((Date.now() - t0) / 1000).toFixed(1)}s:`);
  for (const r of results) {
    console.log(
      ` - ${r.agencyName} (${r.agencyId}): ${
        r.ok ? `OK (${r.count} carros)` : `ERROR (${r.error})`
      }`
    );
  }
}

main();
