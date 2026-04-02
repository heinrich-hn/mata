import type { Load } from "@/hooks/useTrips";
import { parseTimeWindow } from "@/lib/timeWindow";
import { addDays, format, isBefore, parseISO, startOfDay } from "date-fns";

const cargoLabels: Record<string, string> = {
    VanSalesRetail: "Van Sales / Retail",
    Retail: "Retail",
    Vendor: "Vendor",
    RetailVendor: "Retail Vendor",
    Fertilizer: "Fertilizer",
    BV: "Backload (BV)",
    CBC: "Backload (CBC)",
    Packaging: "Packaging (Backload)",
    Vansales: "Van Sales",
    "Vansales/Vendor": "Van Sales / Vendor",
};

function getStatusBadge(status: string): string {
    switch (status) {
        case "pending": return "PENDING";
        case "scheduled": return "SCHEDULED";
        case "in-transit": return "IN TRANSIT";
        case "delivered": return "DELIVERED";
        default: return status.toUpperCase();
    }
}

function formatTime(time: string | undefined): string {
    if (!time) return "—";
    if (/^\d{2}:\d{2}$/.test(time)) return time;
    try {
        return format(parseISO(time), "HH:mm");
    } catch {
        return time;
    }
}

function formatDate(dateStr: string): string {
    try {
        return format(parseISO(dateStr), "dd MMM yyyy");
    } catch {
        return dateStr;
    }
}

function formatShortDate(dateStr: string): string {
    try {
        return format(parseISO(dateStr), "EEE, dd MMM");
    } catch {
        return dateStr;
    }
}

/**
 * Generate a professional WhatsApp-formatted message for a single load/trip.
 */
