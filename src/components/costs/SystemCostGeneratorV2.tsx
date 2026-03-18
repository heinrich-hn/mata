/**
 * System Cost Generator Component - Updated Version
 * Generates automatic operational overhead costs for trips
 * with editable daily rates and per-km costs
 */
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, Settings } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface Trip {
  id: string;
  distanceKm?: number;
  startDate: string;
  endDate: string;
  revenueAmount?: number;
  revenueCurrency: string;
}

interface CostEntry {
  trip_id: string;
  category: string;
  sub_category: string;
  amount: number;
  currency: string;
  reference_number: string;
  date: string;
  notes: string;
  is_flagged: boolean;
  is_system_generated: boolean;
}

interface DailyRates {
  wages: number;
  radioLicense: number;
  depreciation: number;
  cof: number;
  licence: number;
  software: number;
  trackingUnit: number;
  insuranceGit: number;
}

interface PerKmRates {
  rm: number;  // Repairs & Maintenance
  tyres: number;
}

interface SystemCostGeneratorProps {
  trip: Trip;
  onGenerateSystemCosts: (costs: CostEntry[]) => void;
}

const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  const symbol = currency === 'USD' ? '$' : 'R';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const SystemCostGenerator: React.FC<SystemCostGeneratorProps> = ({
  trip,
  onGenerateSystemCosts
}) => {
  const [showRateEditor, setShowRateEditor] = useState(false);

  // Daily cost rates (USD per day)
  const [dailyRates, setDailyRates] = useState<DailyRates>({
    wages: 24.88,
    radioLicense: 0.41,
    depreciation: 35.69,
    cof: 0.14,
    licence: 2.61,
    software: 1.34,
    trackingUnit: 0.99,
    insuranceGit: 10.21
  });

  // Per-kilometer rates (USD per km)
  const [perKmRates, setPerKmRates] = useState<PerKmRates>({
    rm: 0.15,        // Repairs & Maintenance
    tyres: 0.10      // Tyre wear
  });

  // Calculate trip duration in days
  const tripDays = useMemo(() => {
    if (!trip.startDate || !trip.endDate) return 0;
    const startDate = new Date(trip.startDate);
    const endDate = new Date(trip.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days); // Minimum 1 day
  }, [trip.startDate, trip.endDate]);

  // Calculate all costs
  const calculatedCosts = useMemo(() => {
    const costs: CostEntry[] = [];
    const currency = trip.revenueCurrency || 'USD';
    const today = new Date().toISOString().split('T')[0];

    // Daily costs (calculated per day)
    if (tripDays > 0) {
      // Wages
      costs.push({
        trip_id: trip.id,
        category: 'Labor',
        sub_category: 'Driver Wages',
        amount: dailyRates.wages * tripDays,
        currency,
        reference_number: `SYS-WAGES-${Date.now()}`,
        date: today,
        notes: `Driver wages: ${tripDays} days × ${formatCurrency(dailyRates.wages, currency)}/day`,
        is_flagged: false,
        is_system_generated: true
      });

      // Radio License
      costs.push({
        trip_id: trip.id,
        category: 'Operational Overhead',
        sub_category: 'Radio License',
        amount: dailyRates.radioLicense * tripDays,
        currency,
        reference_number: `SYS-RADIO-${Date.now()}`,
        date: today,
        notes: `Radio license: ${tripDays} days × ${formatCurrency(dailyRates.radioLicense, currency)}/day`,
        is_flagged: false,
        is_system_generated: true
      });

      // Depreciation
      costs.push({
        trip_id: trip.id,
        category: 'Depreciation',
        sub_category: 'Vehicle Depreciation',
        amount: dailyRates.depreciation * tripDays,
        currency,
        reference_number: `SYS-DEPR-${Date.now()}`,
        date: today,
        notes: `Vehicle depreciation: ${tripDays} days × ${formatCurrency(dailyRates.depreciation, currency)}/day`,
        is_flagged: false,
        is_system_generated: true
      });

      // COF (Certificate of Fitness)
      costs.push({
        trip_id: trip.id,
        category: 'Compliance',
        sub_category: 'COF',
        amount: dailyRates.cof * tripDays,
        currency,
        reference_number: `SYS-COF-${Date.now()}`,
        date: today,
        notes: `COF: ${tripDays} days × ${formatCurrency(dailyRates.cof, currency)}/day`,
        is_flagged: false,
        is_system_generated: true
      });

      // Licence
      costs.push({
        trip_id: trip.id,
        category: 'Compliance',
        sub_category: 'Vehicle Licence',
        amount: dailyRates.licence * tripDays,
        currency,
        reference_number: `SYS-LIC-${Date.now()}`,
        date: today,
        notes: `Vehicle licence: ${tripDays} days × ${formatCurrency(dailyRates.licence, currency)}/day`,
        is_flagged: false,
        is_system_generated: true
      });

      // Software
      costs.push({
        trip_id: trip.id,
        category: 'Technology',
        sub_category: 'Software Subscription',
        amount: dailyRates.software * tripDays,
        currency,
        reference_number: `SYS-SOFT-${Date.now()}`,
        date: today,
        notes: `Software: ${tripDays} days × ${formatCurrency(dailyRates.software, currency)}/day`,
        is_flagged: false,
        is_system_generated: true
      });

      // Tracking Unit
      costs.push({
        trip_id: trip.id,
        category: 'Technology',
        sub_category: 'GPS Tracking',
        amount: dailyRates.trackingUnit * tripDays,
        currency,
        reference_number: `SYS-TRACK-${Date.now()}`,
        date: today,
        notes: `Tracking unit: ${tripDays} days × ${formatCurrency(dailyRates.trackingUnit, currency)}/day`,
        is_flagged: false,
        is_system_generated: true
      });

      // Insurance/GIT
      costs.push({
        trip_id: trip.id,
        category: 'Insurance',
        sub_category: 'GIT Insurance',
        amount: dailyRates.insuranceGit * tripDays,
        currency,
        reference_number: `SYS-INS-${Date.now()}`,
        date: today,
        notes: `Insurance/GIT: ${tripDays} days × ${formatCurrency(dailyRates.insuranceGit, currency)}/day`,
        is_flagged: false,
        is_system_generated: true
      });
    }

    // Per-kilometer costs
    if (trip.distanceKm && trip.distanceKm > 0) {
      // R&M (Repairs & Maintenance)
      costs.push({
        trip_id: trip.id,
        category: 'Maintenance',
        sub_category: 'Repairs & Maintenance',
        amount: perKmRates.rm * trip.distanceKm,
        currency,
        reference_number: `SYS-RM-${Date.now()}`,
        date: today,
        notes: `R&M: ${trip.distanceKm}km × ${formatCurrency(perKmRates.rm, currency)}/km`,
        is_flagged: false,
        is_system_generated: true
      });

      // Tyre wear
      costs.push({
        trip_id: trip.id,
        category: 'Maintenance',
        sub_category: 'Tyre Wear',
        amount: perKmRates.tyres * trip.distanceKm,
        currency,
        reference_number: `SYS-TYRE-${Date.now()}`,
        date: today,
        notes: `Tyre wear: ${trip.distanceKm}km × ${formatCurrency(perKmRates.tyres, currency)}/km`,
        is_flagged: false,
        is_system_generated: true
      });
    }

    return costs;
  }, [trip, dailyRates, perKmRates, tripDays]);

  // Calculate totals
  const totalDailyCosts = useMemo(() => {
    return calculatedCosts
      .filter(c => c.category !== 'Maintenance')
      .reduce((sum, cost) => sum + cost.amount, 0);
  }, [calculatedCosts]);

  const totalPerKmCosts = useMemo(() => {
    return calculatedCosts
      .filter(c => c.category === 'Maintenance')
      .reduce((sum, cost) => sum + cost.amount, 0);
  }, [calculatedCosts]);

  const totalCosts = totalDailyCosts + totalPerKmCosts;

  const handleGenerate = () => {
    onGenerateSystemCosts(calculatedCosts);
  };

  const handleRateChange = (category: 'daily' | 'perKm', field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    if (category === 'daily') {
      setDailyRates(prev => ({ ...prev, [field]: numValue }));
    } else {
      setPerKmRates(prev => ({ ...prev, [field]: numValue }));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                System Cost Generator
              </CardTitle>
              <CardDescription>
                Automatically calculate operational overhead costs
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRateEditor(!showRateEditor)}
            >
              <Settings className="w-4 h-4 mr-2" />
              {showRateEditor ? 'Hide' : 'Edit'} Rates
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rate Editor */}
          {showRateEditor && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold text-sm">Daily Cost Rates (per day)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Wages</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dailyRates.wages}
                    onChange={(e) => handleRateChange('daily', 'wages', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Radio License</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dailyRates.radioLicense}
                    onChange={(e) => handleRateChange('daily', 'radioLicense', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Depreciation</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dailyRates.depreciation}
                    onChange={(e) => handleRateChange('daily', 'depreciation', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">COF</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dailyRates.cof}
                    onChange={(e) => handleRateChange('daily', 'cof', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Licence</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dailyRates.licence}
                    onChange={(e) => handleRateChange('daily', 'licence', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Software</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dailyRates.software}
                    onChange={(e) => handleRateChange('daily', 'software', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tracking Unit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dailyRates.trackingUnit}
                    onChange={(e) => handleRateChange('daily', 'trackingUnit', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Insurance/GIT</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dailyRates.insuranceGit}
                    onChange={(e) => handleRateChange('daily', 'insuranceGit', e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>

              <h3 className="font-semibold text-sm mt-4">Per-Kilometer Rates</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">R&M (Repairs & Maintenance)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={perKmRates.rm}
                    onChange={(e) => handleRateChange('perKm', 'rm', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tyre Wear</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={perKmRates.tyres}
                    onChange={(e) => handleRateChange('perKm', 'tyres', e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Cost Summary */}
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
              <span className="text-sm font-medium">Trip Duration</span>
              <span className="font-bold">{tripDays} days</span>
            </div>

            {trip.distanceKm && trip.distanceKm > 0 && (
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <span className="text-sm font-medium">Trip Distance</span>
                <span className="font-bold">{trip.distanceKm.toFixed(1)} km</span>
              </div>
            )}

            <div className="flex justify-between items-center p-3 bg-green-50 rounded">
              <span className="text-sm font-medium">Total Daily Costs</span>
              <span className="font-bold text-green-700">
                {formatCurrency(totalDailyCosts, trip.revenueCurrency)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
              <span className="text-sm font-medium">Total Per-Km Costs</span>
              <span className="font-bold text-purple-700">
                {formatCurrency(totalPerKmCosts, trip.revenueCurrency)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-primary/10 rounded">
              <span className="font-semibold">Total System Costs</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(totalCosts, trip.revenueCurrency)}
              </span>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Cost Breakdown</h4>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {calculatedCosts.map((cost, index) => (
                <div key={index} className="flex justify-between text-sm p-2 hover:bg-muted rounded">
                  <span className="text-muted-foreground">{cost.sub_category}</span>
                  <span className="font-medium">{formatCurrency(cost.amount, cost.currency)}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            className="w-full"
            disabled={calculatedCosts.length === 0}
          >
            <Calculator className="w-4 h-4 mr-2" />
            Generate {calculatedCosts.length} System Cost{calculatedCosts.length !== 1 ? 's' : ''}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemCostGenerator;