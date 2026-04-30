import { describe, it, expect } from "vitest";
import {
  formatTimeAsSAST,
  parseTimeWindow,
  parseTimeWindowForForm,
  parseTimeWindowOrNull,
  stringifyTimeWindow,
} from "@/lib/timeWindow";

describe("parseTimeWindow", () => {
  it("returns defaults for null/undefined/empty input", () => {
    for (const input of [null, undefined, "", "  "]) {
      const result = parseTimeWindow(input as string | null | undefined);
      expect(result.origin.plannedArrival).toBe("");
      expect(result.destination.plannedArrival).toBe("");
      expect(result.backload).toBeNull();
      expect(result.thirdParty).toBeNull();
    }
  });

  it("parses complete time window JSON correctly (including full backload)", () => {
    const json = JSON.stringify({
      origin: { plannedArrival: "15:00", plannedDeparture: "17:00" },
      destination: { plannedArrival: "08:00", plannedDeparture: "11:00" },
      backload: {
        enabled: true,
        destination: "BV",
        cargoType: "Packaging",
        offloadingDate: "2026-01-15",
        notes: "test notes",
        quantities: { bins: 20, crates: 5, pallets: 10 },
      },
    });

    const result = parseTimeWindow(json);

    expect(result.origin.plannedArrival).toBe("15:00");
    expect(result.origin.plannedDeparture).toBe("17:00");
    expect(result.destination.plannedArrival).toBe("08:00");
    expect(result.destination.plannedDeparture).toBe("11:00");
    expect(result.backload).toEqual({
      enabled: true,
      destination: "BV",
      cargoType: "Packaging",
      offloadingDate: "2026-01-15",
      notes: "test notes",
      quantities: { bins: 20, crates: 5, pallets: 10 },
    });
  });

  it("handles backload with minimal required fields (quantities omitted)", () => {
    const json = JSON.stringify({
      origin: {},
      destination: {},
      backload: {
        enabled: true,
        destination: "CBC",
        cargoType: "Fertilizer",
        offloadingDate: "2026-02-01",
      },
    });

    const result = parseTimeWindow(json);

    expect(result.backload).toEqual({
      enabled: true,
      destination: "CBC",
      cargoType: "Fertilizer",
      offloadingDate: "2026-02-01",
    });
  });

  it("preserves backload even if enabled is false (filtering is done by parseBackloadInfo)", () => {
    const json = JSON.stringify({
      origin: {},
      destination: {},
      backload: {
        enabled: false,
        destination: "BV",
        cargoType: "Packaging",
        offloadingDate: "2026-01-01",
        notes: "should be ignored",
        quantities: { bins: 99, crates: 99, pallets: 99 },
      },
    });

    const result = parseTimeWindow(json);

    // parseTimeWindow preserves backload data as-is; parseBackloadInfo checks enabled
    expect(result.backload).toEqual({
      enabled: false,
      destination: "BV",
      cargoType: "Packaging",
      offloadingDate: "2026-01-01",
      notes: "should be ignored",
      quantities: { bins: 99, crates: 99, pallets: 99 },
    });
  });

  it("parses third-party info when present", () => {
    const json = JSON.stringify({
      origin: { plannedArrival: "12:00", placeName: "Farm A", address: "123 Road" },
      destination: {},
      thirdParty: { customerId: "abc", referenceNumber: "REF-001" },
    });

    const result = parseTimeWindow(json);

    expect(result.origin.placeName).toBe("Farm A");
    expect(result.origin.address).toBe("123 Road");
    expect(result.thirdParty?.customerId).toBe("abc");
    expect(result.thirdParty?.referenceNumber).toBe("REF-001");
  });

  it("returns defaults for invalid JSON", () => {
    const result = parseTimeWindow("{invalid json");
    expect(result.origin.plannedArrival).toBe("");
    expect(result.backload).toBeNull();
  });

  it("accepts a pre-parsed JSONB object (not a string)", () => {
    const obj = {
      origin: { plannedArrival: "10:00", plannedDeparture: "12:00" },
      destination: { plannedArrival: "18:00", plannedDeparture: "20:00" },
      backload: {
        enabled: true,
        destination: "BV",
        cargoType: "Packaging",
        offloadingDate: "2026-03-01",
        quantities: { bins: 5, crates: 0, pallets: 15 },
      },
    };
    const result = parseTimeWindow(obj as unknown as Record<string, unknown>);

    expect(result.origin.plannedArrival).toBe("10:00");
    expect(result.destination.plannedArrival).toBe("18:00");
    expect(result.backload?.destination).toBe("BV");
    expect(result.backload?.quantities).toEqual({ bins: 5, crates: 0, pallets: 15 });
  });
});

