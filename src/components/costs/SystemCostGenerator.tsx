/**
 * System Cost Generator Component
 * Generates automatic operational overhead costs for trips
 */
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Calculator, CheckCircle } from 'lucide-react';
import React, { useMemo, useState } from 'react';

// Type definitions (these should ideally be in a separate types file)
interface Trip {
  id: string;
  distanceKm?: number;
  startDate: string;
  endDate: string;
  revenueAmount?: number;
  revenueCurrency: string;
}

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadDate: string;
}

interface CostEntry {
  id?: string;
  tripId: string;
  category: string;
  subCategory: string;
  amount: number;
  currency: string;
  referenceNumber: string;
  date: string;
  notes: string;
  isFlagged: boolean;
  isSystemGenerated: boolean;
  attachments?: Attachment[];
}

interface SystemCostRates {
  costPerKm: number;
  costPerDay: number;
  adminFee: number;
  insuranceRate: number;
  maintenanceRate: number;
  // Currency-specific rates
  usdRates?: {
    costPerKm: number;
    costPerDay: number;
    adminFee: number;
  };
}


interface SystemCostGeneratorProps {
  trip: Trip;
  onGenerateSystemCosts: (costs: Omit<CostEntry, 'id' | 'attachments'>[]) => void;
}


// Utility function for currency formatting
const formatCurrency = (amount: number, _currency: string = 'USD'): string => {
  const symbol = '$';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};



