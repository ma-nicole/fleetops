import { ERDDataService, type FuelRecord, type MaintenanceReport, type Route, type TollRecord, type Transaction, type Trip, type Truck } from "./erdDataService";

type ValidationIssue = {
  source: string;
  recordId: string;
  field: string;
  message: string;
};

type CleanedTripRecord = {
  tripId: string;
  transactionId: string;
  truckId: string;
  driverName: string;
  routeOrigin: string;
  routeDestination: string;
  distanceKm: number;
  status: string;
  departureTime?: string;
  arrivalTime?: string;
  fuelCost: number;
  fuelLiters: number;
  tollCost: number;
  maintenanceCost: number;
  maintenanceEvents: number;
  laborCost: number;
  orderType: string;
  createdAt: string;
};

export type TripFeature = {
  tripId: string;
  driverName: string;
  truckId: string;
  distanceKm: number;
  deliveryHours: number;
  fuelCost: number;
  fuelEfficiencyKmPerLiter: number;
  tollCost: number;
  laborCost: number;
  maintenanceCost: number;
  maintenanceFrequency: number;
  totalCost: number;
  status: string;
  monthKey: string;
};

export type PredictedTripCost = {
  tripId: string;
  predictedCost: number;
  formula: string;
};

export type MaintenanceRiskPrediction = {
  truckId: string;
  maintenanceFrequency: number;
  riskLevel: "Low" | "Medium" | "High";
};

export type MonthlyCostForecast = {
  month: string;
  estimatedMonthlyExpense: number;
};

