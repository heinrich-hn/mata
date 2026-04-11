import { Button } from '@/components/ui/button';
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Building, Calendar, CalendarRange, Download, FileSpreadsheet, Truck, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

export interface ExportableTrip {
  id: string;
  trip_number: string;
  route?: string;
  driver_name?: string;
  client_name?: string;
  vehicle_id?: string;
  fleet_number?: string;
  base_revenue?: number;
  revenue_currency?: string;
  distance_km?: number;
  empty_km?: number;
  departure_date?: string;
  arrival_date?: string;
  completed_at?: string;
  origin?: string;
  destination?: string;
  starting_km?: number;
  ending_km?: number;
  status?: string;
  load_type?: string;
  costs?: { amount: number; currency?: string }[];
  additional_costs?: { amount: number; currency?: string }[];
}

type ExportFilterType = 'all' | 'client' | 'driver' | 'fleet';
type ExportFormatType = 'standard' | 'marketing';

interface TripExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  trips: ExportableTrip[];
  tripType: 'active' | 'completed';
}

type DatePeriodType = 'all' | '1month' | '3months' | '6months' | '1year' | 'custom';

const TripExportDialog = ({ isOpen, onClose, trips, tripType }: TripExportDialogProps) => {
  const { toast } = useToast();
  const [exportFilter, setExportFilter] = useState<ExportFilterType>('all');
  const [exportFormat, setExportFormat] = useState<ExportFormatType>('standard');
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Date range state
  const [datePeriod, setDatePeriod] = useState<DatePeriodType>('all');
  const [customDateFrom, setCustomDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [customDateTo, setCustomDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const clients = [...new Set(trips.map(t => t.client_name).filter(Boolean))] as string[];
    const drivers = [...new Set(trips.map(t => t.driver_name).filter(Boolean))] as string[];
    const fleets = [...new Set(trips.map(t => t.fleet_number).filter(Boolean))] as string[];
    return {
      clients: clients.sort(),
      drivers: drivers.sort(),
      fleets: fleets.sort(),
    };
  }, [trips]);

  // Filter trips by date period first
  const dateFilteredTrips = useMemo(() => {
    if (datePeriod === 'all') return trips;

    const now = new Date();
    let fromDate: Date;
    let toDate = now;

    if (datePeriod === 'custom') {
      fromDate = new Date(customDateFrom);
      toDate = new Date(customDateTo);
      toDate.setHours(23, 59, 59, 999);
    } else {
      switch (datePeriod) {
        case '1month': fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
        case '3months': fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
        case '6months': fromDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break;
        case '1year': fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
        default: return trips;
      }
    }

    return trips.filter(trip => {
      const dateStr = trip.arrival_date || trip.departure_date || trip.completed_at;
      if (!dateStr) return false;
      const tripDate = new Date(dateStr);
      return tripDate >= fromDate && tripDate <= toDate;
    });
  }, [trips, datePeriod, customDateFrom, customDateTo]);

  // Get trips to export based on entity filter (applied on top of date filter)
  const tripsToExport = useMemo(() => {
    if (exportFilter === 'all') return dateFilteredTrips;
    if (!selectedValue) return [];

    switch (exportFilter) {
      case 'client':
        return dateFilteredTrips.filter(t => t.client_name === selectedValue);
      case 'driver':
        return dateFilteredTrips.filter(t => t.driver_name === selectedValue);
      case 'fleet':
        return dateFilteredTrips.filter(t => t.fleet_number === selectedValue);
      default:
        return dateFilteredTrips;
    }
  }, [dateFilteredTrips, exportFilter, selectedValue]);

  // Date period label for display
  const datePeriodLabel = useMemo(() => {
    switch (datePeriod) {
      case '1month': return 'Last Month';
      case '3months': return 'Last 3 Months';
      case '6months': return 'Last 6 Months';
      case '1year': return 'Last Year';
      case 'custom': return `${customDateFrom} → ${customDateTo}`;
      default: return 'All Time';
    }
  }, [datePeriod, customDateFrom, customDateTo]);

  const formatCurrency = (amount: number | undefined, currency: string = 'USD') => {
    if (!amount) return '';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleExport = async () => {
    if (tripsToExport.length === 0) {
      toast({
        title: 'No trips to export',
        description: 'Please select a valid filter option with trips.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Prepare data for export based on format
      let exportData;
      let colWidths;

      // Helper to calculate total expenses for a trip, filtered by currency
      // so that Revenue - Expenses = Profit is meaningful (same currency)
      const calcExpenses = (trip: typeof tripsToExport[0], currency?: string) => {
        const tripCurrency = currency || trip.revenue_currency || 'USD';
        return [...(trip.costs || []), ...(trip.additional_costs || [])]
          .filter(c => (c.currency || 'USD') === tripCurrency)
          .reduce((s, c) => s + (c.amount || 0), 0);
      };

      if (exportFormat === 'marketing') {
        // Marketing format with specific headers
        exportData = tripsToExport.map(trip => {
          const loadSpan = trip.distance_km ||
            (trip.ending_km && trip.starting_km ? trip.ending_km - trip.starting_km : '');
          const tripCurrency = trip.revenue_currency || 'USD';
          const expenses = calcExpenses(trip, tripCurrency);
          const revenue = trip.base_revenue || 0;

          return {
            'Delivery Book': trip.trip_number || '',
            'Load Comment': trip.route || '',
            'Registration': trip.fleet_number || '',
            'Driver': trip.driver_name || '',
            'Client Name': trip.client_name || '',
            'Load Date': formatDate(trip.departure_date),
            'Offload Date': formatDate(trip.arrival_date),
            'From City': trip.origin || '',
            'To City': trip.destination || '',
            'Open Odo': trip.starting_km || '',
            'Closing Odo': trip.ending_km || '',
            'Load Span': loadSpan,
            'Unit Type': trip.load_type || '',
            'Currency': tripCurrency,
            'Tariff': revenue,
            'Expenses': expenses,
            'Profit': revenue - expenses,
          };
        });

        colWidths = [
          { wch: 15 }, // Delivery Book
          { wch: 25 }, // Load Comment
          { wch: 12 }, // Registration
          { wch: 20 }, // Driver
          { wch: 20 }, // Client Name
          { wch: 12 }, // Load Date
          { wch: 12 }, // Offload Date
          { wch: 15 }, // From City
          { wch: 15 }, // To City
          { wch: 12 }, // Open Odo
          { wch: 12 }, // Closing Odo
          { wch: 12 }, // Load Span
          { wch: 12 }, // Unit Type
          { wch: 8 },  // Currency
          { wch: 12 }, // Tariff
          { wch: 12 }, // Expenses
          { wch: 12 }, // Profit
        ];
      } else {
        // Standard format
        exportData = tripsToExport.map(trip => {
          const tripCurrency = trip.revenue_currency || 'USD';
          const expenses = calcExpenses(trip, tripCurrency);
          const revenue = trip.base_revenue || 0;
          return {
            'POD Number': trip.trip_number,
            'Fleet Number': trip.fleet_number || '',
            'Driver': trip.driver_name || '',
            'Client': trip.client_name || '',
            'Route': trip.route || '',
            'Origin': trip.origin || '',
            'Destination': trip.destination || '',
            'Departure Date': formatDate(trip.departure_date),
            ...(tripType === 'completed' ? { 'Arrival Date': formatDate(trip.arrival_date) } : {}),
            ...(tripType === 'completed' ? { 'Completed Date': formatDate(trip.completed_at) } : {}),
            'Revenue': revenue,
            'Expenses': expenses,
            'Profit': revenue - expenses,
            'Currency': tripCurrency,
            'Starting KM': trip.starting_km || '',
            'Ending KM': trip.ending_km || '',
            'Distance (km)': trip.distance_km || '',
            'Empty KM': trip.empty_km || '',
            'Status': trip.status || (tripType === 'active' ? 'Active' : 'Completed'),
          };
        });

        colWidths = [
          { wch: 15 }, // POD Number
          { wch: 12 }, // Fleet Number
          { wch: 20 }, // Driver
          { wch: 20 }, // Client
          { wch: 25 }, // Route
          { wch: 20 }, // Origin
          { wch: 20 }, // Destination
          { wch: 12 }, // Departure Date
          ...(tripType === 'completed' ? [{ wch: 12 }, { wch: 12 }] : []), // Arrival/Completed dates
          { wch: 12 }, // Revenue
          { wch: 12 }, // Expenses
          { wch: 12 }, // Profit
          { wch: 8 },  // Currency
          { wch: 12 }, // Starting KM
          { wch: 12 }, // Ending KM
          { wch: 12 }, // Distance
          { wch: 10 }, // Empty KM
          { wch: 10 }, // Status
        ];
      }

      // Create worksheet from data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      const sheetName = exportFormat === 'marketing'
        ? 'Marketing Export'
        : `${tripType === 'active' ? 'Active' : 'Completed'} Trips`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Add summary sheet
      const summaryData = [
        ['Export Summary'],
        [''],
        ['Export Date', new Date().toLocaleDateString('en-ZA')],
        ['Trip Type', tripType === 'active' ? 'Active Trips' : 'Completed Trips'],
        ['Total Trips', tripsToExport.length],
        [''],
        ['Filter Applied', getFilterDescription()],
        [''],
        ['Revenue Summary'],
      ];

      // Group revenue by currency
      const revenueByCurrency = tripsToExport.reduce((acc, trip) => {
        const currency = trip.revenue_currency || 'USD';
        acc[currency] = (acc[currency] || 0) + (trip.base_revenue || 0);
        return acc;
      }, {} as Record<string, number>);

      Object.entries(revenueByCurrency).forEach(([currency, total]) => {
        summaryData.push(['Total Revenue (' + currency + ')', formatCurrency(total, currency)]);
      });

      // Total distance
      const totalDistance = tripsToExport.reduce((sum, t) => sum + (t.distance_km || 0), 0);
      const totalEmptyKm = tripsToExport.reduce((sum, t) => sum + (t.empty_km || 0), 0);

      summaryData.push(['']);
      summaryData.push(['Total Distance (km)', totalDistance.toLocaleString()]);
      summaryData.push(['Total Empty KM', totalEmptyKm.toLocaleString()]);

      if (totalDistance > 0) {
        const efficiency = ((totalDistance - totalEmptyKm) / totalDistance * 100).toFixed(1);
        summaryData.push(['Overall Efficiency', `${efficiency}%`]);
      }

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      // Generate filename
      const dateStr = new Date().toISOString().split('T')[0];
      const filterSuffix = exportFilter !== 'all' ? `_${exportFilter}_${selectedValue.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const formatSuffix = exportFormat === 'marketing' ? '_Marketing' : '';
      const filename = `${tripType === 'active' ? 'Active' : 'Completed'}_Trips${formatSuffix}${filterSuffix}_${dateStr}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

      toast({
        title: 'Export successful',
        description: `Exported ${tripsToExport.length} trips to ${filename}`,
      });

      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'An error occurred while exporting trips. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getFilterDescription = () => {
    const formatLabel = exportFormat === 'marketing' ? 'Marketing format' : 'Standard format';
    let filterLabel;
    switch (exportFilter) {
      case 'all':
        filterLabel = 'All trips';
        break;
      case 'client':
        filterLabel = `Client: ${selectedValue}`;
        break;
      case 'driver':
        filterLabel = `Driver: ${selectedValue}`;
        break;
      case 'fleet':
        filterLabel = `Fleet: ${selectedValue}`;
        break;
      default:
        filterLabel = 'All trips';
    }
    const dateLabel = datePeriod !== 'all' ? ` | Period: ${datePeriodLabel}` : '';
    return `${formatLabel} - ${filterLabel}${dateLabel}`;
  };

  const handleFilterTypeChange = (value: ExportFilterType) => {
    setExportFilter(value);
    setSelectedValue('');
  };

  const getCurrentOptions = () => {
    switch (exportFilter) {
      case 'client':
        return filterOptions.clients;
      case 'driver':
        return filterOptions.drivers;
      case 'fleet':
        return filterOptions.fleets;
      default:
        return [];
    }
  };

  const getSelectPlaceholder = () => {
    switch (exportFilter) {
      case 'client':
        return 'Select a client';
      case 'driver':
        return 'Select a driver';
      case 'fleet':
        return 'Select a fleet';
      default:
        return 'Select...';
    }
  };

  const getSelectIcon = () => {
    switch (exportFilter) {
      case 'client':
        return <Building className="h-4 w-4 mr-2 text-gray-500" />;
      case 'driver':
        return <User className="h-4 w-4 mr-2 text-gray-500" />;
      case 'fleet':
        return <Truck className="h-4 w-4 mr-2 text-gray-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Export {tripType === 'active' ? 'Active' : 'Completed'} Trips
          </DialogTitle>
          <DialogDescription>
            Export trip data to Excel. Choose to export all trips or filter by specific criteria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as ExportFormatType)}
              className="grid grid-cols-2 gap-3"
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <RadioGroupItem value="standard" id="standard" />
                <Label htmlFor="standard" className="cursor-pointer text-sm flex-1">
                  <div className="font-medium">Standard</div>
                  <div className="text-xs text-gray-500">Full trip details with all fields</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <RadioGroupItem value="marketing" id="marketing" />
                <Label htmlFor="marketing" className="cursor-pointer text-sm flex-1">
                  <div className="font-medium flex items-center gap-1">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Marketing
                  </div>
                  <div className="text-xs text-gray-500">Delivery book format</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Export Filter Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Filter Options</Label>
            <RadioGroup
              value={exportFilter}
              onValueChange={(value) => handleFilterTypeChange(value as ExportFilterType)}
              className="grid grid-cols-2 gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="cursor-pointer text-sm">
                  All trips ({trips.length})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="client" id="client" />
                <Label htmlFor="client" className="cursor-pointer text-sm">
                  By Client
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="driver" id="driver" />
                <Label htmlFor="driver" className="cursor-pointer text-sm">
                  By Driver
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fleet" id="fleet" />
                <Label htmlFor="fleet" className="cursor-pointer text-sm">
                  By Fleet
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Filter Value Selection */}
          {exportFilter !== 'all' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Select {exportFilter === 'client' ? 'Client' : exportFilter === 'driver' ? 'Driver' : 'Fleet'}
              </Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger className="w-full">
                  {getSelectIcon()}
                  <SelectValue placeholder={getSelectPlaceholder()} />
                </SelectTrigger>
                <SelectContent>
                  {getCurrentOptions().length === 0 ? (
                    <div className="px-2 py-4 text-sm text-gray-500 text-center">
                      No {exportFilter}s found in trips
                    </div>
                  ) : (
                    getCurrentOptions().map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Range Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Date Range
            </Label>
            <Select value={datePeriod} onValueChange={(v) => setDatePeriod(v as DatePeriodType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time ({trips.length} trips)</SelectItem>
                <SelectItem value="1month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="1year">Last Year</SelectItem>
                <SelectItem value="custom">
                  <span className="flex items-center gap-1.5">
                    <CalendarRange className="h-3.5 w-3.5" />
                    Custom Range
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {datePeriod === 'custom' && (
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    max={customDateTo}
                    className="h-9 text-sm"
                  />
                </div>
                <span className="text-muted-foreground pb-2">→</span>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    min={customDateFrom}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-sm font-medium text-gray-700 mb-2">Export Preview</div>
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                <span className="font-medium">{tripsToExport.length}</span> trips will be exported
              </p>
              <p>
                Format: <span className="font-medium">{exportFormat === 'marketing' ? 'Marketing (Delivery Book)' : 'Standard'}</span>
              </p>
              <p>
                Period: <span className="font-medium">{datePeriodLabel}</span>
                {datePeriod !== 'all' && (
                  <span className="text-xs text-muted-foreground ml-1">({dateFilteredTrips.length} in range)</span>
                )}
              </p>
              {exportFilter !== 'all' && selectedValue && (
                <p>
                  Filtered by {exportFilter}: <span className="font-medium">{selectedValue}</span>
                </p>
              )}
              {tripsToExport.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {exportFormat === 'marketing'
                    ? 'Columns: Delivery Book, Load Comment, Registration, Driver, Client Name, Load Date, Offload Date, From City, To City, Open Odo, Closing Odo, Load Span, Unit Type, Tariff'
                    : 'Includes trip details, revenue, distance, and summary statistics'}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || (exportFilter !== 'all' && !selectedValue)}
            className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export to Excel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TripExportDialog;