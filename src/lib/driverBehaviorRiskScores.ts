/**
 * Default risk score (1-5) assigned to each canonical driver-behavior event type.
 *
 * These match the normalized event_type values produced by the
 * `import-driver-behavior` edge function (EVENT_TYPE_MAP values).
 *
 * Scale:
 *   1 — Minimal      (informational)
 *   2 — Low          (minor coaching opportunity)
 *   3 — Moderate     (clear unsafe behavior)
 *   4 — High         (serious safety risk)
 *   5 — Critical     (imminent danger / accident-class)
 *
 * Used as the suggested risk score during debriefing. Debriefer can override.
 */
export const DEFAULT_RISK_SCORE_BY_EVENT_TYPE: Record<string, number> = {
    // 5 — Critical: collision or near-collision class
    Accident: 5,
    "Possible Accident": 5,

    // 4 — High: severe driving behavior with imminent risk
    "Violent Left Turn": 4,
    "Violent Turn": 4,
    Tailgating: 4,
    "Speed Limit Violation": 4,
    Speeding: 4,
    "Distracted Driving": 4,
    "Cell Phone Use": 4,
    "Fatigue Alert": 4,
    "Near Miss": 4,
    "Traffic Violation": 4,

    // 3 — Moderate: clear unsafe behavior, regular coaching
    "Harsh Braking": 3,
    "Harsh Acceleration": 3,
    "Sharp Cornering": 3,
    "Lane Weaving": 3,
    "Driver Unbelted": 3,
    "Seatbelt Violation": 3,
    Obstruction: 3,
    "Yawn Alert": 3,

    // 2 — Low: minor / passenger-related
    "Passenger Unbelted": 2,
    "Passenger Limit": 2,
    "Customer Complaint": 2,

    // Default fallback
    Other: 2,
};

/**
 * Returns the default risk score for an event type.
 * Falls back to 3 (Moderate) for unknown / unmapped types.
 */
export const getDefaultRiskScore = (eventType: string | null | undefined): number => {
    if (!eventType) return 3;
    return DEFAULT_RISK_SCORE_BY_EVENT_TYPE[eventType] ?? 3;
};