export type AnalyticsPipelineResult = {
  ingestion: {
    transactions: number;
    trips: number;
    fuelLogs: number;
    tollRecords: number;
    maintenanceLogs: number;
    vehicles: number;
    validationIssues: ValidationIssue[];
  };
  staging: {
    cleanedTrips: number;
    duplicatesRemoved: number;
  };
  features: {
    records: TripFeature[];
    averageDeliveryHours: number;
    averageFuelEfficiency: number;
    averageCostPerTrip: number;
  };
  marts: {
    tripCostMart: Array<{ tripId: string; totalCost: number; costPerKm: number }>;
    maintenanceMart: Array<{ truckId: string; maintenanceEvents: number; maintenanceCost: number }>;
    monthlyCostMart: Array<{ month: string; totalCost: number; tripCount: number }>;
  };
  predictions: {
    tripCost: PredictedTripCost[];
    maintenanceRisk: MaintenanceRiskPrediction[];
    monthlyForecast: MonthlyCostForecast[];
  };
  connectorAI: {
    topTripCostPrediction: PredictedTripCost | null;
    highestRiskVehicle: MaintenanceRiskPrediction | null;
    currentMonthForecast: MonthlyCostForecast | null;
  };
};

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function monthKeyFromDate(dateLike: string): string {
  const date = new Date(dateLike || Date.now());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dedupeById<T extends { id: string }>(rows: T[]): { unique: T[]; duplicatesRemoved: number } {
  const seen = new Set<string>();
  const unique: T[] = [];
  let duplicatesRemoved = 0;
  rows.forEach((row) => {
    if (seen.has(row.id)) {
      duplicatesRemoved += 1;
      return;
    }
    seen.add(row.id);
    unique.push(row);
  });
  return { unique, duplicatesRemoved };
}

export class AnalyticsPipelineService {
  static runPipeline(): AnalyticsPipelineResult {
    const store = ERDDataService.getStore();

    const transactions = dedupeById<Transaction>(store.transactions).unique;
    const dedupedTrips = dedupeById<Trip>(store.trips);
    const trips = dedupedTrips.unique;
    const fuelLogs = dedupeById<FuelRecord>(store.fuelRecords).unique;
    const tollRecords = dedupeById<TollRecord>(store.tollRecords).unique;
    const maintenanceLogs = dedupeById<MaintenanceReport>(store.maintenanceReports).unique;
    const vehicles = store.trucks as Truck[];
    const routes = store.routes as Route[];

    const validationIssues: ValidationIssue[] = [];

    trips.forEach((trip) => {
      if (!trip.id) validationIssues.push({ source: "Trips", recordId: "unknown", field: "id", message: "Missing trip ID" });
      if (!trip.transaction_id) validationIssues.push({ source: "Trips", recordId: trip.id, field: "transaction_id", message: "Missing transaction link" });
      if (!trip.route_id) validationIssues.push({ source: "Trips", recordId: trip.id, field: "route_id", message: "Missing route link" });
      if (!trip.truck_id) validationIssues.push({ source: "Trips", recordId: trip.id, field: "truck_id", message: "Missing truck ID" });
      if (!trip.driver_name) validationIssues.push({ source: "Trips", recordId: trip.id, field: "driver_name", message: "Missing driver name" });
    });

    fuelLogs.forEach((fuel) => {
      if (toNumber(fuel.liters_used) <= 0) {
        validationIssues.push({ source: "Fuel Logs", recordId: fuel.id, field: "liters_used", message: "Fuel liters must be greater than 0" });
      }
    });

    const cleanedTrips: CleanedTripRecord[] = trips.map((trip) => {
      const route = routes.find((item) => item.id === trip.route_id);
      const transaction = transactions.find((item) => item.id === trip.transaction_id);
      const tripFuelLogs = fuelLogs.filter((item) => item.trip_id === trip.id);
      const tripTolls = tollRecords.filter((item) => item.trip_id === trip.id);
      const tripMaintenance = maintenanceLogs.filter((item) => item.truck_id === trip.truck_id);

      const distanceKm = Math.max(0, toNumber(route?.estimated_distance, 0));
      const fuelCost = tripFuelLogs.reduce((sum, row) => sum + Math.max(0, toNumber(row.fuel_cost)), 0);
      const fuelLiters = tripFuelLogs.reduce((sum, row) => sum + Math.max(0, toNumber(row.liters_used)), 0);
      const tollCost = tripTolls.reduce((sum, row) => sum + Math.max(0, toNumber(row.toll_amount)), 0);
      const maintenanceCost = tripMaintenance.reduce((sum, row) => sum + Math.max(0, toNumber(row.cost)), 0);
      const laborCost = distanceKm * 1.2; // Placeholder labor model for simulation.

      return {
        tripId: trip.id,
        transactionId: trip.transaction_id,
        truckId: trip.truck_id,
        driverName: trip.driver_name || "Unassigned",
        routeOrigin: route?.origin || "Unknown",
        routeDestination: route?.destination || "Unknown",
        distanceKm,
        status: trip.trip_status || "pending",
        departureTime: trip.departure_time,
        arrivalTime: trip.arrival_time,
        fuelCost,
        fuelLiters,
        tollCost,
        maintenanceCost,
        maintenanceEvents: tripMaintenance.length,
        laborCost,
        orderType: transaction?.type || "trip",
        createdAt: transaction?.create_time || new Date().toISOString(),
      };
    });

    const features: TripFeature[] = cleanedTrips.map((trip) => {
      const deliveryHours =
        trip.arrivalTime && trip.departureTime
          ? Math.max(
              0.5,
              (new Date(trip.arrivalTime).getTime() - new Date(trip.departureTime).getTime()) / (1000 * 60 * 60)
            )
          : Math.max(1, trip.distanceKm / 45);

      const fuelEfficiencyKmPerLiter =
        trip.fuelLiters > 0 ? trip.distanceKm / trip.fuelLiters : Math.max(4, trip.distanceKm / 15);

      const totalCost = trip.fuelCost + trip.tollCost + trip.laborCost + trip.maintenanceCost;

      return {
        tripId: trip.tripId,
        driverName: trip.driverName,
        truckId: trip.truckId,
        distanceKm: trip.distanceKm,
        deliveryHours,
        fuelCost: trip.fuelCost,
        fuelEfficiencyKmPerLiter,
        tollCost: trip.tollCost,
        laborCost: trip.laborCost,
        maintenanceCost: trip.maintenanceCost,
        maintenanceFrequency: trip.maintenanceEvents,
        totalCost,
        status: trip.status,
        monthKey: monthKeyFromDate(trip.createdAt),
      };
    });

    const fallbackFeatures: TripFeature[] = features.length
      ? features
      : [
          {
            tripId: "SIM-TRP-001",
            driverName: "Sample Driver",
            truckId: "TRK-001",
            distanceKm: 120,
            deliveryHours: 3.5,
            fuelCost: 95,
            fuelEfficiencyKmPerLiter: 6.5,
            tollCost: 22,
            laborCost: 144,
            maintenanceCost: 40,
            maintenanceFrequency: 1,
            totalCost: 301,
            status: "completed",
            monthKey: monthKeyFromDate(new Date().toISOString()),
          },
        ];

    const tripCostMart = fallbackFeatures.map((row) => ({
      tripId: row.tripId,
      totalCost: row.totalCost,
      costPerKm: row.distanceKm > 0 ? row.totalCost / row.distanceKm : row.totalCost,
    }));

    const maintenanceMap = new Map<string, { maintenanceEvents: number; maintenanceCost: number }>();
    fallbackFeatures.forEach((row) => {
      const existing = maintenanceMap.get(row.truckId) || { maintenanceEvents: 0, maintenanceCost: 0 };
      existing.maintenanceEvents += row.maintenanceFrequency;
      existing.maintenanceCost += row.maintenanceCost;
      maintenanceMap.set(row.truckId, existing);
    });
    const maintenanceMart = Array.from(maintenanceMap.entries()).map(([truckId, values]) => ({
      truckId,
      maintenanceEvents: values.maintenanceEvents,
      maintenanceCost: values.maintenanceCost,
    }));

    const monthlyMap = new Map<string, { totalCost: number; tripCount: number }>();
    fallbackFeatures.forEach((row) => {
      const existing = monthlyMap.get(row.monthKey) || { totalCost: 0, tripCount: 0 };
      existing.totalCost += row.totalCost;
      existing.tripCount += 1;
      monthlyMap.set(row.monthKey, existing);
    });
    const monthlyCostMart = Array.from(monthlyMap.entries())
      .map(([month, values]) => ({ month, totalCost: values.totalCost, tripCount: values.tripCount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const tripCostPredictions: PredictedTripCost[] = fallbackFeatures.map((row) => {
      const predictedCost = row.fuelCost + row.tollCost + row.laborCost + 75;
      return {
        tripId: row.tripId,
        predictedCost,
        formula: "fuel + toll + labor + fixed rate",
      };
    });

    const maintenanceRiskPredictions: MaintenanceRiskPrediction[] = maintenanceMart.map((row) => ({
      truckId: row.truckId,
      maintenanceFrequency: row.maintenanceEvents,
      riskLevel: row.maintenanceEvents >= 5 ? "High" : row.maintenanceEvents >= 2 ? "Medium" : "Low",
    }));

    const averageMonthly =
      monthlyCostMart.length > 0 ? monthlyCostMart.reduce((sum, row) => sum + row.totalCost, 0) / monthlyCostMart.length : 0;

    const monthlyForecast: MonthlyCostForecast[] = [
      {
        month: "Next Month",
        estimatedMonthlyExpense: averageMonthly || 0,
      },
    ];

    return {
      ingestion: {
        transactions: transactions.length,
        trips: trips.length,
        fuelLogs: fuelLogs.length,
        tollRecords: tollRecords.length,
        maintenanceLogs: maintenanceLogs.length,
        vehicles: vehicles.length,
        validationIssues,
      },
      staging: {
        cleanedTrips: cleanedTrips.length,
        duplicatesRemoved:
          dedupedTrips.duplicatesRemoved +
          (store.fuelRecords.length - fuelLogs.length) +
          (store.tollRecords.length - tollRecords.length) +
          (store.maintenanceReports.length - maintenanceLogs.length),
      },
      features: {
        records: fallbackFeatures,
        averageDeliveryHours:
          fallbackFeatures.reduce((sum, row) => sum + row.deliveryHours, 0) / Math.max(1, fallbackFeatures.length),
        averageFuelEfficiency:
          fallbackFeatures.reduce((sum, row) => sum + row.fuelEfficiencyKmPerLiter, 0) / Math.max(1, fallbackFeatures.length),
        averageCostPerTrip:
          fallbackFeatures.reduce((sum, row) => sum + row.totalCost, 0) / Math.max(1, fallbackFeatures.length),
      },
      marts: {
        tripCostMart,
        maintenanceMart,
        monthlyCostMart,
      },
      predictions: {
        tripCost: tripCostPredictions,
        maintenanceRisk: maintenanceRiskPredictions,
        monthlyForecast,
      },
      connectorAI: {
        topTripCostPrediction:
          [...tripCostPredictions].sort((a, b) => b.predictedCost - a.predictedCost)[0] || null,
        highestRiskVehicle:
          [...maintenanceRiskPredictions].sort((a, b) => {
            const rank: Record<MaintenanceRiskPrediction["riskLevel"], number> = { High: 3, Medium: 2, Low: 1 };
            return rank[b.riskLevel] - rank[a.riskLevel];
          })[0] || null,
        currentMonthForecast: monthlyForecast[0] || null,
      },
    };
  }
}