const SystemCostGenerator: React.FC<SystemCostGeneratorProps> = ({
  trip,
  onGenerateSystemCosts
}) => {

  const [systemRates, setSystemRates] = useState<SystemCostRates>({
    // Base rates
    costPerKm: 2.5,
    costPerDay: 1500,
    adminFee: 500,
    insuranceRate: 0.02,
    maintenanceRate: 0.015,
    // USD rates
    usdRates: {
      costPerKm: 0.14,
      costPerDay: 81,
      adminFee: 27
    }
  });

  // Get appropriate rates based on trip currency
  const getEffectiveRates = () => {
    if (trip.revenueCurrency === 'USD' && systemRates.usdRates) {
      return {
        costPerKm: systemRates.usdRates.costPerKm,
        costPerDay: systemRates.usdRates.costPerDay,
        adminFee: systemRates.usdRates.adminFee,
        insuranceRate: systemRates.insuranceRate,
        maintenanceRate: systemRates.maintenanceRate
      };
    }
    return systemRates;
  };

  const effectiveRates = getEffectiveRates();

  const calculatedCosts = useMemo(() => {
    const costs: Omit<CostEntry, 'id' | 'attachments'>[] = [];

    // Per kilometer costs
    if (trip.distanceKm && trip.distanceKm > 0) {
      const distanceCost = trip.distanceKm * effectiveRates.costPerKm;
      costs.push({
        tripId: trip.id,
        category: 'Operational Overhead',
        subCategory: 'Per Kilometer Cost',
        amount: distanceCost,
        currency: trip.revenueCurrency,
        referenceNumber: `SYS-KM-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        notes: `Automatic per km cost: ${trip.distanceKm}km × ${formatCurrency(effectiveRates.costPerKm, trip.revenueCurrency)}/km (${trip.revenueCurrency} rate)`,
        isFlagged: false,
        isSystemGenerated: true
      });
    }

    // Per day costs
    const startDate = new Date(trip.startDate);
    const endDate = new Date(trip.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (days > 0) {
      const dailyCost = days * effectiveRates.costPerDay;
      costs.push({
        tripId: trip.id,
        category: 'Operational Overhead',
        subCategory: 'Daily Operational Cost',
        amount: dailyCost,
        currency: trip.revenueCurrency,
        referenceNumber: `SYS-DAY-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        notes: `Automatic daily cost: ${days} days × ${formatCurrency(effectiveRates.costPerDay, trip.revenueCurrency)}/day (${trip.revenueCurrency} rate)`,
        isFlagged: false,
        isSystemGenerated: true
      });
    }

    // Insurance cost (percentage of revenue)
    if (trip.revenueAmount && trip.revenueAmount > 0) {
      const insuranceCost = trip.revenueAmount * effectiveRates.insuranceRate;
      costs.push({
        tripId: trip.id,
        category: 'Insurance',
        subCategory: 'Trip Insurance',
        amount: insuranceCost,
        currency: trip.revenueCurrency,
        referenceNumber: `SYS-INS-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        notes: `Automatic insurance: ${(effectiveRates.insuranceRate * 100).toFixed(2)}% of ${formatCurrency(trip.revenueAmount, trip.revenueCurrency)} revenue`,
        isFlagged: false,
        isSystemGenerated: true
      });
    }

    // Maintenance cost (percentage of revenue)
    if (trip.revenueAmount && trip.revenueAmount > 0) {
      const maintenanceCost = trip.revenueAmount * effectiveRates.maintenanceRate;
      costs.push({
        tripId: trip.id,
        category: 'Maintenance',
        subCategory: 'Vehicle Maintenance',
        amount: maintenanceCost,
        currency: trip.revenueCurrency,
        referenceNumber: `SYS-MNT-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        notes: `Automatic maintenance: ${(effectiveRates.maintenanceRate * 100).toFixed(2)}% of ${formatCurrency(trip.revenueAmount, trip.revenueCurrency)} revenue`,
        isFlagged: false,
        isSystemGenerated: true
      });
    }

    // Administration fee
    costs.push({
      tripId: trip.id,
      category: 'Administration',
      subCategory: 'Admin Fee',
      amount: effectiveRates.adminFee,
      currency: trip.revenueCurrency,
      referenceNumber: `SYS-ADM-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      notes: `Automatic administration fee (${trip.revenueCurrency} rate)`,
      isFlagged: false,
      isSystemGenerated: true
    });

    return costs;
  }, [trip, effectiveRates]);

  const totalSystemCosts = calculatedCosts.reduce((sum, cost) => sum + cost.amount, 0);

  // Update rates
  const updateCurrencyRates = () => {
    setSystemRates(prev => ({
      ...prev,
      usdRates: {
        costPerKm: prev.costPerKm,
        costPerDay: prev.costPerDay,
        adminFee: prev.adminFee
      }
    }));
  };

  const handleGenerate = () => {
    onGenerateSystemCosts(calculatedCosts);
  };

  const handleRateChange = (field: keyof SystemCostRates, value: string) => {
    const baseField = field.replace('usd', '') as keyof SystemCostRates;

    if (field.startsWith('usd') && systemRates.usdRates) {
      // Update USD-specific rate
      setSystemRates(prev => ({
        ...prev,
        usdRates: {
          ...prev.usdRates!,
          [baseField]: parseFloat(value) || 0
        }
      }));
    } else {
      // Update rate
      setSystemRates(prev => ({
        ...prev,
        [field]: parseFloat(value) || 0
      }));
      // Auto-update USD rates after a short delay
      setTimeout(updateCurrencyRates, 100);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Calculator className="w-5 h-5" />
            <div>
              <CardTitle>System Cost Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">Configure automatic operational overhead costs</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Currency Information */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border">
            <h4 className="font-semibold text-blue-900 mb-2">Currency Configuration</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Trip Currency:</span>
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {trip.revenueCurrency}
                </span>
              </div>

            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costPerKm">
                Cost per Kilometer ($)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="costPerKm"
                  type="number"
                  step="0.1"
                  value={effectiveRates.costPerKm}
                  onChange={(e) => handleRateChange('costPerKm', e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="costPerDay">
                Cost per Day ($)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="costPerDay"
                  type="number"
                  step="10"
                  value={effectiveRates.costPerDay}
                  onChange={(e) => handleRateChange('costPerDay', e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminFee">
                Admin Fee ($)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="adminFee"
                  type="number"
                  step="10"
                  value={effectiveRates.adminFee}
                  onChange={(e) => handleRateChange('adminFee', e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="insuranceRate">Insurance Rate (%)</Label>
              <div className="relative">
                <Input
                  id="insuranceRate"
                  type="number"
                  step="0.001"
                  value={(systemRates.insuranceRate * 100).toFixed(3)}
                  onChange={(e) => handleRateChange('insuranceRate', (parseFloat(e.target.value) / 100).toString())}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenanceRate">Maintenance Rate (%)</Label>
              <div className="relative">
                <Input
                  id="maintenanceRate"
                  type="number"
                  step="0.001"
                  value={(systemRates.maintenanceRate * 100).toFixed(3)}
                  onChange={(e) => handleRateChange('maintenanceRate', (parseFloat(e.target.value) / 100).toString())}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated System Costs</CardTitle>
          <p className="text-sm text-muted-foreground">Preview of automatic operational costs</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {calculatedCosts.map((cost, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                <div>
                  <p className="font-medium">{cost.subCategory}</p>
                  <p className="text-sm text-muted-foreground">{cost.notes}</p>
                </div>
                <p className="font-semibold">
                  {formatCurrency(cost.amount, cost.currency)}
                </p>
              </div>
            ))}

            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-lg">Total System Costs</p>
                <p className="font-bold text-lg text-primary">
                  {formatCurrency(totalSystemCosts, trip.revenueCurrency)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {totalSystemCosts > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                Impact on Trip Profitability
              </h4>
              <p className="text-sm text-blue-700">
                Adding system costs will reduce the trip's net profit by {formatCurrency(totalSystemCosts, trip.revenueCurrency)}.
                This represents {(totalSystemCosts / (trip.revenueAmount || 1) * 100).toFixed(1)}% of the trip revenue.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <Button variant="outline">
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={calculatedCosts.length === 0}
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Generate System Costs
        </Button>
      </div>
    </div>
  );
};

export default SystemCostGenerator;