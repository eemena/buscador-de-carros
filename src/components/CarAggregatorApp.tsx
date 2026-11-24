"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AGENCIES,
  AgencySyncStatus,
  BodyType,
  Currency,
  Vehicle
} from "@/types/vehicle";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/normalizer";
import {
  ArrowUpDown,
  Bookmark,
  BookmarkCheck,
  Building2,
  Calculator,
  Calendar,
  Car,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  Filter,
  Fuel,
  Gauge,
  LayoutGrid,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X
} from "lucide-react";

const BODY_TYPES: BodyType[] = [
  "SUV",
  "Sedán",
  "Pick-up",
  "Hatchback",
  "Crossover",
  "Coupe",
  "Van / Comercial",
  "Otro"
];

type SortOption =
  | "price_asc"
  | "price_desc"
  | "net_asc"
  | "year_desc"
  | "year_asc"
  | "km_asc";

export default function CarAggregatorApp() {
  // Server state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [statuses, setStatuses] = useState<AgencySyncStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncingAgencyId, setSyncingAgencyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Currency & Exchange Rate (Default USD per user request)
  const [currency, setCurrency] = useState<Currency>("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);

  // Active View inside Single Page ("explore" | "compare")
  const [activeTab, setActiveTab] = useState<"explore" | "compare">("explore");
  const [showTradeInModal, setShowTradeInModal] = useState<boolean>(false);

  // Saved vehicle IDs for comparison
  const [savedIds, setSavedIds] = useState<string[]>([]);

  // Per-agency trade-in values stored in USD (so switching USD<->CRC converts seamlessly)
  const [baseTradeInUSD, setBaseTradeInUSD] = useState<number>(0);
  const [agencyTradeInUSD, setAgencyTradeInUSD] = useState<Record<string, number>>({
    carsot: 0,
    seminuevoscr: 0,
    purdy: 0,
    autostar: 0,
    veinsa: 0,
    honda: 0
  });
  // Optional per-vehicle override in comparison view
  const [vehicleOverrideTradeInUSD, setVehicleOverrideTradeInUSD] = useState<
    Record<string, number>
  >({});

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [selectedBodyTypes, setSelectedBodyTypes] = useState<BodyType[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [yearFrom, setYearFrom] = useState<string>("");
  const [yearTo, setYearTo] = useState<string>("");
  const [minPriceInput, setMinPriceInput] = useState<string>("");
  const [maxPriceInput, setMaxPriceInput] = useState<string>("");
  const [filterByNetPrice, setFilterByNetPrice] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>("price_asc");

  // Load persisted state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("carros_cr_saved_ids");
      if (saved) setSavedIds(JSON.parse(saved));

      const tradeIns = localStorage.getItem("carros_cr_agency_tradeins");
      if (tradeIns) setAgencyTradeInUSD(JSON.parse(tradeIns));

      const baseTrade = localStorage.getItem("carros_cr_base_tradein");
      if (baseTrade) setBaseTradeInUSD(Number(baseTrade) || 0);

      const savedRate = localStorage.getItem("carros_cr_exchange_rate");
      if (savedRate && Number(savedRate) > 100) {
        setExchangeRate(Number(savedRate));
      }

      const savedCurr = localStorage.getItem("carros_cr_currency");
      if (savedCurr === "USD" || savedCurr === "CRC") {
        setCurrency(savedCurr);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Save state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("carros_cr_saved_ids", JSON.stringify(savedIds));
    } catch {}
  }, [savedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "carros_cr_agency_tradeins",
        JSON.stringify(agencyTradeInUSD)
      );
    } catch {}
  }, [agencyTradeInUSD]);

  useEffect(() => {
    try {
      localStorage.setItem("carros_cr_base_tradein", String(baseTradeInUSD));
    } catch {}
  }, [baseTradeInUSD]);

  useEffect(() => {
    try {
      localStorage.setItem("carros_cr_exchange_rate", String(exchangeRate));
      localStorage.setItem("carros_cr_currency", currency);
    } catch {}
  }, [exchangeRate, currency]);

  // Fetch initial vehicles from local SQLite database
  async function loadVehicles() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/vehicles");
      const data = await res.json();
      if (data.ok) {
        setVehicles(data.vehicles || []);
        setStatuses(data.statuses || []);
        // If DB is completely empty on first launch, trigger initial sync automatically
        if ((data.vehicles || []).length === 0) {
          await handleSyncAll();
        }
      } else {
        setErrorMsg(data.error || "Error cargando inventario");
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "No se pudo conectar con el servidor"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSyncAll(agencyId?: string) {
    if (syncing) return;
    setSyncing(true);
    if (agencyId) setSyncingAgencyId(agencyId);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyIds: agencyId ? [agencyId] : undefined,
          exchangeRate
        })
      });
      const data = await res.json();
      if (data.ok) {
        setVehicles(data.vehicles || []);
        setStatuses(data.statuses || []);
      } else {
        setErrorMsg(data.error || "Error durante la sincronización");
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error de red al sincronizar"
      );
    } finally {
      setSyncing(false);
      setSyncingAgencyId(null);
    }
  }

  // Currency formatting & conversion helpers
  function getDisplayPrice(vehiclePriceUSD: number): number {
    return currency === "USD"
      ? Math.round(vehiclePriceUSD)
      : Math.round(vehiclePriceUSD * exchangeRate);
  }

  function formatMoney(amountInUSD: number, targetCurrency: Currency = currency): string {
    const val =
      targetCurrency === "USD"
        ? Math.round(amountInUSD)
        : Math.round(amountInUSD * exchangeRate);
    const sign = val < 0 ? "-" : "";
    const absVal = Math.abs(val);
    const symbol = targetCurrency === "USD" ? "$" : "₡";
    return `${sign}${symbol}${absVal.toLocaleString("en-US")}`;
  }

  function getTradeInForVehicleUSD(v: Vehicle): number {
    if (vehicleOverrideTradeInUSD[v.id] !== undefined) {
      return vehicleOverrideTradeInUSD[v.id];
    }
    const agencyVal = agencyTradeInUSD[v.agencyId];
    if (agencyVal && agencyVal > 0) {
      return agencyVal;
    }
    return baseTradeInUSD > 0 ? baseTradeInUSD : 0;
  }

  function getNetPriceUSD(v: Vehicle): number {
    const tradeIn = getTradeInForVehicleUSD(v);
    return v.priceUSD - tradeIn;
  }

  function applyBaseTradeInToAll(amountUSD: number) {
    setBaseTradeInUSD(amountUSD);
    const updated: Record<string, number> = {};
    for (const ag of AGENCIES) {
      updated[ag.id] = amountUSD;
    }
    setAgencyTradeInUSD(updated);
  }

  // Dynamic Brand & Model options based on real inventory
  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of vehicles) {
      if (
        selectedAgencies.length > 0 &&
        !selectedAgencies.includes(v.agencyId)
      ) {
        continue;
      }
      if (
        selectedBodyTypes.length > 0 &&
        !selectedBodyTypes.includes(v.bodyType)
      ) {
        continue;
      }
      counts.set(v.brand, (counts.get(v.brand) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([brand, count]) => ({ brand, count }));
  }, [vehicles, selectedAgencies, selectedBodyTypes]);

  const availableModels = useMemo(() => {
    const counts = new Map<string, { brand: string; model: string; count: number }>();
    for (const v of vehicles) {
      if (selectedBrands.length > 0 && !selectedBrands.includes(v.brand)) continue;
      if (
        selectedAgencies.length > 0 &&
        !selectedAgencies.includes(v.agencyId)
      ) {
        continue;
      }
      if (
        selectedBodyTypes.length > 0 &&
        !selectedBodyTypes.includes(v.bodyType)
      ) {
        continue;
      }
      const existing = counts.get(v.model);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(v.model, { brand: v.brand, model: v.model, count: 1 });
      }
    }
    return Array.from(counts.values()).sort((a, b) =>
      `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)
    );
  }, [vehicles, selectedBrands, selectedAgencies, selectedBodyTypes]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const v of vehicles) {
      if (v.year >= 1990 && v.year <= 2027) years.add(v.year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [vehicles]);

  // Filtered and Sorted Vehicles
  const filteredVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const yMin = yearFrom ? parseInt(yearFrom, 10) : null;
    const yMax = yearTo ? parseInt(yearTo, 10) : null;
    const pMinRaw = minPriceInput ? parseFloat(minPriceInput.replace(/[^\d.]/g, "")) : null;
    const pMaxRaw = maxPriceInput ? parseFloat(maxPriceInput.replace(/[^\d.]/g, "")) : null;

    // Convert user's min/max price input from active currency to USD for comparison
    const pMinUSD =
      pMinRaw !== null && !isNaN(pMinRaw)
        ? currency === "USD"
          ? pMinRaw
          : pMinRaw / exchangeRate
        : null;
    const pMaxUSD =
      pMaxRaw !== null && !isNaN(pMaxRaw)
        ? currency === "USD"
          ? pMaxRaw
          : pMaxRaw / exchangeRate
        : null;

    const list = vehicles.filter((v) => {
      if (selectedAgencies.length > 0 && !selectedAgencies.includes(v.agencyId)) {
        return false;
      }
      if (selectedBodyTypes.length > 0 && !selectedBodyTypes.includes(v.bodyType)) {
        return false;
      }
      if (selectedBrands.length > 0 && !selectedBrands.includes(v.brand)) {
        return false;
      }
      if (selectedModels.length > 0 && !selectedModels.includes(v.model)) {
        return false;
      }
      if (yMin && v.year < yMin) return false;
      if (yMax && v.year > yMax) return false;

      const targetPriceUSD = filterByNetPrice
        ? Math.max(0, v.priceUSD - getTradeInForVehicleUSD(v))
        : v.priceUSD;

      if (pMinUSD !== null && targetPriceUSD < pMinUSD) return false;
      if (pMaxUSD !== null && targetPriceUSD > pMaxUSD) return false;

      if (q) {
        const haystack =
          `${v.title} ${v.brand} ${v.model} ${v.year} ${v.agencyName} ${v.bodyType} ${v.engine || ""} ${v.transmission || ""} ${v.fuelType || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case "price_asc":
          return a.priceUSD - b.priceUSD;
        case "price_desc":
          return b.priceUSD - a.priceUSD;
        case "net_asc":
          return getNetPriceUSD(a) - getNetPriceUSD(b);
        case "year_desc":
          return b.year - a.year || a.priceUSD - b.priceUSD;
        case "year_asc":
          return a.year - b.year || a.priceUSD - b.priceUSD;
        case "km_asc": {
          const kmA = a.mileageKm ?? 999999;
          const kmB = b.mileageKm ?? 999999;
          return kmA - kmB;
        }
        default:
          return a.priceUSD - b.priceUSD;
      }
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    vehicles,
    searchQuery,
    selectedAgencies,
    selectedBodyTypes,
    selectedBrands,
    selectedModels,
    yearFrom,
    yearTo,
    minPriceInput,
    maxPriceInput,
    filterByNetPrice,
    sortBy,
    currency,
    exchangeRate,
    agencyTradeInUSD,
    baseTradeInUSD,
    vehicleOverrideTradeInUSD
  ]);

  const savedVehicles = useMemo(() => {
    const map = new Map(vehicles.map((v) => [v.id, v]));
    return savedIds.map((id) => map.get(id)).filter((v): v is Vehicle => !!v);
  }, [vehicles, savedIds]);

  function toggleSaveVehicle(id: string) {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleAgencyFilter(agencyId: string) {
    setSelectedAgencies((prev) =>
      prev.includes(agencyId)
        ? prev.filter((id) => id !== agencyId)
        : [...prev, agencyId]
    );
  }

  function toggleBodyTypeFilter(bt: BodyType) {
    setSelectedBodyTypes((prev) =>
      prev.includes(bt) ? prev.filter((item) => item !== bt) : [...prev, bt]
    );
  }

  function toggleBrandFilter(brand: string) {
    setSelectedBrands((prev) => {
      const next = prev.includes(brand)
        ? prev.filter((b) => b !== brand)
        : [...prev, brand];
      if (next.length > 0) {
        const validModels = new Set(
          vehicles.filter((v) => next.includes(v.brand)).map((v) => v.model)
        );
        setSelectedModels((currModels) =>
          currModels.filter((m) => validModels.has(m))
        );
      }
      return next;
    });
  }

  function toggleModelFilter(model: string) {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  }

  function resetFilters() {
    setSearchQuery("");
    setSelectedAgencies([]);
    setSelectedBodyTypes([]);
    setSelectedBrands([]);
    setSelectedModels([]);
    setYearFrom("");
    setYearTo("");
    setMinPriceInput("");
    setMaxPriceInput("");
    setFilterByNetPrice(false);
    setSortBy("price_asc");
  }

  const hasAnyTradeInConfigured = useMemo(() => {
    if (baseTradeInUSD > 0) return true;
    return Object.values(agencyTradeInUSD).some((val) => val > 0);
  }, [baseTradeInUSD, agencyTradeInUSD]);

  const lowestNetVehicleId = useMemo(() => {
    if (savedVehicles.length < 2) return null;
    let minVal = Infinity;
    let minId: string | null = null;
    for (const v of savedVehicles) {
      const net = getNetPriceUSD(v);
      if (net < minVal) {
        minVal = net;
        minId = v.id;
      }
    }
    return minId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedVehicles, agencyTradeInUSD, baseTradeInUSD, vehicleOverrideTradeInUSD]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b1120] text-slate-100">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0f172a]/95 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Carros Usados CR
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {vehicles.length} disponibles
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Buscador unificado de agencias y calculadora de recibo por agencia
              </p>
            </div>
          </div>

          {/* Center Navigation Switcher: Explorar vs Comparar */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("explore")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === "explore"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Catálogo ({filteredVehicles.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("compare")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === "compare"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Comparar y Recibo</span>
              <span
                className={`ml-1 px-2 py-0.5 text-xs rounded-full font-semibold ${
                  savedVehicles.length > 0
                    ? activeTab === "compare"
                      ? "bg-white text-emerald-700"
                      : "bg-emerald-500 text-slate-950"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {savedVehicles.length}
              </span>
            </button>
          </div>

          {/* Right Controls: Trade-In Button, Currency Switcher, Exchange Rate, Sync */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Quick Trade-In Configurator Button */}
            <button
              onClick={() => setShowTradeInModal(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer ${
                hasAnyTradeInConfigured
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
                  : "bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800"
              }`}
              title="Configurar cuánto te da cada agencia por tu carro actual"
            >
              <Calculator className="w-4 h-4 text-amber-400" />
              <span>
                {hasAnyTradeInConfigured
                  ? "Recibo Configurado"
                  : "Mi Carro en Recibo"}
              </span>
            </button>

            {/* Currency Toggle USD <-> CRC */}
            <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
              <button
                onClick={() => setCurrency("USD")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currency === "USD"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                USD ($)
              </button>
              <button
                onClick={() => setCurrency("CRC")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currency === "CRC"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                CRC (₡)
              </button>
            </div>

            {/* Exchange Rate Input */}
            <div
              className="hidden md:flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs"
              title="Tipo de cambio USD a Colones"
            >
              <span className="text-slate-400">T.C. ₡</span>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) setExchangeRate(val);
                }}
                className="w-14 bg-transparent text-white font-semibold focus:outline-none text-center border-b border-slate-700 focus:border-emerald-500"
              />
            </div>

            {/* Sync Button */}
            <button
              onClick={() => handleSyncAll()}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all disabled:opacity-60 cursor-pointer"
              title="Actualizar inventario en vivo desde las 6 agencias"
            >
              <RefreshCw
                className={`w-4 h-4 text-emerald-400 ${
                  syncing ? "animate-spin" : ""
                }`}
              />
              <span>{syncing ? "Sincronizando..." : "Actualizar Agencias"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ERROR BANNER IF ANY */}
      {errorMsg && (
        <div className="bg-red-950/60 border-b border-red-800/60 px-4 py-2.5 text-center text-xs sm:text-sm text-red-200 flex items-center justify-center gap-3">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-red-400 hover:text-white underline text-xs"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* MAIN SINGLE-PAGE CONTENT */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === "explore" ? (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* LEFT / TOP FILTER SIDEBAR */}
            <aside className="w-full lg:w-80 shrink-0 bg-[#111827] border border-slate-800/90 rounded-2xl p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Filter className="w-4 h-4 text-emerald-400" />
                  <span>Filtros de Búsqueda</span>
                </div>
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              </div>

              {/* Free Text Search */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Búsqueda rápida
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ej. RAV4, CR-V, Hilux, Eléctrico..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Agencies Filter (Compact Grid + Scroll) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-400">
                    Agencias ({selectedAgencies.length ? `${selectedAgencies.length}/${AGENCIES.length}` : "Todas"})
                  </label>
                  {selectedAgencies.length > 0 && (
                    <button
                      onClick={() => setSelectedAgencies([])}
                      className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                    >
                      Ver todas
                    </button>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto bg-slate-900/80 border border-slate-800 rounded-xl p-1.5 grid grid-cols-2 gap-1.5">
                  {AGENCIES.map((ag) => {
                    const st = statuses.find((s) => s.agencyId === ag.id);
                    const count = vehicles.filter(
                      (v) => v.agencyId === ag.id
                    ).length;
                    const isSelected = selectedAgencies.includes(ag.id);
                    const tradeIn =
                      agencyTradeInUSD[ag.id] || baseTradeInUSD || 0;
                    const shortName = ag.name
                      .replace(/\s*\(.*?\)\s*/g, "")
                      .replace(/\s+CR$/i, "")
                      .replace(/\s+Usados$/i, "");

                    return (
                      <div
                        key={ag.id}
                        title={`${ag.name} (${count} vehículos)${
                          tradeIn > 0 ? ` • Recibo: ${formatMoney(tradeIn)}` : ""
                        }`}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-[11px] transition-all ${
                          isSelected
                            ? "bg-emerald-500/20 border-emerald-500/60 text-white font-semibold"
                            : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleAgencyFilter(ag.id)}
                          className="flex items-center gap-1.5 flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: ag.color }}
                          />
                          <span className="truncate">{shortName}</span>
                        </button>

                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-semibold">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSyncAll(ag.id)}
                            disabled={syncing}
                            title={`Sincronizar solo ${ag.name}${
                              st?.lastError ? ` (Último error: ${st.lastError})` : ""
                            }`}
                            className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-emerald-400 cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-2.5 h-2.5 ${
                                syncingAgencyId === ag.id ? "animate-spin text-emerald-400" : ""
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Body Type (Tipo de Carro) */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Tipo de Carrocería
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {BODY_TYPES.map((bt) => {
                    const active = selectedBodyTypes.includes(bt);
                    return (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => toggleBodyTypeFilter(bt)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          active
                            ? "bg-emerald-500 text-slate-950 border-emerald-400 font-semibold"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        {bt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Select Brands & Models */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-400">
                      Marcas ({selectedBrands.length || "Todas"})
                    </label>
                    {selectedBrands.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBrands([]);
                          setSelectedModels([]);
                        }}
                        className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                      >
                        Todas
                      </button>
                    )}
                  </div>
                  <div className="max-h-32 overflow-y-auto bg-slate-900/80 border border-slate-800 rounded-xl p-2 space-y-1">
                    {availableBrands.map((b) => {
                      const checked = selectedBrands.includes(b.brand);
                      return (
                        <label
                          key={b.brand}
                          className={`flex items-center justify-between px-2 py-1 rounded-lg text-xs cursor-pointer transition-colors ${
                            checked
                              ? "bg-emerald-500/15 text-emerald-300 font-semibold"
                              : "text-slate-300 hover:bg-slate-800/70"
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleBrandFilter(b.brand)}
                              className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="truncate">{b.brand}</span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {b.count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-400">
                      Modelos ({selectedModels.length || "Todos"})
                    </label>
                    {selectedModels.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedModels([])}
                        className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                      >
                        Todos
                      </button>
                    )}
                  </div>
                  <div className="max-h-32 overflow-y-auto bg-slate-900/80 border border-slate-800 rounded-xl p-2 space-y-1">
                    {availableModels.map((m) => {
                      const checked = selectedModels.includes(m.model);
                      return (
                        <label
                          key={`${m.brand}-${m.model}`}
                          className={`flex items-center justify-between px-2 py-1 rounded-lg text-xs cursor-pointer transition-colors ${
                            checked
                              ? "bg-emerald-500/15 text-emerald-300 font-semibold"
                              : "text-slate-300 hover:bg-slate-800/70"
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleModelFilter(m.model)}
                              className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="truncate">
                              <strong className="text-slate-200">{m.brand}</strong>{" "}
                              {m.model}
                            </span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {m.count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Year Range */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Rango de Año
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={yearFrom}
                    onChange={(e) => setYearFrom(e.target.value)}
                    className="px-2.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Desde</option>
                    {[...availableYears].reverse().map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <select
                    value={yearTo}
                    onChange={(e) => setYearTo(e.target.value)}
                    className="px-2.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Hasta</option>
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price Range */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-400">
                    Rango de Precio ({currency === "USD" ? "$" : "₡"})
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder={`Mín (${currency === "USD" ? "ej. 10000" : "ej. 5000000"})`}
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    placeholder={`Máx (${currency === "USD" ? "ej. 35000" : "ej. 18000000"})`}
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Filter by Net Price after Trade-in toggle */}
                <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterByNetPrice}
                    onChange={(e) => setFilterByNetPrice(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>
                    Filtrar por <strong>saldo a poner</strong> (restando mi usado)
                  </span>
                </label>
              </div>
            </aside>

            {/* RIGHT RESULTS AREA */}
            <section className="flex-1 min-w-0 space-y-4">
              {/* Top Bar above Grid: Sort & Active Summary */}
              <div className="bg-[#111827] border border-slate-800/90 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">
                    Mostrando {filteredVehicles.length} de {vehicles.length} vehículos
                  </span>
                  {savedVehicles.length > 0 && (
                    <button
                      onClick={() => setActiveTab("compare")}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                    >
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      <span>
                        Ver {savedVehicles.length} guardado
                        {savedVehicles.length === 1 ? "" : "s"} en Comparador →
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">Ordenar por:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="price_asc">Precio: Menor a Mayor</option>
                    <option value="price_desc">Precio: Mayor a Menor</option>
                    <option value="net_asc">
                      Saldo Neto a Poner: Menor a Mayor
                    </option>
                    <option value="year_desc">Año: Más Recientes Primero</option>
                    <option value="year_asc">Año: Más Antiguos Primero</option>
                    <option value="km_asc">Menor Kilometraje</option>
                  </select>
                </div>
              </div>

              {/* Loading Skeleton or Results Grid */}
              {loading && vehicles.length === 0 ? (
                <div className="bg-[#111827] border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                  <h3 className="text-base font-semibold text-white">
                    Consultando agencias de Costa Rica...
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Extrayendo inventario actualizado de Carsot, Seminuevos CR,
                    Purdy Usados, AutoStar, Veinsa y Honda Costa Rica.
                  </p>
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="bg-[#111827] border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                  <Car className="w-10 h-10 text-slate-500 mx-auto" />
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      No se encontraron vehículos con esos filtros
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Intenta ampliar el rango de precios, cambiar la carrocería o
                      limpiar los filtros activos.
                    </p>
                  </div>
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Restablecer todos los filtros
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredVehicles.map((v) => {
                    const isSaved = savedIds.includes(v.id);
                    const agencyMeta = AGENCIES.find((a) => a.id === v.agencyId);
                    const tradeInUSD = getTradeInForVehicleUSD(v);
                    const netUSD = v.priceUSD - tradeInUSD;
                    const secondaryCurrency: Currency =
                      currency === "USD" ? "CRC" : "USD";

                    return (
                      <article
                        key={v.id}
                        className={`group bg-[#111827] rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
                          isSaved
                            ? "border-emerald-500 ring-1 ring-emerald-500/40"
                            : "border-slate-800/90 hover:border-slate-700"
                        }`}
                      >
                        <div>
                          {/* Vehicle Image Header */}
                          <div className="relative h-48 bg-slate-900 overflow-hidden">
                            {v.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.imageUrl}
                                alt={v.title}
                                loading="lazy"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display =
                                    "none";
                                }}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-1">
                                <Car className="w-10 h-10" />
                                <span className="text-xs">Sin foto</span>
                              </div>
                            )}

                            {/* Top Left Agency Badge */}
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-950/85 text-white backdrop-blur-md border border-white/10">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: agencyMeta?.color || "#10b981"
                                }}
                              />
                              <span>{v.agencyName}</span>
                            </div>

                            {/* Top Right BodyType & Year Badge */}
                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-950/85 text-emerald-400 backdrop-blur-md border border-emerald-500/30">
                                {v.year}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-950/85 text-slate-200 backdrop-blur-md border border-white/10">
                                {v.bodyType}
                              </span>
                            </div>
                          </div>

                          {/* Vehicle Main Content */}
                          <div className="p-4 space-y-3">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                                {v.brand}
                              </div>
                              <h3
                                className="text-base font-bold text-white line-clamp-1"
                                title={v.title}
                              >
                                {v.model}
                              </h3>
                            </div>

                            {/* Key Specs Pills */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800"
                                title="Kilometraje"
                              >
                                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                                {v.mileageKm
                                  ? `${v.mileageKm.toLocaleString("en-US")} km`
                                  : "N/D"}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold"
                                title="Tamaño del motor / Cilindrada"
                              >
                                <span>⚙️ {v.engine || "N/D"}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800">
                                <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                                {v.transmission || "Automático"}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800">
                                <Fuel className="w-3.5 h-3.5 text-slate-400" />
                                {v.fuelType || "Gasolina"}
                              </span>
                            </div>

                            {/* Price & Net Balance Box */}
                            <div className="pt-2 border-t border-slate-800/80 flex items-end justify-between gap-2">
                              <div>
                                <span className="text-[11px] text-slate-400 block">
                                  Precio de agencia
                                </span>
                                <span className="text-xl font-extrabold text-white">
                                  {formatMoney(v.priceUSD, currency)}
                                </span>
                                <span className="text-[11px] text-slate-400 block">
                                  ≈ {formatMoney(v.priceUSD, secondaryCurrency)}
                                </span>
                              </div>

                              {tradeInUSD > 0 && (
                                <div className="text-right bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1.5">
                                  <span className="text-[10px] text-amber-300 block">
                                    Con tu usado ({formatMoney(tradeInUSD)})
                                  </span>
                                  <span className="text-sm font-bold text-emerald-400">
                                    Pones:{" "}
                                    {netUSD > 0
                                      ? formatMoney(netUSD)
                                      : `${formatMoney(Math.abs(netUSD))} a favor`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="px-4 pb-4 pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSaveVehicle(v.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              isSaved
                                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
                            }`}
                          >
                            {isSaved ? (
                              <>
                                <BookmarkCheck className="w-4 h-4" />
                                <span>Guardado</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="w-4 h-4" />
                                <span>Guardar / Comparar</span>
                              </>
                            )}
                          </button>

                          <a
                            href={v.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                            title="Abrir anuncio original en la agencia"
                          >
                            <span>Agencia</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* COMPARISON & PER-AGENCY TRADE-IN VIEW */
          <div className="space-y-6">
            {/* Section 1: Per-Agency Trade-In Configurator Card */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-bold text-white">
                      Calculadora de Recibo de tu Carro Usado (por Agencia)
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Ingresa cuánto te ofrece cada agencia por recibir tu vehículo
                    actual. Ese monto se restará automáticamente del precio de cada
                    carro de esa agencia para mostrarte exactamente{" "}
                    <strong className="text-slate-200">
                      cuánto dinero debes poner
                    </strong>
                    .
                  </p>
                </div>

                {/* Quick Global Trade-In Setter */}
                <div className="flex items-center gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-300">
                    <span className="block font-medium text-slate-400">
                      Valor base estimado ({currency})
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-slate-400 font-bold">
                        {currency === "USD" ? "$" : "₡"}
                      </span>
                      <input
                        type="number"
                        placeholder={currency === "USD" ? "Ej. 12000" : "Ej. 6000000"}
                        value={
                          baseTradeInUSD > 0
                            ? currency === "USD"
                              ? Math.round(baseTradeInUSD)
                              : Math.round(baseTradeInUSD * exchangeRate)
                            : ""
                        }
                        onChange={(e) => {
                          const raw = parseFloat(e.target.value);
                          if (isNaN(raw) || raw <= 0) {
                            setBaseTradeInUSD(0);
                          } else {
                            const inUSD =
                              currency === "USD" ? raw : raw / exchangeRate;
                            setBaseTradeInUSD(inUSD);
                          }
                        }}
                        className="w-28 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => applyBaseTradeInToAll(baseTradeInUSD)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer"
                      >
                        Aplicar a todas
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Agency Trade-In Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {AGENCIES.map((ag) => {
                  const valUSD = agencyTradeInUSD[ag.id] ?? 0;
                  const displayVal =
                    valUSD > 0
                      ? currency === "USD"
                        ? Math.round(valUSD)
                        : Math.round(valUSD * exchangeRate)
                      : "";

                  return (
                    <div
                      key={ag.id}
                      className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: ag.color }}
                        />
                        <span className="text-xs font-semibold text-white truncate">
                          {ag.name}
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          {currency === "USD" ? "$" : "₡"}
                        </span>
                        <input
                          type="number"
                          placeholder={
                            baseTradeInUSD > 0
                              ? String(
                                  currency === "USD"
                                    ? Math.round(baseTradeInUSD)
                                    : Math.round(baseTradeInUSD * exchangeRate)
                                )
                              : "0"
                          }
                          value={displayVal}
                          onChange={(e) => {
                            const raw = parseFloat(e.target.value);
                            const usd =
                              isNaN(raw) || raw <= 0
                                ? 0
                                : currency === "USD"
                                ? raw
                                : raw / exchangeRate;
                            setAgencyTradeInUSD((prev) => ({
                              ...prev,
                              [ag.id]: usd
                            }));
                          }}
                          className="w-full pl-6 pr-2 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm font-bold text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="text-[11px] text-slate-400 flex justify-between">
                        <span>Oferta agencia:</span>
                        <span className="text-slate-300 font-medium">
                          {valUSD > 0
                            ? formatMoney(
                                valUSD,
                                currency === "USD" ? "CRC" : "USD"
                              )
                            : baseTradeInUSD > 0
                            ? `Base: ${formatMoney(baseTradeInUSD)}`
                            : "Sin oferta"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Side-by-Side Comparison Table / Cards */}
            {savedVehicles.length === 0 ? (
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <Scale className="w-12 h-12 text-slate-500 mx-auto" />
                <div className="max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-white">
                    Aún no has seleccionado carros para comparar
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Ve al catálogo y presiona el botón{" "}
                    <strong className="text-emerald-400">
                      Guardar / Comparar
                    </strong>{" "}
                    en los vehículos que te interesen para compararlos lado a lado
                    y calcular cuánto debes poner en cada agencia.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("explore")}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Ir al Catálogo de Vehículos
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Comparativa Lado a Lado ({savedVehicles.length}{" "}
                      {savedVehicles.length === 1 ? "vehículo" : "vehículos"})
                    </h3>
                    <button
                      onClick={() => setActiveTab("explore")}
                      className="text-xs text-emerald-400 hover:underline cursor-pointer"
                    >
                      + Agregar más carros
                    </button>
                  </div>

                  <button
                    onClick={() => setSavedIds([])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar comparador</span>
                  </button>
                </div>

                {/* Horizontal Scrollable Comparison Grid */}
                <div className="overflow-x-auto pb-4">
                  <div className="inline-flex gap-4 min-w-full">
                    {savedVehicles.map((v) => {
                      const agencyMeta = AGENCIES.find(
                        (a) => a.id === v.agencyId
                      );
                      const tradeInUSD = getTradeInForVehicleUSD(v);
                      const netUSD = v.priceUSD - tradeInUSD;
                      const isBestDeal = lowestNetVehicleId === v.id;
                      const secondaryCurrency: Currency =
                        currency === "USD" ? "CRC" : "USD";

                      return (
                        <div
                          key={v.id}
                          className={`w-80 shrink-0 rounded-2xl border bg-[#111827] overflow-hidden flex flex-col justify-between transition-all ${
                            isBestDeal
                              ? "border-emerald-500 ring-2 ring-emerald-500/30 shadow-xl shadow-emerald-950/30"
                              : "border-slate-800"
                          }`}
                        >
                          <div>
                            {/* Best Net Difference Banner */}
                            {isBestDeal ? (
                              <div className="bg-emerald-500 text-slate-950 text-xs font-extrabold py-1.5 px-3 flex items-center justify-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>MENOR DESEMBOLSO DE BOLSILLO</span>
                              </div>
                            ) : (
                              <div className="bg-slate-900/90 text-slate-400 text-xs font-medium py-1.5 px-3 text-center border-b border-slate-800">
                                Opción guardada
                              </div>
                            )}

                            {/* Image & Remove Button */}
                            <div className="relative h-44 bg-slate-900">
                              {v.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={v.imageUrl}
                                  alt={v.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                  <Car className="w-10 h-10" />
                                </div>
                              )}
                              <button
                                onClick={() => toggleSaveVehicle(v.id)}
                                title="Quitar de la comparación"
                                className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-slate-950/80 text-slate-300 hover:text-red-400 hover:bg-slate-950 transition-colors cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-950/85 text-white border border-white/10">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{
                                    backgroundColor:
                                      agencyMeta?.color || "#10b981"
                                  }}
                                />
                                <span>{v.agencyName}</span>
                              </div>
                            </div>

                            {/* Vehicle Header Info */}
                            <div className="p-4 border-b border-slate-800">
                              <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                                <span>{v.brand}</span>
                                <span>Año {v.year}</span>
                              </div>
                              <h4 className="text-base font-bold text-white mt-0.5 line-clamp-1">
                                {v.model}
                              </h4>
                            </div>

                            {/* FINANCIAL BREAKDOWN: Price - TradeIn = Net to Pay */}
                            <div className="p-4 bg-slate-950/60 border-b border-slate-800 space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">
                                  Precio del carro:
                                </span>
                                <div className="text-right">
                                  <span className="text-sm font-bold text-white block">
                                    {formatMoney(v.priceUSD, currency)}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    ({formatMoney(v.priceUSD, secondaryCurrency)})
                                  </span>
                                </div>
                              </div>

                              {/* Editable Trade-In for this Agency / Vehicle */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-amber-300 font-medium">
                                    (-) Recibo en {v.agencyName.split(" ")[0]}:
                                  </span>
                                  <span className="text-xs font-semibold text-amber-300">
                                    -{formatMoney(tradeInUSD, currency)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-400">
                                    Ajustar recibo ({currency}):
                                  </span>
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={
                                      tradeInUSD > 0
                                        ? currency === "USD"
                                          ? Math.round(tradeInUSD)
                                          : Math.round(tradeInUSD * exchangeRate)
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const raw = parseFloat(e.target.value);
                                      const usd =
                                        isNaN(raw) || raw <= 0
                                          ? 0
                                          : currency === "USD"
                                          ? raw
                                          : raw / exchangeRate;
                                      setAgencyTradeInUSD((prev) => ({
                                        ...prev,
                                        [v.agencyId]: usd
                                      }));
                                    }}
                                    className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-semibold text-amber-300 focus:outline-none focus:border-amber-500"
                                  />
                                </div>
                              </div>

                              {/* Net Difference to Pay */}
                              <div className="pt-2.5 border-t border-slate-800 flex items-baseline justify-between">
                                <span className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                                  (=) Saldo a poner:
                                </span>
                                <div className="text-right">
                                  <span className="text-xl font-black text-emerald-400 block">
                                    {netUSD >= 0
                                      ? formatMoney(netUSD, currency)
                                      : `${formatMoney(
                                          Math.abs(netUSD),
                                          currency
                                        )} a tu favor`}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    ≈{" "}
                                    {formatMoney(
                                      Math.max(0, netUSD),
                                      secondaryCurrency
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Technical Specs Rows */}
                            <div className="p-4 space-y-2.5 text-xs">
                              <div className="flex justify-between py-1 border-b border-slate-800/60">
                                <span className="text-slate-400">Carrocería</span>
                                <span className="font-medium text-slate-200">
                                  {v.bodyType}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-800/60">
                                <span className="text-slate-400">Año</span>
                                <span className="font-medium text-slate-200">
                                  {v.year}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-800/60">
                                <span className="text-slate-400">Kilometraje</span>
                                <span className="font-medium text-slate-200">
                                  {v.mileageKm
                                    ? `${v.mileageKm.toLocaleString("en-US")} km`
                                    : "No especificado"}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-800/60">
                                <span className="text-slate-400">Motor / Cilindrada</span>
                                <span className="font-semibold text-emerald-400">
                                  ⚙️ {v.engine || "N/D"}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-800/60">
                                <span className="text-slate-400">Transmisión</span>
                                <span className="font-medium text-slate-200">
                                  {v.transmission || "Automático"}
                                </span>
                              </div>
                              <div className="flex justify-between py-1">
                                <span className="text-slate-400">Combustible</span>
                                <span className="font-medium text-slate-200">
                                  {v.fuelType || "Gasolina"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Direct Link to Agency Page */}
                          <div className="p-4 pt-0">
                            <a
                              href={v.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                            >
                              <span>Ver Ficha en {v.agencyName}</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FLOATING BOTTOM COMPARISON BAR WHEN IN EXPLORE MODE */}
      {activeTab === "explore" && savedVehicles.length > 0 && (
        <div className="sticky bottom-4 z-20 max-w-4xl w-full mx-auto px-4">
          <div className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-3 sm:px-5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2 overflow-hidden">
                {savedVehicles.slice(0, 5).map((v) => (
                  <div
                    key={v.id}
                    className="inline-block h-9 w-9 rounded-full ring-2 ring-slate-900 bg-slate-800 overflow-hidden"
                    title={`${v.title} (${formatMoney(v.priceUSD)})`}
                  >
                    {v.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.imageUrl}
                        alt={v.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Car className="w-5 h-5 m-2 text-slate-400" />
                    )}
                  </div>
                ))}
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-white block">
                  {savedVehicles.length}{" "}
                  {savedVehicles.length === 1
                    ? "carro seleccionado"
                    : "carros seleccionados"}{" "}
                  para comparar
                </span>
                <span className="text-[11px] text-slate-400">
                  Compara precios, especificaciones y resta el valor de tu carro
                  usado por agencia
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSavedIds([])}
                className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Limpiar
              </button>
              <button
                onClick={() => setActiveTab("compare")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <Scale className="w-4 h-4" />
                <span>Ir a Comparar ({savedVehicles.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FOR CONFIGURING TRADE-IN FROM ANYWHERE */}
      {showTradeInModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">
                  Cuánto me dan por recibir mi carro usado ({currency})
                </h3>
              </div>
              <button
                onClick={() => setShowTradeInModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-300">
              Puedes definir un monto estimado general o personalizar cuánto te
              ofrece cada agencia por separado. El monto se descontará del precio
              total de cada vehículo.
            </p>

            {/* Global Base Amount */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-white block">
                  Monto base general de recibo ({currency})
                </span>
                <span className="text-[11px] text-slate-400">
                  Úsalo para rellenar rápido todas las agencias y luego ajusta las
                  que varíen
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-400">
                  {currency === "USD" ? "$" : "₡"}
                </span>
                <input
                  type="number"
                  placeholder={currency === "USD" ? "12000" : "6000000"}
                  value={
                    baseTradeInUSD > 0
                      ? currency === "USD"
                        ? Math.round(baseTradeInUSD)
                        : Math.round(baseTradeInUSD * exchangeRate)
                      : ""
                  }
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value);
                    const usd =
                      isNaN(raw) || raw <= 0
                        ? 0
                        : currency === "USD"
                        ? raw
                        : raw / exchangeRate;
                    setBaseTradeInUSD(usd);
                  }}
                  className="w-32 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => applyBaseTradeInToAll(baseTradeInUSD)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
                >
                  Aplicar a todas
                </button>
              </div>
            </div>

            {/* Per-Agency Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AGENCIES.map((ag) => {
                const valUSD = agencyTradeInUSD[ag.id] ?? 0;
                const displayVal =
                  valUSD > 0
                    ? currency === "USD"
                      ? Math.round(valUSD)
                      : Math.round(valUSD * exchangeRate)
                    : "";

                return (
                  <div
                    key={ag.id}
                    className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ag.color }}
                      />
                      <span className="text-xs font-semibold text-white truncate">
                        {ag.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-bold text-slate-400">
                        {currency === "USD" ? "$" : "₡"}
                      </span>
                      <input
                        type="number"
                        placeholder="0"
                        value={displayVal}
                        onChange={(e) => {
                          const raw = parseFloat(e.target.value);
                          const usd =
                            isNaN(raw) || raw <= 0
                              ? 0
                              : currency === "USD"
                              ? raw
                              : raw / exchangeRate;
                          setAgencyTradeInUSD((prev) => ({
                            ...prev,
                            [ag.id]: usd
                          }));
                        }}
                        className="w-28 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  applyBaseTradeInToAll(0);
                  setVehicleOverrideTradeInUSD({});
                }}
                className="text-xs text-slate-400 hover:text-red-400 cursor-pointer"
              >
                Poner todos en 0
              </button>
              <button
                type="button"
                onClick={() => setShowTradeInModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
              >
                Listo, aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