describe("parseTimeWindowForForm", () => {
  it("returns default times when stored values are empty", () => {
    const result = parseTimeWindowForForm(null);
    expect(result.originPlannedArrival).toBe("15:00");
    expect(result.originPlannedDeparture).toBe("17:00");
    expect(result.destPlannedArrival).toBe("08:00");
    expect(result.destPlannedDeparture).toBe("11:00");
    expect(result.backload).toBeNull();
  });

  it("uses stored values when present", () => {
    const json = JSON.stringify({
      origin: { plannedArrival: "06:00", plannedDeparture: "07:00" },
      destination: { plannedArrival: "14:00", plannedDeparture: "16:00" },
    });

    const result = parseTimeWindowForForm(json);
    expect(result.originPlannedArrival).toBe("06:00");
    expect(result.originPlannedDeparture).toBe("07:00");
    expect(result.destPlannedArrival).toBe("14:00");
    expect(result.destPlannedDeparture).toBe("16:00");
  });

  it("uses custom defaults when provided", () => {
    const result = parseTimeWindowForForm(null, {
      originPlannedArrival: "10:00",
      originPlannedDeparture: "12:00",
      destPlannedArrival: "18:00",
      destPlannedDeparture: "20:00",
    });
    expect(result.originPlannedArrival).toBe("10:00");
    expect(result.destPlannedDeparture).toBe("20:00");
  });

  // Regression: the geofence pipeline writes ISO 8601 timestamps into
  // time_window.origin.plannedArrival when an admin saves an auto-captured
  // value back without coercing it. Since the form binds these directly to
  // <input type="time">, the browser would reject any ISO string with the
  // warning "does not conform to the required format" and silently leave
  // the field blank. parseTimeWindowForForm must always emit HH:mm.
  it("coerces ISO 8601 timestamps to HH:mm (SAST) for time-input compatibility", () => {
    const json = JSON.stringify({
      origin: {
        plannedArrival: "2026-04-29T11:45:12.814Z", // 11:45 UTC → 13:45 SAST
        plannedDeparture: "2026-04-29T13:00:00Z",   // 13:00 UTC → 15:00 SAST
      },
      destination: {
        plannedArrival: "2026-04-30T06:00:00Z",     // 06:00 UTC → 08:00 SAST
        plannedDeparture: "2026-04-30T09:30:00Z",   // 09:30 UTC → 11:30 SAST
      },
    });

    const result = parseTimeWindowForForm(json);

    expect(result.originPlannedArrival).toBe("13:45");
    expect(result.originPlannedDeparture).toBe("15:00");
    expect(result.destPlannedArrival).toBe("08:00");
    expect(result.destPlannedDeparture).toBe("11:30");
  });
});

describe("formatTimeAsSAST", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(formatTimeAsSAST(null)).toBe("");
    expect(formatTimeAsSAST(undefined)).toBe("");
    expect(formatTimeAsSAST("")).toBe("");
  });

  it("passes HH:mm through unchanged (with zero-padding)", () => {
    expect(formatTimeAsSAST("13:45")).toBe("13:45");
    expect(formatTimeAsSAST("9:05")).toBe("09:05");
  });

  it("strips seconds from HH:mm:ss", () => {
    expect(formatTimeAsSAST("11:45:12")).toBe("11:45");
    expect(formatTimeAsSAST("9:05:30")).toBe("09:05");
  });

  // Regression for the bug reported: feeding an ISO 8601 string to
  // <input type="time"> caused the browser warning
  //   "The specified value '2026-04-29T11:45:12.814Z' does not conform to
  //    the required format..."
  // formatTimeAsSAST must convert to HH:mm in SAST (UTC+2) so the input is valid.
  it("converts ISO 8601 UTC timestamps to HH:mm in SAST", () => {
    expect(formatTimeAsSAST("2026-04-29T11:45:12.814Z")).toBe("13:45");
    expect(formatTimeAsSAST("2026-04-29T00:00:00Z")).toBe("02:00");
    expect(formatTimeAsSAST("2026-04-29T22:00:00Z")).toBe("00:00"); // wraps midnight SAST
  });
});

describe("parseTimeWindowOrNull", () => {
  it("returns null for null/undefined/empty", () => {
    expect(parseTimeWindowOrNull(null)).toBeNull();
    expect(parseTimeWindowOrNull(undefined)).toBeNull();
    expect(parseTimeWindowOrNull("")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseTimeWindowOrNull("not json")).toBeNull();
  });

  it("returns parsed data for valid JSON", () => {
    const json = JSON.stringify({
      origin: { plannedArrival: "09:00" },
      destination: {},
    });
    const result = parseTimeWindowOrNull(json);
    expect(result).not.toBeNull();
    expect(result!.origin.plannedArrival).toBe("09:00");
  });
});

describe("stringifyTimeWindow", () => {
  it("round-trips through parse and stringify (full backload with quantities)", () => {
    const original = {
      origin: { plannedArrival: "15:00", plannedDeparture: "17:00", actualArrival: "", actualDeparture: "" },
      destination: { plannedArrival: "08:00", plannedDeparture: "11:00", actualArrival: "", actualDeparture: "" },
      backload: {
        enabled: true,
        destination: "CBC",
        cargoType: "Fertilizer",
        offloadingDate: "2026-01-20",
        notes: "Round-trip test",
        quantities: { bins: 30, crates: 15, pallets: 8 },
      },
    };

    const json = stringifyTimeWindow(original);
    const parsed = parseTimeWindow(json);

    expect(parsed.origin.plannedArrival).toBe("15:00");
    expect(parsed.destination.plannedDeparture).toBe("11:00");
    expect(parsed.backload).toEqual({
      enabled: true,
      destination: "CBC",
      cargoType: "Fertilizer",
      offloadingDate: "2026-01-20",
      notes: "Round-trip test",
      quantities: { bins: 30, crates: 15, pallets: 8 },
    });
  });

  it("round-trips with backload disabled (preserves data as-is)", () => {
    const original = {
      origin: { plannedArrival: "10:00", plannedDeparture: "12:00", actualArrival: "", actualDeparture: "" },
      destination: { plannedArrival: "18:00", plannedDeparture: "20:00", actualArrival: "", actualDeparture: "" },
      backload: {
        enabled: false,
        destination: "Ignored",
        cargoType: "Ignored",
        offloadingDate: "1970-01-01",
        notes: "ignored",
        quantities: { bins: 99, crates: 99, pallets: 99 },
      },
    };

    const json = stringifyTimeWindow(original);
    const parsed = parseTimeWindow(json);

    // parseTimeWindow preserves all data; it doesn't filter by enabled
    expect(parsed.backload).toEqual(original.backload);
  });
});