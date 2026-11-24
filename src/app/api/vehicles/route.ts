import { NextResponse } from "next/server";
import { getAgencyStatuses, getAllVehicles } from "@/lib/db";
import { AGENCIES } from "@/types/vehicle";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vehicles = getAllVehicles();
    const statuses = getAgencyStatuses();
    return NextResponse.json({
      ok: true,
      agencies: AGENCIES,
      statuses,
      vehicles
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
