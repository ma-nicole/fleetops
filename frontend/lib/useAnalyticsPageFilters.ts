"use client";

import { useCallback, useMemo, useState } from "react";
import type { AdminAnalyticsQuery, DriverAnalyticsQuery } from "@/lib/analyticsApi";
import type { TimeGranularity } from "@/components/admin/TimeGranularityPicker";

export type AnalyticsPageFiltersState = {
  dateFrom: string;
  dateTo: string;
  driverId: string;
  truckId: string;
  route: string;
  shipmentStatus: string;
  granularity: TimeGranularity;
};

export function useAnalyticsPageFilters(initial?: Partial<AnalyticsPageFiltersState>) {
  const [dateFrom, setDateFrom] = useState(initial?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(initial?.dateTo ?? "");
  const [driverId, setDriverId] = useState(initial?.driverId ?? "");
  const [truckId, setTruckId] = useState(initial?.truckId ?? "");
  const [route, setRoute] = useState(initial?.route ?? "");
  const [shipmentStatus, setShipmentStatus] = useState(initial?.shipmentStatus ?? "");
  const [granularity, setGranularity] = useState<TimeGranularity>(initial?.granularity ?? "monthly");

  const dateRangeError = useMemo(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return "Start date cannot be after end date.";
    }
    return null;
  }, [dateFrom, dateTo]);

  const buildAdminQuery = useCallback((): AdminAnalyticsQuery => {
    return {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      driver_id: driverId ? Number(driverId) : undefined,
      truck_id: truckId ? Number(truckId) : undefined,
      route: route || undefined,
      shipment_status: shipmentStatus || undefined,
      granularity,
    };
  }, [dateFrom, dateTo, driverId, truckId, route, shipmentStatus, granularity]);

  const buildRoleQuery = useCallback((): DriverAnalyticsQuery => {
    return {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      truck_id: truckId ? Number(truckId) : undefined,
      route: route || undefined,
      shipment_status: shipmentStatus || undefined,
      granularity,
    };
  }, [dateFrom, dateTo, truckId, route, shipmentStatus, granularity]);

  return {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    driverId,
    setDriverId,
    truckId,
    setTruckId,
    route,
    setRoute,
    shipmentStatus,
    setShipmentStatus,
    granularity,
    setGranularity,
    dateRangeError,
    buildAdminQuery,
    buildRoleQuery,
  };
}
