import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bell,
  Building2,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Receipt,
  Send
} from "lucide-react";
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
  payment_received_date: string | null;
  arrival_date: string | null;
  origin: string | null;
  destination: string | null;
}

const InvoicingDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Dialog states
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<InvoiceTrip | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch all trips that are completed, invoiced, or paid
  const { data: trips = [], isLoading, error, refetch } = useQuery({
    queryKey: ["trips", "invoice-workflow"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .in("status", ["completed", "invoiced", "paid"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as InvoiceTrip[];
    },
  });

  // Mark Invoice Sent mutation
  const markInvoiceSentMutation = useMutation({
    mutationFn: async ({ tripId, invoiceNum, invDate }: { tripId: string; invoiceNum: string; invDate: string }) => {
      const { error } = await supabase
        .from("trips")
        .update({
          status: "invoiced",
          invoice_number: invoiceNum,
          invoice_submitted_date: invDate,
        })
        .eq("id", tripId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      refetch();
      toast({
        title: "Invoice Sent",
        description: "Trip has been marked as invoiced",
      });
      setShowInvoiceDialog(false);
      setSelectedTrip(null);
      setInvoiceNumber("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mark Payment Received mutation
  const markPaymentReceivedMutation = useMutation({
    mutationFn: async ({ tripId, payDate }: { tripId: string; payDate: string }) => {
      const { error } = await supabase
        .from("trips")
        .update({
          status: "paid",
          payment_status: "paid",
          payment_received_date: payDate,
        })
        .eq("id", tripId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      refetch();
      toast({
        title: "Payment Received",
        description: "Trip has been marked as paid",
      });
      setShowPaymentDialog(false);
      setSelectedTrip(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper to calculate due date (30 days from invoice submitted date)
  const getDueDate = (invoiceSubmittedDate: string | null): Date | null => {
    if (!invoiceSubmittedDate) return null;
    const dueDate = new Date(invoiceSubmittedDate);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  };

  // Calculate days between two dates
  const calculateDaysBetween = (startDate: string | null, endDate: string | null): number | null => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Get unique client names with summaries and their trips
  const clientSummaries = useMemo(() => {
    const clientMap = new Map<string, {
      toPay: number;
      outstanding: number;
      paid: number;
      currency: string;
      toInvoiceTrips: InvoiceTrip[];
      outstandingTrips: InvoiceTrip[];
      paidTrips: InvoiceTrip[];
    }>();

    trips.forEach((trip) => {
      const clientName = trip.client_name || "Unknown";
      if (!clientMap.has(clientName)) {
        clientMap.set(clientName, {
          toPay: 0,
          outstanding: 0,
          paid: 0,
          currency: trip.revenue_currency || "USD",
          toInvoiceTrips: [],
          outstandingTrips: [],
          paidTrips: [],
        });
      }
      const summary = clientMap.get(clientName)!;
      const amount = trip.base_revenue || 0;

      if (trip.status === "completed") {
        summary.toPay += amount;
        summary.toInvoiceTrips.push(trip);
      } else if (trip.status === "invoiced") {
        summary.outstanding += amount;
        summary.outstandingTrips.push(trip);
      } else if (trip.status === "paid") {
        summary.paid += amount;
        summary.paidTrips.push(trip);
      }
    });

    return Array.from(clientMap.entries())
      .map(([name, summary]) => ({ name, ...summary }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [trips]);

  // Categorize all trips for statistics
  const { readyToInvoice, invoiceSent, paymentReceived } = useMemo(() => {
    const ready: InvoiceTrip[] = [];
    const sent: InvoiceTrip[] = [];
    const received: InvoiceTrip[] = [];

    trips.forEach((trip) => {
      if (trip.status === "completed") {
        ready.push(trip);
      } else if (trip.status === "invoiced") {
        sent.push(trip);
      } else if (trip.status === "paid") {
        received.push(trip);
      }
    });

    return { readyToInvoice: ready, invoiceSent: sent, paymentReceived: received };
  }, [trips]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const stats = {
      readyCount: readyToInvoice.length,
      readyAmount: { USD: 0 },
      invoicedCount: invoiceSent.length,
      invoicedAmount: { USD: 0 },
      paidCount: paymentReceived.length,
      paidAmount: { USD: 0 },
      overdueCount: 0,
      overdueAmount: { USD: 0 },
      avgDaysToPayment: 0,
    };

    const today = new Date();
    let totalPaymentDays = 0;
    let paymentCount = 0;

    readyToInvoice.forEach((trip) => {
      const currency = (trip.revenue_currency || "USD") as string;
      stats.readyAmount[currency] += trip.base_revenue || 0;
    });

    invoiceSent.forEach((trip) => {
      const currency = (trip.revenue_currency || "USD") as string;
      stats.invoicedAmount[currency] += trip.base_revenue || 0;

      // Check if overdue
      const dueDate = getDueDate(trip.invoice_submitted_date);
      if (dueDate && dueDate < today) {
        stats.overdueCount++;
        stats.overdueAmount[currency] += trip.base_revenue || 0;
      }
    });

    paymentReceived.forEach((trip) => {
      const currency = (trip.revenue_currency || "USD") as string;
      stats.paidAmount[currency] += trip.base_revenue || 0;

      // Calculate days to payment
      const days = calculateDaysBetween(trip.invoice_submitted_date, trip.payment_received_date);
      if (days !== null) {
        totalPaymentDays += days;
        paymentCount++;
      }
    });

    stats.avgDaysToPayment = paymentCount > 0 ? Math.round(totalPaymentDays / paymentCount) : 0;

    return stats;
  }, [readyToInvoice, invoiceSent, paymentReceived]);

  const formatCurrency = (amount: number, _currency: string = 'USD') => {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-ZA");
  };

  const handleMarkInvoiceSent = (trip: InvoiceTrip) => {
    setSelectedTrip(trip);
    setInvoiceNumber(`INV-${trip.trip_number || Date.now()}`);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setShowInvoiceDialog(true);
  };

  const handleMarkPaymentReceived = (trip: InvoiceTrip) => {
    setSelectedTrip(trip);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setShowPaymentDialog(true);
  };

  const exportToCSV = () => {
    const allTrips = [...readyToInvoice, ...invoiceSent, ...paymentReceived];
    const csvRows = [
      ["Trip Number", "Customer", "Route", "Amount", "Currency", "Status", "Invoice Number", "Invoice Date", "Payment Date", "Days to Payment"],
      ...allTrips.map((trip) => {
        const days = calculateDaysBetween(trip.invoice_submitted_date, trip.payment_received_date);
        return [
          trip.trip_number || "",
          trip.client_name || "",
          `${trip.origin || ""} - ${trip.destination || ""}`,
          (trip.base_revenue || 0).toString(),
          trip.revenue_currency || "USD",
          trip.status || "",
          trip.invoice_number || "",
          formatDate(trip.invoice_submitted_date),
          formatDate(trip.payment_received_date),
          days !== null ? days.toString() : "",
        ];
      }),
    ];

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-workflow-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Invoice workflow data has been exported to CSV",
    });
  };

  // Export client statement
  const exportClientStatement = (clientName: string, clientData: typeof clientSummaries[0]) => {
    const allClientTrips = [...clientData.toInvoiceTrips, ...clientData.outstandingTrips, ...clientData.paidTrips];
    const csvRows = [
      [`Statement for: ${clientName}`],
      [`Generated: ${new Date().toLocaleDateString("en-ZA")}`],
      [],
      ["Summary"],
      [`To Invoice:, ${formatCurrency(clientData.toPay, clientData.currency)}`],
      [`Outstanding:, ${formatCurrency(clientData.outstanding, clientData.currency)}`],
      [`Paid:, ${formatCurrency(clientData.paid, clientData.currency)}`],
      [`Total:, ${formatCurrency(clientData.toPay + clientData.outstanding + clientData.paid, clientData.currency)}`],
      [],
      ["Trip Number", "Route", "Amount", "Status", "Invoice Number", "Invoice Date", "Due Date", "Payment Date"],
      ...allClientTrips.map((trip) => {
        const dueDate = getDueDate(trip.invoice_submitted_date);
        return [
          trip.trip_number || "",
          `${trip.origin || ""} - ${trip.destination || ""}`,
          formatCurrency(trip.base_revenue || 0, trip.revenue_currency || "USD"),
          trip.status === "completed" ? "To Invoice" : trip.status === "invoiced" ? "Outstanding" : "Paid",
          trip.invoice_number || "",
          formatDate(trip.invoice_submitted_date),
          dueDate ? formatDate(dueDate.toISOString()) : "",
          formatDate(trip.payment_received_date),
        ];
      }),
    ];

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement-${clientName.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Statement Exported",
      description: `Statement for ${clientName} has been exported`,
    });
  };

  // Toggle client expansion
  const toggleClient = (clientName: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientName)) {
        newSet.delete(clientName);
      } else {
        newSet.add(clientName);
      }
      return newSet;
    });
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Invoices</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  // Modern inline row component
  const TripRow = ({ trip, actions }: { trip: InvoiceTrip; actions: React.ReactNode }) => {
    const daysToPayment = calculateDaysBetween(trip.invoice_submitted_date, trip.payment_received_date);
    const dueDate = getDueDate(trip.invoice_submitted_date);
    const isOverdue = trip.status === "invoiced" && dueDate && dueDate < new Date();

    return (
      <div className={`group flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/50 hover:shadow-md transition-all duration-200 ${isOverdue ? 'border-red-200 bg-red-50/50 hover:bg-red-50' : 'border-border'
        }`}>
        {/* Left: Trip Info */}
        <div className="flex items-center gap-6 flex-1 min-w-0">
          {/* Trip Number & Status */}
          <div className="flex flex-col min-w-[100px]">
            <span className="font-semibold text-sm">{trip.trip_number || "No Trip #"}</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant={trip.revenue_currency === "USD" ? "secondary" : "outline"} className="text-xs px-1.5 py-0">
                {trip.revenue_currency || "USD"}
              </Badge>
              {isOverdue && <Badge variant="destructive" className="text-xs px-1.5 py-0">Overdue</Badge>}
            </div>
          </div>

          {/* Client */}
          <div className="flex-1 min-w-[140px] max-w-[200px]">
            <p className="text-sm font-medium truncate">{trip.client_name || "Unknown Client"}</p>
            <p className="text-xs text-muted-foreground truncate">{trip.origin} → {trip.destination}</p>
          </div>

          {/* Invoice Info (for invoiced/paid) */}
          {(trip.status === "invoiced" || trip.status === "paid") && (
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-muted-foreground">{trip.invoice_number || "N/A"}</span>
              </div>
              {trip.status === "invoiced" && dueDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className={isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                    Due: {formatDate(dueDate.toISOString())}
                  </span>
                </div>
              )}
              {trip.status === "paid" && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-muted-foreground">Paid: {formatDate(trip.payment_received_date)}</span>
                  {daysToPayment !== null && (
                    <Badge variant="outline" className="text-xs ml-1">
                      <Clock className="h-3 w-3 mr-0.5" />
                      {daysToPayment}d
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Completed Date (for ready to invoice) */}
          {trip.status === "completed" && trip.arrival_date && (
            <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Completed: {formatDate(trip.arrival_date)}</span>
            </div>
          )}
        </div>

        {/* Right: Amount & Actions */}
        <div className="flex items-center gap-4 ml-4">
          <div className="text-right min-w-[100px]">
            <p className="text-base font-bold">{formatCurrency(trip.base_revenue || 0, trip.revenue_currency || "USD")}</p>
          </div>
          <div className="flex items-center gap-2">
            {actions}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Glass Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-5 py-3.5 shadow-sm">
        <span className="text-sm font-medium text-muted-foreground">Track trips from completion to payment</span>
        <Button onClick={exportToCSV} variant="outline" size="sm" className="h-9 gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">Ready to Invoice</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{statistics.readyCount}</div>
          <div className="text-sm text-muted-foreground tabular-nums">
            {formatCurrency(statistics.readyAmount.USD)}
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Send className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Invoice Sent</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{statistics.invoicedCount}</div>
          <div className="text-sm text-muted-foreground tabular-nums">
            {formatCurrency(statistics.invoicedAmount.USD)}
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium">Payment Received</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{statistics.paidCount}</div>
          <div className="text-sm text-muted-foreground tabular-nums">
            {formatCurrency(statistics.paidAmount.USD)}
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">Overdue</span>
          </div>
          <div className="text-2xl font-bold text-destructive tabular-nums">{statistics.overdueCount}</div>
          <div className="text-sm text-muted-foreground tabular-nums">
            {formatCurrency(statistics.overdueAmount.USD)}
          </div>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-medium">Avg. Days to Payment</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{statistics.avgDaysToPayment}</div>
          <div className="text-sm text-muted-foreground">days average</div>
        </div>
      </div>

      {/* Overdue Alert */}
      {statistics.overdueCount > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-destructive">Overdue Invoices Require Attention</h4>
            <p className="text-sm text-destructive/70 mt-0.5">
              You have {statistics.overdueCount} overdue invoice{statistics.overdueCount !== 1 ? "s" : ""} totaling{" "}
              {formatCurrency(statistics.overdueAmount.USD)}
            </p>
          </div>
        </div>
      )}

      {/* Client Sections */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Loading clients...
            </div>
          </div>
        ) : clientSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Client Data</h3>
            <p className="text-sm text-muted-foreground max-w-sm">Completed trips will appear here organized by client</p>
          </div>
        ) : (
          clientSummaries.map((client) => {
            const isExpanded = expandedClients.has(client.name);
            const totalTrips = client.toInvoiceTrips.length + client.outstandingTrips.length + client.paidTrips.length;

            return (
              <Collapsible
                key={client.name}
                open={isExpanded}
                onOpenChange={() => toggleClient(client.name)}
              >
                {/* Client Header */}
                <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{client.name}</h3>
                            <Badge variant="secondary" className="text-xs">{totalTrips} trips</Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-yellow-500" />
                              <span className="text-muted-foreground">To Invoice:</span>
                              <span className="font-medium">{formatCurrency(client.toPay, client.currency)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="text-muted-foreground">Outstanding:</span>
                              <span className="font-medium">{formatCurrency(client.outstanding, client.currency)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-muted-foreground">Paid:</span>
                              <span className="font-medium">{formatCurrency(client.paid, client.currency)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportClientStatement(client.name, client);
                          }}
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Export Statement
                        </Button>
                        <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t border-border/60">
                      {/* To Invoice Section */}
                      {client.toInvoiceTrips.length > 0 && (
                        <div className="p-4 border-b border-border/60 bg-amber-500/5">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="h-4 w-4 text-amber-600" />
                            <span className="font-medium text-sm">Ready to Invoice ({client.toInvoiceTrips.length})</span>
                          </div>
                          <div className="space-y-2">
                            {client.toInvoiceTrips.map((trip) => (
                              <TripRow
                                key={trip.id}
                                trip={trip}
                                actions={
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkInvoiceSent(trip)}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Invoice
                                  </Button>
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Outstanding Section */}
                      {client.outstandingTrips.length > 0 && (
                        <div className="p-4 border-b border-border/60 bg-blue-500/5">
                          <div className="flex items-center gap-2 mb-3">
                            <Send className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-sm">Outstanding ({client.outstandingTrips.length})</span>
                          </div>
                          <div className="space-y-2">
                            {client.outstandingTrips.map((trip) => (
                              <TripRow
                                key={trip.id}
                                trip={trip}
                                actions={
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleMarkPaymentReceived(trip)}
                                  >
                                    <DollarSign className="h-4 w-4 mr-2" />
                                    Paid
                                  </Button>
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Paid Section */}
                      {client.paidTrips.length > 0 && (
                        <div className="p-4 bg-emerald-500/5">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-sm">Paid ({client.paidTrips.length})</span>
                          </div>
                          <div className="space-y-2">
                            {client.paidTrips.map((trip) => (
                              <TripRow
                                key={trip.id}
                                trip={trip}
                                actions={
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300/50">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Complete
                                  </Badge>
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state if no trips */}
                      {totalTrips === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                          No trips for this client
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })
        )}
      </div>

      {/* Mark Invoice Sent Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice Sent</DialogTitle>
            <DialogDescription>
              Enter the invoice details for trip {selectedTrip?.trip_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium">Trip Details</p>
              <p className="text-sm text-muted-foreground">
                Customer: {selectedTrip?.client_name || "Unknown"}
              </p>
              <p className="text-sm text-muted-foreground">
                Amount: {formatCurrency(selectedTrip?.base_revenue || 0, selectedTrip?.revenue_currency || "USD")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedTrip) {
                  markInvoiceSentMutation.mutate({
                    tripId: selectedTrip.id,
                    invoiceNum: invoiceNumber,
                    invDate: invoiceDate,
                  });
                }
              }}
              disabled={markInvoiceSentMutation.isPending || !invoiceNumber}
            >
              <Send className="h-4 w-4 mr-2" />
              {markInvoiceSentMutation.isPending ? "Saving..." : "Mark as Sent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Payment Received Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payment Received</DialogTitle>
            <DialogDescription>
              Record payment for invoice {selectedTrip?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">Invoice Details</p>
              <p className="text-sm text-muted-foreground">
                Invoice: {selectedTrip?.invoice_number}
              </p>
              <p className="text-sm text-muted-foreground">
                Sent: {formatDate(selectedTrip?.invoice_submitted_date)}
              </p>
              <p className="text-sm text-muted-foreground">
                Amount: {formatCurrency(selectedTrip?.base_revenue || 0, selectedTrip?.revenue_currency || "USD")}
              </p>
              {selectedTrip?.invoice_submitted_date && paymentDate && (
                <p className="text-sm font-medium text-blue-600">
                  Days to Payment: {calculateDaysBetween(selectedTrip.invoice_submitted_date, paymentDate)} days
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                if (selectedTrip) {
                  markPaymentReceivedMutation.mutate({
                    tripId: selectedTrip.id,
                    payDate: paymentDate,
                  });
                }
              }}
              disabled={markPaymentReceivedMutation.isPending}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              {markPaymentReceivedMutation.isPending ? "Saving..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoicingDashboard;