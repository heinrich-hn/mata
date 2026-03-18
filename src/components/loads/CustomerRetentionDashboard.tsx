import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import
  {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
import type { Database } from "@/integrations/supabase/types";
import
  {
    AlertTriangle,
    Award,
    Clock,
    DollarSign,
    Download,
    Filter,
    TrendingUp,
    Users,
  } from "lucide-react";
import { useMemo, useState } from "react";

type Load = Database["public"]["Tables"]["loads"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

interface CustomerRetentionDashboardProps {
  loads: Load[];
  invoices?: Invoice[];
}

interface CustomerPerformance {
  customerName: string;
  customerId: string | null;
  totalLoads: number;
  totalRevenue: number;
  currency: string;
  averagePaymentDays: number;
  paymentScore: number;
  lastLoadDate: string;
  riskLevel: "low" | "medium" | "high";
  isAtRisk: boolean;
  isProfitable: boolean;
  isTopClient: boolean;
  daysSinceLastLoad: number;
}

export const CustomerRetentionDashboard = ({
  loads,
  invoices = [],
}: CustomerRetentionDashboardProps) => {
  const [filters, setFilters] = useState({
    riskLevel: "",
    currency: "",
    status: "",
  });

  const customerPerformance = useMemo(() => {
    interface CustomerStats {
      loads: Load[];
      totalRevenue: number;
      totalPaymentDays: number;
      paidLoads: number;
      customerId: string | null;
    }

    const customerStats: Record<string, CustomerStats> = {};

    loads.forEach((load) => {
      const customerKey = load.customer_name;
      if (!customerStats[customerKey]) {
        customerStats[customerKey] = {
          loads: [],
          totalRevenue: 0,
          totalPaymentDays: 0,
          paidLoads: 0,
          customerId: load.customer_id,
        };
      }

      customerStats[customerKey].loads.push(load);
      customerStats[customerKey].totalRevenue += load.final_price || load.quoted_price || 0;

      // Calculate payment days from invoices
      const loadInvoices = invoices.filter((inv) => inv.trip_id === load.id);
      loadInvoices.forEach((invoice) => {
        if (invoice.paid_at && invoice.invoice_date) {
          const invoiceDate = new Date(invoice.invoice_date);
          const paidDate = new Date(invoice.paid_at);
          const paymentDays = Math.floor(
            (paidDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          customerStats[customerKey].totalPaymentDays += paymentDays;
          customerStats[customerKey].paidLoads++;
        }
      });
    });

    return Object.entries(customerStats).map(
      ([customerName, stats]: [string, CustomerStats]) => {
        const completedLoads = stats.loads.filter(
          (l: Load) => l.status === "delivered" || l.status === "completed"
        );
        const lastLoadDate =
          completedLoads.length > 0
            ? Math.max(
                ...completedLoads.map((l: Load) =>
                  new Date(l.actual_delivery_datetime || l.delivery_datetime).getTime()
                )
              )
            : Math.max(...stats.loads.map((l: Load) => new Date(l.created_at).getTime()));

        const daysSinceLastLoad = Math.floor((Date.now() - lastLoadDate) / (1000 * 60 * 60 * 24));

        const averagePaymentDays =
          stats.paidLoads > 0 ? stats.totalPaymentDays / stats.paidLoads : 0;

        // Calculate payment score (0-100, where 100 is best)
        const paymentScore = Math.max(0, 100 - Math.abs(averagePaymentDays) * 2);

        // Determine risk level
        const isAtRisk = daysSinceLastLoad > 60 || averagePaymentDays > 30;
        const riskLevel =
          daysSinceLastLoad > 90 || averagePaymentDays > 45
            ? "high"
            : daysSinceLastLoad > 60 || averagePaymentDays > 20
            ? "medium"
            : "low";

        // Determine if profitable (threshold can be adjusted)
        const isProfitable = stats.totalRevenue > 50000;

        // Determine if top client (5+ loads)
        const isTopClient = stats.loads.length >= 5;

        const currency = stats.loads[0]?.currency || "ZAR";

        return {
          customerName,
          customerId: stats.customerId,
          totalLoads: stats.loads.length,
          totalRevenue: stats.totalRevenue,
          currency,
          averagePaymentDays,
          paymentScore,
          lastLoadDate: new Date(lastLoadDate).toISOString().split("T")[0],
          riskLevel,
          isAtRisk,
          isProfitable,
          isTopClient,
          daysSinceLastLoad,
        } as CustomerPerformance;
      }
    );
  }, [loads, invoices]);

  const filteredCustomers = useMemo(() => {
    return customerPerformance.filter((customer) => {
      if (filters.riskLevel && customer.riskLevel !== filters.riskLevel) return false;
      if (filters.currency && customer.currency !== filters.currency) return false;
      return true;
    });
  }, [customerPerformance, filters]);

  const summary = useMemo(() => {
    const total = filteredCustomers.length;
    const atRisk = filteredCustomers.filter((c) => c.isAtRisk).length;
    const profitable = filteredCustomers.filter((c) => c.isProfitable).length;
    const topClients = filteredCustomers.filter((c) => c.isTopClient).length;

    const totalRevenue = filteredCustomers.reduce((sum, c) => sum + c.totalRevenue, 0);
    const avgPaymentDays =
      filteredCustomers.length > 0
        ? filteredCustomers.reduce((sum, c) => sum + c.averagePaymentDays, 0) /
          filteredCustomers.length
        : 0;

    return {
      total,
      atRisk,
      profitable,
      topClients,
      totalRevenue,
      avgPaymentDays,
    };
  }, [filteredCustomers]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({ riskLevel: "", currency: "", status: "" });
  };

  const exportCustomerData = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "CUSTOMER RETENTION & SERVICE DASHBOARD - LOADS\n";
    csvContent += `Generated on,${new Date().toLocaleDateString()}\n\n`;

    csvContent +=
      "Customer Name,Total Loads,Total Revenue,Currency,Average Payment Days,Payment Score,Last Load Date,Days Since Last Load,Risk Level,Is At Risk,Is Profitable,Is Top Client\n";
    filteredCustomers.forEach((customer) => {
      csvContent += `"${customer.customerName}",${customer.totalLoads},${customer.totalRevenue},${customer.currency},${customer.averagePaymentDays.toFixed(1)},${customer.paymentScore.toFixed(1)},${customer.lastLoadDate},${customer.daysSinceLastLoad},${customer.riskLevel.toUpperCase()},${customer.isAtRisk ? "Yes" : "No"},${customer.isProfitable ? "Yes" : "No"},${customer.isTopClient ? "Yes" : "No"}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `customer-retention-loads-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return "text-green-600 bg-green-50 border-green-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-muted-foreground bg-gray-50 border-gray-200";
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency === "ZAR" ? "ZAR" : "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Customer Retention & Service Dashboard
          </h2>
          <p className="text-muted-foreground">
            Monitor customer relationships, payment patterns, and service frequency for loads
          </p>
        </div>
        <Button variant="outline" onClick={exportCustomerData}>
          <Download className="w-4 h-4 mr-2" />
          Export Analysis
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold text-foreground">{summary.total}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">At Risk Customers</p>
                <p className="text-2xl font-bold text-red-600">{summary.atRisk}</p>
                <p className="text-xs text-gray-400">
                  {summary.total > 0 ? ((summary.atRisk / summary.total) * 100).toFixed(1) : 0}% of
                  total
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Top Clients</p>
                <p className="text-2xl font-bold text-green-600">{summary.topClients}</p>
                <p className="text-xs text-gray-400">High frequency</p>
              </div>
              <Award className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Payment Days</p>
                <p className="text-2xl font-bold text-blue-600">
                  {summary.avgPaymentDays.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400">days after invoice</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Filter Customers</CardTitle>
            <Button size="sm" variant="outline" onClick={clearFilters}>
              <Filter className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Risk Level</label>
              <Select
                value={filters.riskLevel}
                onValueChange={(value) => handleFilterChange("riskLevel", value)}
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Currency</label>
              <Select
                value={filters.currency}
                onValueChange={(value) => handleFilterChange("currency", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Currencies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Currencies</SelectItem>
                  <SelectItem value="ZAR">ZAR (R)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Profitable Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Most Profitable Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredCustomers
                .filter((c) => c.isProfitable)
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .slice(0, 5)
                .map((customer) => (
                  <div
                    key={customer.customerName}
                    className="flex justify-between items-center p-3 bg-green-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{customer.customerName}</p>
                      <p className="text-sm text-muted-foreground">{customer.totalLoads} loads</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        {formatCurrency(customer.totalRevenue, customer.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Score: {customer.paymentScore.toFixed(0)}
                      </p>
                    </div>
                  </div>
                ))}
              {filteredCustomers.filter((c) => c.isProfitable).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No profitable clients yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Repeat Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Top Repeat Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredCustomers
                .filter((c) => c.isTopClient)
                .sort((a, b) => b.totalLoads - a.totalLoads)
                .slice(0, 5)
                .map((customer) => (
                  <div
                    key={customer.customerName}
                    className="flex justify-between items-center p-3 bg-blue-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{customer.customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        Last load: {new Date(customer.lastLoadDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{customer.totalLoads}</p>
                      <p className="text-xs text-muted-foreground">loads</p>
                    </div>
                  </div>
                ))}
              {filteredCustomers.filter((c) => c.isTopClient).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No top clients yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* At-Risk Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              At-Risk Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredCustomers
                .filter((c) => c.isAtRisk)
                .sort((a, b) => b.daysSinceLastLoad - a.daysSinceLastLoad)
                .slice(0, 5)
                .map((customer) => (
                  <div
                    key={customer.customerName}
                    className="flex justify-between items-center p-3 bg-red-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{customer.customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {customer.daysSinceLastLoad} days since last load
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant="outline"
                        className={getRiskColor(customer.riskLevel)}
                      >
                        {customer.riskLevel.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              {filteredCustomers.filter((c) => c.isAtRisk).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No at-risk clients</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Customer List */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Details ({filteredCustomers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-10 w-10 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No customers found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No customers match your current filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Loads</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Payment Score</TableHead>
                    <TableHead className="text-center">Last Load</TableHead>
                    <TableHead className="text-center">Risk Level</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers
                    .sort((a, b) => b.totalRevenue - a.totalRevenue)
                    .map((customer) => (
                      <TableRow key={customer.customerName}>
                        <TableCell className="font-medium">{customer.customerName}</TableCell>
                        <TableCell className="text-right">{customer.totalLoads}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(customer.totalRevenue, customer.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-medium ${
                              customer.paymentScore >= 80
                                ? "text-green-600"
                                : customer.paymentScore >= 60
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {customer.paymentScore.toFixed(0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div>{new Date(customer.lastLoadDate).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">
                            ({customer.daysSinceLastLoad} days ago)
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={getRiskColor(customer.riskLevel)}
                          >
                            {customer.riskLevel.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            {customer.isProfitable && (
                              <Badge
                                variant="outline"
                                className="bg-green-100 text-green-800"
                                title="Profitable"
                              >
                                <DollarSign className="w-3 h-3" />
                              </Badge>
                            )}
                            {customer.isTopClient && (
                              <Badge
                                variant="outline"
                                className="bg-blue-100 text-blue-800"
                                title="Top Client"
                              >
                                <Award className="w-3 h-3" />
                              </Badge>
                            )}
                            {customer.isAtRisk && (
                              <Badge
                                variant="outline"
                                className="bg-red-100 text-red-800"
                                title="At Risk"
                              >
                                <AlertTriangle className="w-3 h-3" />
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
