// Determine which environment we're in
const isDevelopment = import.meta.env.DEV;
const mainAppUrl = isDevelopment
  ? 'http://localhost:5173' // Main app dev port
  : 'https://workshop-eight-xi.vercel.app/'; // Production URL

export function navigateToMainApp(path: string) {
  window.open(`${mainAppUrl}${path}`, '_blank');
}

export function navigateToTrip(tripId: string) {
  navigateToMainApp(`/trips/${tripId}`);
}

export function navigateToFleet(fleetNumber: string) {
  navigateToMainApp(`/fleet?fleet=${encodeURIComponent(fleetNumber)}`);
}

export function navigateToDriver(driverName: string) {
  navigateToMainApp(`/drivers?name=${encodeURIComponent(driverName)}`);
}