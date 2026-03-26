import type { Load } from "@/hooks/useTrips";
import { parseTimeWindow } from "@/lib/timeWindow";
import { addDays, format, isBefore, parseISO, startOfDay } from "date-fns";

const cargoLabels: Record<string, string> = {
    VanSalesRetail: "Van Sales/Retail",
    Retail: "Retail",
    Vendor: "Vendor",
    RetailVendor: "Retail Vendor",
    Fertilizer: "Fertilizer",
    BV: "BV (Backload)",
    CBC: "CBC (Backload)",
    Packaging: "Packaging (Backload)",
    Vansales: "Van Sales",
    "Vansales/Vendor": "Van Sales/Vendor",
};

const statusLabels: Record<string, string> = {
    pending: "Pending",
    scheduled: "Scheduled",
    "in-transit": "In Transit",
    delivered: "Delivered",
};

function getStatusEmoji(status: string): string {
    switch (status) {
        case "pending": return "⏳";
        case "scheduled": return "📋";
        case "in-transit": return "🚛";
        case "delivered": return "✅";
        default: return "📦";
    }
}

function formatTime(time: string | undefined): string {
    if (!time) return "-";
    if (/^\d{2}:\d{2}$/.test(time)) return time;
    try {
        return format(parseISO(time), "HH:mm");
    } catch {
        return time;
    }
}

/**
 * Generate a WhatsApp-formatted message for a single load/trip.
 */
export function generateTripWhatsAppMessage(load: Load): string {
    const tw = parseTimeWindow(load.time_window);
    const cargo = cargoLabels[load.cargo_type] || load.cargo_type;
    const statusEmoji = getStatusEmoji(load.status);

    const lines = [
        "━━━━━━━━━━━━━━━━━━━━━━",
        "   🚛 *TRIP DETAILS*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "",
        `${statusEmoji} *Status:* ${(statusLabels[load.status] || load.status).toUpperCase()}`,
        "",
        "📦 *LOAD INFORMATION*",
        "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄",
        `📄 Load: \`${load.load_id}\``,
        `📦 Cargo: *${cargo}*`,
        `🛣️ Route: ${load.origin} → ${load.destination}`,
        "",
        "📅 *SCHEDULE*",
        "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄",
        `📥 Loading: *${format(parseISO(load.loading_date), "dd MMM yyyy")}*`,
        `   ⏰ Arrive: ${formatTime(tw.origin.plannedArrival)} | Depart: ${formatTime(tw.origin.plannedDeparture)}`,
        `📤 Offloading: *${format(parseISO(load.offloading_date), "dd MMM yyyy")}*`,
        `   ⏰ Arrive: ${formatTime(tw.destination.plannedArrival)} | Depart: ${formatTime(tw.destination.plannedDeparture)}`,
        "",
    ];

    if (load.driver || load.fleet_vehicle) {
        lines.push("🚛 *ASSIGNMENT*");
        lines.push("┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
        if (load.driver) {
            lines.push(`👤 Driver: ${load.driver.name}`);
            if (load.driver.contact) {
                lines.push(`📞 Contact: ${load.driver.contact}`);
            }
        }
        if (load.fleet_vehicle) {
            lines.push(`🚚 Vehicle: ${load.fleet_vehicle.vehicle_id}${load.fleet_vehicle.type ? ` (${load.fleet_vehicle.type})` : ""}`);
        }
        lines.push("");
    }

    if (tw.backload?.enabled) {
        lines.push("🔄 *RETURN LOAD*");
        lines.push("┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
        lines.push(`📍 Destination: ${tw.backload.destination}`);
        lines.push(`📦 Cargo: ${cargoLabels[tw.backload.cargoType] || tw.backload.cargoType}`);
        if (tw.backload.offloadingDate) {
            lines.push(`📅 Date: ${format(parseISO(tw.backload.offloadingDate), "dd MMM yyyy")}`);
        }
        const qty = tw.backload.quantities;
        if (qty && (qty.bins || qty.crates || qty.pallets)) {
            const parts: string[] = [];
            if (qty.bins) parts.push(`${qty.bins} bins`);
            if (qty.crates) parts.push(`${qty.crates} crates`);
            if (qty.pallets) parts.push(`${qty.pallets} pallets`);
            lines.push(`📊 Qty: ${parts.join(", ")}`);
        }
        lines.push("");
    }

    if (load.notes) {
        lines.push("📝 *NOTES*");
        lines.push("┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄");
        lines.push(load.notes);
        lines.push("");
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push(`🕐 Sent: ${format(new Date(), "dd MMM yyyy, HH:mm")}`);
    lines.push("");
    lines.push("_Powered by LoadPlan™_");

    return lines.join("\n");
}

/**
 * Generate a WhatsApp-formatted weekly schedule for a driver.
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
        "━━━━━━━━━━━━━━━━━━━━━━",
        "   📋 *WEEKLY SCHEDULE*",
        "━━━━━━━━━━━━━━━━━━━━━━",
        "",
        `👤 *Driver:* ${driverName}`,
        `📅 *Period:* ${format(today, "dd MMM")} – ${format(addDays(today, 6), "dd MMM yyyy")}`,
        `📊 *Total Loads:* ${weekLoads.length}`,
        "",
    ];

    if (weekLoads.length === 0) {
        lines.push("_No loads scheduled for the upcoming week._");
    } else {
        weekLoads.forEach((load, index) => {
            const tw = parseTimeWindow(load.time_window);
            const cargo = cargoLabels[load.cargo_type] || load.cargo_type;
            const num = index + 1;

            lines.push(`*${num}. ${load.load_id}*`);
            lines.push(`   📅 ${format(parseISO(load.loading_date), "EEE, dd MMM yyyy")}`);
            lines.push(`   🛣️ ${load.origin} → ${load.destination}`);
            lines.push(`   📦 ${cargo}`);
            lines.push(`   ⏰ Depart: ${formatTime(tw.origin.plannedDeparture)} | Arrive: ${formatTime(tw.destination.plannedArrival)}`);
            if (load.fleet_vehicle) {
                lines.push(`   🚚 ${load.fleet_vehicle.vehicle_id}`);
            }
            lines.push("");
        });
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━━━");
    lines.push(`🕐 Sent: ${format(new Date(), "dd MMM yyyy, HH:mm")}`);
    lines.push("");
    lines.push("_Powered by LoadPlan™_");

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
