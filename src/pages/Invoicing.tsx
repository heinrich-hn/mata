import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Bell, DollarSign, Download, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

interface InvoiceTrip {
  id: string;
  trip_number: string | null;
  client_name: string | null;
  invoice_number: string | null;
  invoice_submitted_date: string | null;
  base_revenue: number | null;
  revenue_currency: string | null;
  status: string | null;
  payment_status: string | null;
}

const Invoicing = () => {
  const { toast } = useToast();
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerSearch, setCustomerSearch] = useState<string>("");

  // Fetch trips with invoice data
  const { data: trips = [], isLoading, error } = useQuery({
    queryKey: ["trips", "invoiced"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .in("status", ["invoiced", "paid"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as InvoiceTrip[];
    },
  });

  // Helper to calculate due date (30 days from invoice submitted date)
  const getDueDate = (invoiceSubmittedDate: string | null): Date | null => {
    if (!invoiceSubmittedDate) return null;
    const dueDate = new Date(invoiceSubmittedDate);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  };

  // Calculate statistics
  const statistics = useMemo(() => {
    const stats = {
      totalOutstanding: { ZAR: 0, USD: 0 },
      totalPaid: { ZAR: 0, USD: 0 },
      overdueAmount: { ZAR: 0, USD: 0 },
      overdueCount: 0,
      invoiceCount: trips.length,
      paidCount: 0,
      collectionRate: 0,
    };

    const today = new Date();

    trips.forEach((trip) => {
      const currency = (trip.revenue_currency || "ZAR") as "ZAR" | "USD";
      const amount = trip.base_revenue || 0;

      if (trip.status === "paid") {
        stats.totalPaid[currency] += amount;
        stats.paidCount++;
      } else {
        stats.totalOutstanding[currency] += amount;

        // Check if overdue (30 days from invoice submitted date)
        const dueDate = getDueDate(trip.invoice_submitted_date);
        if (dueDate && dueDate < today) {
          stats.overdueAmount[currency] += amount;
          stats.overdueCount++;
        }
      }
    });

    // Calculate collection rate
    const totalInvoiced = stats.totalPaid.ZAR + stats.totalPaid.USD + stats.totalOutstanding.ZAR + stats.totalOutstanding.USD;
    const totalCollected = stats.totalPaid.ZAR + stats.totalPaid.USD;
    stats.collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

    return stats;
  }, [trips]);

  // Filter trips
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      // Currency filter
      if (currencyFilter !== "all" && trip.revenue_currency !== currencyFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && trip.status !== statusFilter) {
        return false;
      }

      // Customer search
      if (customerSearch && !trip.client_name?.toLowerCase().includes(customerSearch.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [trips, currencyFilter, statusFilter, customerSearch]);

  // Calculate aging
  const invoiceAging = useMemo(() => {
    const aging = {
      current: { ZAR: 0, USD: 0, count: 0 },
      days30: { ZAR: 0, USD: 0, count: 0 },
      days60: { ZAR: 0, USD: 0, count: 0 },
      days90Plus: { ZAR: 0, USD: 0, count: 0 },
    };

    const today = new Date();

    filteredTrips.forEach((trip) => {
      if (trip.status === "paid") return;

      const currency = (trip.revenue_currency || "ZAR") as "ZAR" | "USD";
      const amount = trip.base_revenue || 0;

      const dueDate = getDueDate(trip.invoice_submitted_date);
      if (!dueDate) {
        aging.current[currency] += amount;
        aging.current.count++;
        return;
      }

      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysPastDue < 0) {
        aging.current[currency] += amount;
        aging.current.count++;
      } else if (daysPastDue <= 30) {
        aging.days30[currency] += amount;
        aging.days30.count++;
      } else if (daysPastDue <= 60) {
        aging.days60[currency] += amount;
        aging.days60.count++;
      } else {
        aging.days90Plus[currency] += amount;
        aging.days90Plus.count++;
      }
    });

    return aging;
  }, [filteredTrips]);

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === "USD" ? "$" : "R";
    return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-ZA");
  };

  const exportToCSV = () => {
    const csvRows = [
      ["Invoice Number", "Customer", "Invoice Date", "Due Date", "Amount", "Currency", "Status"],
      ...filteredTrips.map((trip) => {
        const dueDate = getDueDate(trip.invoice_submitted_date);
        return [
          trip.invoice_number || "",
          trip.client_name || "",
          formatDate(trip.invoice_submitted_date),
          dueDate ? formatDate(dueDate.toISOString()) : "N/A",
          (trip.base_revenue || 0).toString(),
          trip.revenue_currency || "ZAR",
          trip.status || "",
        ];
      }),
    ];

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Invoice data has been exported to CSV",
    });
  };

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Invoices</h2>
            <p className="text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-semibold">{formatCurrency(statistics.totalOutstanding.ZAR, "ZAR")}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(statistics.totalOutstanding.USD, "USD")}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-semibold">{statistics.overdueCount}</div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(statistics.overdueAmount.ZAR, "ZAR")}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-semibold">{statistics.collectionRate.toFixed(1)}%</div>
                <div className="flex items-center text-sm">
                  {statistics.collectionRate >= 80 ? (
                    <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive mr-1" />
                  )}
                  <span className="text-muted-foreground">
                    {statistics.paidCount} of {statistics.invoiceCount} paid
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-semibold">{formatCurrency(statistics.totalPaid.ZAR, "ZAR")}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(statistics.totalPaid.USD, "USD")}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alert */}
        {statistics.overdueCount > 0 && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <Bell className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <h4 className="font-semibold">Overdue Invoices Require Attention</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    You have {statistics.overdueCount} overdue invoice{statistics.overdueCount !== 1 ? "s" : ""} totaling{" "}
                    {formatCurrency(statistics.overdueAmount.ZAR, "ZAR")} / {formatCurrency(statistics.overdueAmount.USD, "USD")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="aging" className="space-y-6">
          <TabsList>
            <TabsTrigger value="aging">Invoice Aging</TabsTrigger>
            <TabsTrigger value="invoices">All Invoices</TabsTrigger>
          </TabsList>

          {/* Invoice Aging Tab */}
          <TabsContent value="aging" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>ZAR Aging Analysis</CardTitle>
                  <CardDescription>Outstanding invoices by age (South African Rand)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Current (Not Due)</p>
                      <p className="text-xs text-muted-foreground">{invoiceAging.current.count} invoices</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(invoiceAging.current.ZAR, "ZAR")}</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">1-30 Days</p>
                      <p className="text-xs text-muted-foreground">{invoiceAging.days30.count} invoices</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(invoiceAging.days30.ZAR, "ZAR")}</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">31-60 Days</p>
                      <p className="text-xs text-muted-foreground">{invoiceAging.days60.count} invoices</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(invoiceAging.days60.ZAR, "ZAR")}</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">90+ Days</p>
                      <p className="text-xs text-muted-foreground">{invoiceAging.days90Plus.count} invoices</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(invoiceAging.days90Plus.ZAR, "ZAR")}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>USD Aging Analysis</CardTitle>
                  <CardDescription>Outstanding invoices by age (US Dollars)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Current (Not Due)</p>
                      <p className="text-xs text-muted-foreground">{invoiceAging.current.count} invoices</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(invoiceAging.current.USD, "USD")}</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">1-30 Days</p>
                      <p className="text-xs text-muted-foreground">{invoiceAging.days30.count} invoices</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(invoiceAging.days30.USD, "USD")}</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">31-60 Days</p>
                      <p className="text-xs text-muted-foreground">{invoiceAging.days60.count} invoices</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(invoiceAging.days60.USD, "USD")}</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">90+ Days</p>
                      <p className="text-xs text-muted-foreground">{invoiceAging.days90Plus.count} invoices</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(invoiceAging.days90Plus.USD, "USD")}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* All Invoices Tab */}
          <TabsContent value="invoices" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filter Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Currency</label>
                    <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Currencies</SelectItem>
                        <SelectItem value="ZAR">ZAR (R)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="invoiced">Invoiced</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Customer</label>
                    <Input
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice List */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice List ({filteredTrips.length})</CardTitle>
                <CardDescription>All invoiced and paid trips</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading invoices...</p>
                  </div>
                ) : filteredTrips.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Invoices Found</h3>
                    <p className="text-muted-foreground">No invoices match your current filters</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium">Invoice #</th>
                          <th className="text-left py-3 px-4 text-sm font-medium">Customer</th>
                          <th className="text-left py-3 px-4 text-sm font-medium">Invoice Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium">Due Date</th>
                          <th className="text-right py-3 px-4 text-sm font-medium">Amount</th>
                          <th className="text-center py-3 px-4 text-sm font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTrips.map((trip) => {
                          const dueDate = getDueDate(trip.invoice_submitted_date);
                          const isOverdue =
                            trip.status !== "paid" &&
                            dueDate &&
                            dueDate < new Date();

                          return (
                            <tr key={trip.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-4 text-sm font-medium">{trip.invoice_number || "N/A"}</td>
                              <td className="py-3 px-4 text-sm">{trip.client_name || "Unknown"}</td>
                              <td className="py-3 px-4 text-sm">{formatDate(trip.invoice_submitted_date)}</td>
                              <td className="py-3 px-4 text-sm">
                                <span className={isOverdue ? "text-destructive font-medium" : ""}>
                                  {dueDate ? formatDate(dueDate.toISOString()) : "N/A"}
                                  {isOverdue && " (Overdue)"}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-right font-medium">
                                {formatCurrency(trip.base_revenue || 0, trip.revenue_currency || "ZAR")}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    trip.status === "paid"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {trip.status === "paid" ? "Paid" : "Invoiced"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Invoicing;