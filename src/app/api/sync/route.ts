import { NextRequest, NextResponse } from "next/server";
import { syncAgencies } from "@/scrapers";
import { getAgencyStatuses, getAllVehicles } from "@/lib/db";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/normalizer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let agencyIds: string[] | undefined = undefined;
    let exchangeRate = DEFAULT_EXCHANGE_RATE;

    try {
      const body = await req.json();
      if (Array.isArray(body?.agencyIds)) {
        agencyIds = body.agencyIds;
      }
      if (typeof body?.exchangeRate === "number" && body.exchangeRate > 0) {
        exchangeRate = body.exchangeRate;
      }
    } catch {
      // Empty body is fine (syncs all agencies)
    }

    const syncResults = await syncAgencies(agencyIds, exchangeRate);
    const vehicles = getAllVehicles();
    const statuses = getAgencyStatuses();

    return NextResponse.json({
      ok: true,
      syncResults,
      statuses,
      vehicles
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al sincronizar agencias";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
