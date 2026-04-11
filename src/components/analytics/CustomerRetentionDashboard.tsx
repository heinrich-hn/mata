import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateCustomerPerformance, calculateSummaryMetrics } from '@/lib/customerAnalytics';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Trip } from '@/types/operations';
import
  {
    AlertTriangle,
    Award,
    Clock,
    DollarSign,
    Download,
    Filter,
    TrendingUp,
    Users
  } from 'lucide-react';
import { useMemo, useState } from 'react';

interface CustomerRetentionDashboardProps {
  trips: Trip[];
}

const CustomerRetentionDashboard = ({ trips }: CustomerRetentionDashboardProps) => {
  const [filters, setFilters] = useState({
    riskLevel: '',
    currency: '',
    clientType: ''
  });

  const customerPerformance = useMemo(() => {
    return calculateCustomerPerformance(trips);
  }, [trips]);

  const filteredCustomers = useMemo(() => {
    return customerPerformance.filter(customer => {
      if (filters.riskLevel && customer.riskLevel !== filters.riskLevel) return false;
      if (filters.currency && customer.currency !== filters.currency) return false;
      if (filters.clientType && customer.clientType !== filters.clientType) return false;
      return true;
    });
  }, [customerPerformance, filters]);

  const summary = useMemo(() => {
    return calculateSummaryMetrics(filteredCustomers);
  }, [filteredCustomers]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({ riskLevel: '', currency: '', clientType: '' });
  };

  const exportCustomerData = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "CUSTOMER RETENTION & SERVICE DASHBOARD\n";
    csvContent += `Generated on,${formatDate(new Date())}\n\n`;

    csvContent += "Customer Name,Total Trips,Total Revenue,Currency,Average Payment Days,Payment Score,Last Trip Date,Days Since Last Trip,Risk Level,Client Type,Is At Risk,Is Profitable,Is Top Client\n";
    filteredCustomers.forEach(customer => {
      csvContent += `"${customer.customerName}",${customer.totalTrips},${customer.totalRevenue},${customer.currency},${customer.averagePaymentDays.toFixed(1)},${customer.paymentScore.toFixed(1)},${formatDate(customer.lastTripDate)},${customer.daysSinceLastTrip},${customer.riskLevel.toUpperCase()},${customer.clientType === 'internal' ? 'Internal' : 'External'},${customer.isAtRisk ? 'Yes' : 'No'},${customer.isProfitable ? 'Yes' : 'No'},${customer.isTopClient ? 'Yes' : 'No'}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.download = `customer-retention-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    // Remove link safely
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 100);
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-emerald-600 bg-emerald-500/10 border-emerald-300/50';
      case 'medium': return 'text-amber-600 bg-amber-500/10 border-amber-300/50';
      case 'high': return 'text-rose-600 bg-rose-500/10 border-rose-300/50';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  return (
    <div className="space-y-5">
      {/* Glass Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-5 py-3.5 shadow-sm">
        <span className="text-sm font-medium text-muted-foreground">Monitor customer relationships, payment patterns, and service frequency</span>
        <Button variant="outline" size="sm" onClick={exportCustomerData} className="h-9 gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold tabular-nums">{summary.total}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">At Risk Customers</p>
              <p className="text-2xl font-bold text-destructive tabular-nums">{summary.atRisk}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {summary.total > 0 ? ((summary.atRisk / summary.total) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Top Clients</p>
              <p className="text-2xl font-bold text-emerald-600 tabular-nums">{summary.topClients}</p>
              <p className="text-xs text-muted-foreground">High frequency</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Payment Days</p>
              <p className="text-2xl font-bold text-primary tabular-nums">{summary.avgPaymentDays.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">days after invoice</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-muted/40 backdrop-blur-sm rounded-xl border border-border/40 p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters</span>
          </div>
          <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg">
            Clear
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Risk Level</Label>
              <Select value={filters.riskLevel} onValueChange={(value) => handleFilterChange('riskLevel', value)}>
                <SelectTrigger className="h-9 text-sm bg-background/80 border-border/50 rounded-lg">
                  <SelectValue placeholder="All Risk Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value={filters.currency} onValueChange={(value) => handleFilterChange('currency', value)}>
                <SelectTrigger className="h-9 text-sm bg-background/80 border-border/50 rounded-lg">
                  <SelectValue placeholder="All Currencies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Currencies</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Type</Label>
              <Select value={filters.clientType} onValueChange={(value) => handleFilterChange('clientType', value)}>
                <SelectTrigger className="h-9 text-sm bg-background/80 border-border/50 rounded-lg">
                  <SelectValue placeholder="All Client Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Client Types</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

      {/* Customer Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Most Profitable Clients */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Most Profitable Clients
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-2.5">
              {filteredCustomers
                .filter(c => c.isProfitable)
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .slice(0, 5)
                .map((customer) => (
                  <div key={customer.customerName} className="flex justify-between items-center p-3 bg-emerald-500/5 rounded-xl border border-border/40">
                    <div>
                      <p className="font-medium text-sm">{customer.customerName}</p>
                      <p className="text-xs text-muted-foreground">{customer.totalTrips} trips</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 tabular-nums">
                        {formatCurrency(customer.totalRevenue, customer.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Score: {customer.paymentScore.toFixed(0)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Top Repeat Clients */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Top Repeat Clients
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-2.5">
              {filteredCustomers
                .filter(c => c.isTopClient)
                .sort((a, b) => b.totalTrips - a.totalTrips)
                .slice(0, 5)
                .map((customer) => (
                  <div key={customer.customerName} className="flex justify-between items-center p-3 bg-primary/5 rounded-xl border border-border/40">
                    <div>
                      <p className="font-medium text-sm">{customer.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        Last trip: {formatDate(customer.lastTripDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary tabular-nums">{customer.totalTrips}</p>
                      <p className="text-xs text-muted-foreground">trips</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* At-Risk Clients */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              At-Risk Clients
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-2.5">
              {filteredCustomers
                .filter(c => c.isAtRisk)
                .sort((a, b) => b.daysSinceLastTrip - a.daysSinceLastTrip)
                .slice(0, 5)
                .map((customer) => (
                  <div key={customer.customerName} className="flex justify-between items-center p-3 bg-destructive/5 rounded-xl border border-border/40">
                    <div>
                      <p className="font-medium text-sm">{customer.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.daysSinceLastTrip} days since last trip
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(customer.riskLevel)}`}>
                        {customer.riskLevel.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Customer List */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="font-semibold">Customer Details ({filteredCustomers.length})</h3>
        </div>
        <div className="p-5">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-medium">No customers found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No customers match your current filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 text-sm font-medium text-muted-foreground">Customer</th>
                    <th className="text-center py-3 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-right py-3 text-sm font-medium text-muted-foreground">Trips</th>
                    <th className="text-right py-3 text-sm font-medium text-muted-foreground">Revenue</th>
                    <th className="text-right py-3 text-sm font-medium text-muted-foreground">Payment Score</th>
                    <th className="text-center py-3 text-sm font-medium text-muted-foreground">Last Trip</th>
                    <th className="text-center py-3 text-sm font-medium text-muted-foreground">Risk Level</th>
                    <th className="text-center py-3 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers
                    .sort((a, b) => b.totalRevenue - a.totalRevenue)
                    .map((customer) => (
                      <tr key={customer.customerName} className="border-b hover:bg-muted/50">
                        <td className="py-3 text-sm font-medium">
                          {customer.customerName}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            customer.clientType === 'internal' ? 'bg-primary/10 text-primary' : 'bg-violet-500/10 text-violet-700'
                          }`}>
                            {customer.clientType === 'internal' ? 'Internal' : 'External'}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-right">
                          {customer.totalTrips}
                        </td>
                        <td className="py-3 text-sm font-medium text-right">
                          {formatCurrency(customer.totalRevenue, customer.currency)}
                        </td>
                        <td className="py-3 text-sm text-right">
                          <span className={`font-medium ${
                            customer.paymentScore >= 80 ? 'text-emerald-600' :
                            customer.paymentScore >= 60 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {customer.paymentScore.toFixed(0)}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-center">
                          {formatDate(customer.lastTripDate)}
                          <div className="text-xs text-muted-foreground">
                            ({customer.daysSinceLastTrip} days ago)
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(customer.riskLevel)}`}>
                            {customer.riskLevel.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex justify-center space-x-1">
                            {customer.isProfitable && (
                              <span className="inline-flex items-center px-1 py-1 rounded text-xs bg-emerald-500/10 text-emerald-700" title="Profitable">
                                <DollarSign className="w-3 h-3" />
                              </span>
                            )}
                            {customer.isTopClient && (
                              <span className="inline-flex items-center px-1 py-1 rounded text-xs bg-primary/10 text-primary" title="Top Client">
                                <Award className="w-3 h-3" />
                              </span>
                            )}
                            {customer.isAtRisk && (
                              <span className="inline-flex items-center px-1 py-1 rounded text-xs bg-destructive/10 text-destructive" title="At Risk">
                                <AlertTriangle className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerRetentionDashboard;