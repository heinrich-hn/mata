import { PERFORMANCE_THRESHOLDS } from '@/constants/customerRetention';
import { CustomerPerformance, Trip } from '@/types/operations';

interface CustomerStats {
  trips: Trip[];
  totalRevenue: number;
  totalPaymentDays: number;
  paidTrips: number;
  clientType: 'internal' | 'external';
}

export const calculateCustomerPerformance = (trips: Trip[]): CustomerPerformance[] => {
  const customerStats = trips.reduce((acc, trip) => {
    const customerName = trip.client_name || 'Unknown Customer';

    if (!acc[customerName]) {
      acc[customerName] = {
        trips: [],
        totalRevenue: 0,
        totalPaymentDays: 0,
        paidTrips: 0,
        clientType: trip.client_type || 'external'
      };
    }

    acc[customerName].trips.push(trip);

    // Get revenue from trip - payment_amount is the standard field
    // Some legacy trips might have base_revenue, so we check with type safety
    const tripWithRevenue = trip as Trip & { base_revenue?: number };
    const tripRevenue = tripWithRevenue.base_revenue || trip.payment_amount || 0;
    acc[customerName].totalRevenue += tripRevenue;

    if (trip.payment_received_date && trip.invoice_submitted_date) {
      const invoiceDate = new Date(trip.invoice_submitted_date);
      const paidDate = new Date(trip.payment_received_date);
      const paymentDays = Math.floor((paidDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      acc[customerName].totalPaymentDays += paymentDays;
      acc[customerName].paidTrips++;
    }

    return acc;
  }, {} as Record<string, CustomerStats>);

  return Object.entries(customerStats).map(([customerName, stats]) => {
    const lastTripDate = Math.max(
      ...stats.trips.map(t => new Date(t.completed_at || t.arrival_date || t.created_at || Date.now()).getTime())
    );
    const daysSinceLastTrip = Math.floor((Date.now() - lastTripDate) / (1000 * 60 * 60 * 24));

    const averagePaymentDays = stats.paidTrips > 0 ? stats.totalPaymentDays / stats.paidTrips : 0;
    const paymentScore = calculatePaymentScore(averagePaymentDays);
    const riskLevel = determineRiskLevel(daysSinceLastTrip, averagePaymentDays);

    const isAtRisk = daysSinceLastTrip > PERFORMANCE_THRESHOLDS.AT_RISK_DAYS_THRESHOLD ||
                     averagePaymentDays > PERFORMANCE_THRESHOLDS.PAYMENT_DELAY_MEDIUM_THRESHOLD;
    const isProfitable = stats.totalRevenue > PERFORMANCE_THRESHOLDS.PROFITABLE_MIN_REVENUE;
    const isTopClient = stats.trips.length >= PERFORMANCE_THRESHOLDS.TOP_CLIENT_MIN_TRIPS;

    // Get currency from trip - check for legacy currency fields with type safety
    const tripWithCurrency = stats.trips[0] as Trip & {
      revenue_currency?: string;
      payment_currency?: string;
    };
    const currency = (tripWithCurrency?.revenue_currency ||
                     tripWithCurrency?.payment_currency ||
                     'ZAR') as 'ZAR' | 'USD';

    return {
      customerName,
      totalTrips: stats.trips.length,
      totalRevenue: stats.totalRevenue,
      currency,
      averagePaymentDays,
      paymentScore,
      lastTripDate: new Date(lastTripDate).toISOString().split('T')[0],
      riskLevel,
      isAtRisk,
      isProfitable,
      isTopClient,
      daysSinceLastTrip,
      clientType: stats.clientType
    };
  });
};

export const calculatePaymentScore = (averagePaymentDays: number): number => {
  return Math.max(0, 100 - Math.abs(averagePaymentDays) * 2);
};

export const determineRiskLevel = (
  daysSinceLastTrip: number,
  averagePaymentDays: number
): 'low' | 'medium' | 'high' => {
  if (daysSinceLastTrip > PERFORMANCE_THRESHOLDS.HIGH_RISK_DAYS_THRESHOLD ||
      averagePaymentDays > PERFORMANCE_THRESHOLDS.PAYMENT_DELAY_HIGH_THRESHOLD) {
    return 'high';
  }
  if (daysSinceLastTrip > PERFORMANCE_THRESHOLDS.AT_RISK_DAYS_THRESHOLD ||
      averagePaymentDays > PERFORMANCE_THRESHOLDS.PAYMENT_DELAY_MEDIUM_THRESHOLD) {
    return 'medium';
  }
  return 'low';
};

export const calculateSummaryMetrics = (customers: CustomerPerformance[]) => {
  const total = customers.length;
  const atRisk = customers.filter(c => c.isAtRisk).length;
  const profitable = customers.filter(c => c.isProfitable).length;
  const topClients = customers.filter(c => c.isTopClient).length;
  const inactive = customers.filter(c => c.daysSinceLastTrip > PERFORMANCE_THRESHOLDS.AT_RISK_DAYS_THRESHOLD).length;

  const totalRevenue = customers.reduce((sum, c) => sum + c.totalRevenue, 0);
  const avgPaymentDays = customers.length > 0
    ? customers.reduce((sum, c) => sum + c.averagePaymentDays, 0) / customers.length
    : 0;

  return {
    total,
    atRisk,
    profitable,
    topClients,
    inactive,
    totalRevenue,
    avgPaymentDays
  };
};