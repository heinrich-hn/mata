export function isReeferFleet(fleetNumber: string | null | undefined): boolean {
    if (!fleetNumber) return false;
    return /F$/i.test(fleetNumber.trim());
}