export function generateTripWhatsAppMessage(load: Load): string {
    const tw = parseTimeWindow(load.time_window);
    const cargo = cargoLabels[load.cargo_type] || load.cargo_type;
    const statusBadge = getStatusBadge(load.status);

    const lines = [
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "           TRIP MANIFEST",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        `STATUS: ${statusBadge}`,
        "",
        "─  LOAD DETAILS  ─────────────────",
        `ID:          ${load.load_id}`,
        `Cargo:       ${cargo}`,
        `Route:       ${load.origin} → ${load.destination}`,
        "",
        "─  SCHEDULE  ─────────────────────",
        `Load Date:   ${formatDate(load.loading_date)}`,
        `Arrival:     ${formatTime(tw.origin.plannedArrival)}`,
        `Departure:   ${formatTime(tw.origin.plannedDeparture)}`,
        `Offload:     ${formatDate(load.offloading_date)}`,
        `Arrival:     ${formatTime(tw.destination.plannedArrival)}`,
        `Departure:   ${formatTime(tw.destination.plannedDeparture)}`,
        "",
    ];

    if (load.driver || load.fleet_vehicle) {
        lines.push("─  ASSIGNMENT  ───────────────────");
        if (load.driver) {
            lines.push(`Driver:      ${load.driver.name}`);
            if (load.driver.contact) {
                lines.push(`Contact:     ${load.driver.contact}`);
            }
        }
        if (load.fleet_vehicle) {
            const vehicleInfo = load.fleet_vehicle.vehicle_id;
            const vehicleType = load.fleet_vehicle.type ? ` (${load.fleet_vehicle.type})` : "";
            lines.push(`Vehicle:     ${vehicleInfo}${vehicleType}`);
        }
        lines.push("");
    }

    if (tw.backload?.enabled) {
        lines.push("─  RETURN LOAD  ─────────────────");
        lines.push(`Destination: ${tw.backload.destination}`);
        lines.push(`Cargo:       ${cargoLabels[tw.backload.cargoType] || tw.backload.cargoType}`);
        if (tw.backload.offloadingDate) {
            lines.push(`Date:        ${formatDate(tw.backload.offloadingDate)}`);
        }
        const qty = tw.backload.quantities;
        if (qty && (qty.bins || qty.crates || qty.pallets)) {
            const parts: string[] = [];
            if (qty.bins) parts.push(`${qty.bins} bins`);
            if (qty.crates) parts.push(`${qty.crates} crates`);
            if (qty.pallets) parts.push(`${qty.pallets} pallets`);
            lines.push(`Quantity:    ${parts.join(", ")}`);
        }
        lines.push("");
    }

    if (load.notes) {
        lines.push("─  NOTES  ───────────────────────");
        lines.push(load.notes);
        lines.push("");
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push(`Generated:   ${format(new Date(), "dd MMM yyyy · HH:mm")}`);
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("LoadPlan™ Logistics Platform");

    return lines.join("\n");
}

/**
 * Generate a professional weekly schedule for a driver.
 */
export function generateWeeklyScheduleWhatsAppMessage(
    loads: Load[],
    driverName: string,
): string {
    const today = startOfDay(new Date());
    const weekEnd = addDays(today, 7);

    const weekLoads = loads
        .filter((l) => {
            const loadDate = startOfDay(parseISO(l.loading_date));
            return (
                !isBefore(loadDate, today) &&
                isBefore(loadDate, weekEnd) &&
                l.status !== "delivered"
            );
        })
        .sort((a, b) => a.loading_date.localeCompare(b.loading_date));

    const lines = [
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "          WEEKLY ROSTER",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        `Driver:      ${driverName}`,
        `Period:      ${format(today, "dd MMM")} – ${format(addDays(today, 6), "dd MMM yyyy")}`,
        `Total loads: ${weekLoads.length}`,
        "",
    ];

    if (weekLoads.length === 0) {
        lines.push("─  SCHEDULE  ───────────────────");
        lines.push("No loads scheduled for the upcoming week.");
    } else {
        lines.push("─  SCHEDULE  ───────────────────");
        lines.push("");
        weekLoads.forEach((load, index) => {
            const tw = parseTimeWindow(load.time_window);
            const cargo = cargoLabels[load.cargo_type] || load.cargo_type;
            const num = (index + 1).toString().padStart(2, "0");

            lines.push(`${num}. ${load.load_id}`);
            lines.push(`   Date:   ${formatShortDate(load.loading_date)}`);
            lines.push(`   Route:  ${load.origin} → ${load.destination}`);
            lines.push(`   Cargo:  ${cargo}`);
            lines.push(`   Depart: ${formatTime(tw.origin.plannedDeparture)}`);
            lines.push(`   Arrive: ${formatTime(tw.destination.plannedArrival)}`);
            if (load.fleet_vehicle) {
                lines.push(`   Vehicle: ${load.fleet_vehicle.vehicle_id}`);
            }
            lines.push("");
        });
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push(`Generated:   ${format(new Date(), "dd MMM yyyy · HH:mm")}`);
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("LoadPlan™ Logistics Platform");

    return lines.join("\n");
}

function openWhatsApp(message: string, phoneNumber?: string): void {
    const encodedMessage = encodeURIComponent(message);
    let url = "https://wa.me/";

    if (phoneNumber) {
        const cleanedNumber = phoneNumber.replace(/[^\d+]/g, "");
        url += cleanedNumber;
    }

    url += `?text=${encodedMessage}`;
    window.open(url, "_blank");
}

/**
 * Open WhatsApp with a single trip's details pre-filled.
 */
export function shareTripViaWhatsApp(load: Load, phoneNumber?: string): void {
    const message = generateTripWhatsAppMessage(load);
    openWhatsApp(message, phoneNumber);
}

/**
 * Open WhatsApp with the driver's weekly schedule pre-filled.
 */
export function shareWeeklyScheduleViaWhatsApp(
    loads: Load[],
    driverName: string,
    phoneNumber?: string,
): void {
    const message = generateWeeklyScheduleWhatsAppMessage(loads, driverName);
    openWhatsApp(message, phoneNumber);
}