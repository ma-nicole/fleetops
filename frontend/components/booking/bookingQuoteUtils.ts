import type { BookingPricingBreakdown } from "@/lib/bookingRouteEstimate";
import type { FreightLineDetail, QuoteGeoMeta, RouteQuoteApiResponse } from "./wizardTypes";

export function freightLinesFromPayload(data: RouteQuoteApiResponse): FreightLineDetail {
  return {
    booking_weight_tons: data.weight_tons,
    total_trucks: data.total_trucks,
    cargo_rate_php_per_ton: data.cargo_rate_php_per_ton,
    diesel_liters: data.diesel_liters,
    diesel_cost_php: data.diesel_cost_php,
    driver_share_php: data.driver_share_php,
    helper_share_php: data.helper_share_php,
    toll_fees_php: data.toll_fees_php,
    additives_total_php: data.additives_total_php,
    diesel_price_per_liter: data.diesel_price_per_liter,
    driver_freight_share_pct: data.driver_freight_share_pct,
    helper_freight_share_pct: data.helper_freight_share_pct,
    truck_loads: data.truck_loads,
    maintenance_cost_php: data.maintenance_cost_php ?? 0,
    service_fee_php: data.service_fee_php ?? 0,
    fuel_price_source: data.fuel_price_source ?? null,
    fuel_price_fetched_at: data.fuel_price_fetched_at ?? null,
    toll_source: data.toll_source ?? (data.toll_matrix_matched ? "Toll Matrix" : "Flat toll fallback"),
    toll_is_estimated: Boolean(data.toll_is_estimated),
  };
}

export function freightLinesFromBreakdown(b: BookingPricingBreakdown): FreightLineDetail {
  return {
    booking_weight_tons: b.weightTons,
    total_trucks: b.totalTrucks,
    cargo_rate_php_per_ton: b.cargoRatePhpPerTon,
    diesel_liters: b.dieselLiters,
    diesel_cost_php: b.dieselCostPhp,
    driver_share_php: b.driverSharePhp,
    helper_share_php: b.helperSharePhp,
    toll_fees_php: b.tollFeesPhp,
    additives_total_php: b.additivesTotalPhp,
    diesel_price_per_liter: b.dieselPricePerLiter,
    driver_freight_share_pct: b.driverFreightSharePct,
    helper_freight_share_pct: b.helperFreightSharePct,
    truck_loads: b.truckLoads.map((r) => ({
      truck_index: r.truckIndex,
      weight_tons: r.weightTons,
      distance_km: r.distanceKm,
      cargo_gross_php: r.cargoGrossPhp,
      diesel_liters: r.dieselLiters,
      diesel_cost_php: r.dieselCostPhp,
      driver_share_php: r.driverSharePhp,
      helper_share_php: r.helperSharePhp,
      toll_fees_php: r.tollFeesPhp,
      additives_total_php: r.additivesTotalPhp,
      net_profit_php: r.netProfitPhp,
    })),
  };
}

export function geocodeProviderNote(geo: QuoteGeoMeta | null): string | null {
  if (!geo) return null;
  const google = geo.pickup_resolution === "google" || geo.dropoff_resolution === "google";
  const nom = geo.pickup_resolution === "nominatim" || geo.dropoff_resolution === "nominatim";
  if (google) return "Pins: Google Geocoding API.";
  if (nom) return "Pins: OpenStreetMap (Nominatim), best match for your full street address.";
  return null;
}

export function routingDistanceNote(routing: string | undefined): string {
  if (routing === "google_directions") {
    return "Road distance from Google Directions API (driving), matched to the same map data Google Maps uses for routing. Minor differences vs the app UI can still happen (alternate routes, live traffic, or different start/end pins). Tolls not itemized in distance.";
  }
  if (routing === "osrm") {
    return "Road distance uses the public OSRM “driving” profile (car-oriented on OpenStreetMap). If you expected Google Maps–like km, the backend is not using Google Directions — set GOOGLE_MAPS_GEOCODING_API_KEY with Geocoding + Directions APIs enabled and restrictions that allow your FastAPI server (not HTTP-referrer-only). For truck-legal OSM routing, set OPENROUTESERVICE_API_KEY (HGV). Tolls and live traffic excluded.";
  }
  if (routing === "openrouteservice_hgv") {
    return "Road distance uses OpenRouteService heavy-goods (HGV) routing on OpenStreetMap—avoids many truck restrictions where map data supports it. One computed path vs odometer; tolls and live traffic excluded.";
  }
  if (routing === "openrouteservice_car") {
    return "Road distance uses OpenRouteService car routing on OpenStreetMap (USE_TRUCK_ROUTE_PROFILE=false on server).";
  }
  if (routing === "openrouteservice") {
    return "Road distance from OpenRouteService along OpenStreetMap. Same caveat: one computed path vs actual odometer. Tolls and live traffic excluded.";
  }
  if (routing === "same_location") {
    return "Pickup and dropoff map to the same point — distance is 0 km.";
  }
  if (routing === "haversine_road_factor") {
    return "Approximate straight-line × factor (legacy mode only).";
  }
  return "";
}

export function siteMenuLabel(s: { label?: string | null; address: string }): string {
  if (s.label) return `${s.label} — ${s.address}`;
  return s.address;
}
