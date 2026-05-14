import type { LoadStatus } from '@/types/Trips';

/**
 * Derive a display status from a load record. Some loads in the database
 * still have `status = 'scheduled'` even though their offloading or loading
 * has actually been recorded. This helper returns the most meaningful status
 * for customer-facing surfaces (history lists, portal cards, etc.).
 */
export function getEffectiveLoadStatus(load: {
    status: LoadStatus;
    actual_offloading_arrival?: string | null;
    actual_loading_arrival?: string | null;
}): LoadStatus {
    if (load.status === 'delivered') return 'delivered';
    if (load.actual_offloading_arrival) return 'delivered';
    if (load.actual_loading_arrival && load.status === 'scheduled') return 'in-transit';
    return load.status;
}
