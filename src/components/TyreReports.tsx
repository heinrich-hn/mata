import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useState } from "react";
import { 
  FileText, 
  Download, 
  CalendarIcon, 
  TrendingUp, 
  DollarSign, 
  Package, 
  ClipboardCheck,
  BarChart3,
  Shield,
  Clock,
  HardDrive,
  RefreshCw,
  ChevronDown,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

// Report type definitions with icons and descriptions
const reportTypes = [
  { 
    value: "performance", 
    label: "Performance Report", 
    icon: TrendingUp,
    description: "Tyre wear rates, lifespan analysis, and performance metrics",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/50"
  },
  { 
    value: "cost-analysis", 
    label: "Cost Analysis", 
    icon: DollarSign,
    description: "Total cost of ownership, cost per km, and expense breakdown",
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/50"
  },
  { 
    value: "inventory-summary", 
    label: "Inventory Summary", 
    icon: Package,
    description: "Stock levels, reorder points, and inventory valuation",
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/50"
  },
  { 
    value: "inspection-history", 
    label: "Inspection History", 
    icon: ClipboardCheck,
    description: "Historical inspection data and compliance records",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/50"
  },
  { 
    value: "sales-report", 
    label: "Sales Report", 
    icon: BarChart3,
    description: "Sales transactions, revenue, and profit margins",
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/50"
  },
  { 
    value: "warranty-claims", 
    label: "Warranty Claims", 
    icon: Shield,
    description: "Warranty status, claims history, and recovery rates",
    color: "text-rose-500",
    bgColor: "bg-rose-50 dark:bg-rose-950/50"
  },
];

// Recent reports with enhanced metadata
const recentReports = [
  {
    id: "1",
    name: "Monthly Performance Report - May 2025",
    type: "performance",
    typeLabel: "Performance",
    date: "2025-05-31",
    time: "14:30",
    size: "2.4 MB",
    format: "PDF",
    status: "completed",
    downloads: 12,
  },
  {
    id: "2",
    name: "Q2 Cost Analysis",
    type: "cost-analysis",
    typeLabel: "Cost Analysis",
    date: "2025-06-15",
    time: "09:15",
    size: "1.8 MB",
    format: "Excel",
    status: "completed",
    downloads: 8,
  },
  {
    id: "3",
    name: "Inventory Summary - June",
    type: "inventory-summary",
    typeLabel: "Inventory",
    date: "2025-06-30",
    time: "11:45",
    size: "1.2 MB",
    format: "PDF",
    status: "completed",
    downloads: 5,
  },
  {
    id: "4",
    name: "Warranty Claims - Q2 2025",
    type: "warranty-claims",
    typeLabel: "Warranty",
    date: "2025-07-01",
    time: "16:20",
    size: "0.8 MB",
    format: "PDF",
    status: "processing",
    downloads: 0,
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Completed</Badge>;
    case "processing":
      return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white">Processing</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const TyreReports = () => {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [reportType, setReportType] = useState("performance");
  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Please select date range", {
        description: "Both from and to dates are required to generate a report",
      });
      return;
    }

    if (dateFrom > dateTo) {
      toast.error("Invalid date range", {
        description: "From date cannot be after to date",
      });
      return;
    }

    setIsGenerating(true);
    
    // Simulate report generation
    setTimeout(() => {
      setIsGenerating(false);
      toast.success("Report generated successfully", {
        description: `Your ${reportTypes.find(r => r.value === reportType)?.label} is ready for download`,
        duration: 5000,
      });
    }, 2000);
  };

  const handleDownload = (reportName: string, format: string) => {
    toast.success(`Downloading ${reportName}`, {
      description: `File format: ${format}`,
      duration: 3000,
    });
  };

  const filteredReports = recentReports.filter(report => 
    report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.typeLabel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tyre Reports</h2>
          <p className="text-muted-foreground">
            Generate comprehensive reports and analyze your tyre data
          </p>
        </div>
        <Badge variant="outline" className="w-fit px-3 py-1">
          <Clock className="w-3 h-3 mr-2" />
          Last updated: {format(new Date(), "MMM d, yyyy HH:mm")}
        </Badge>
      </div>

      {/* Generate Report Card */}
      <Card className="overflow-hidden border-0 shadow-lg relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Generate New Report
          </CardTitle>
          <CardDescription>
            Customize your report parameters and select a date range
          </CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-6">
          {/* Report Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reportTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = reportType === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => setReportType(type.value)}
                  className={cn(
                    "relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                    isSelected 
                      ? "border-primary bg-primary/5 shadow-md scale-[1.02]" 
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  )}
                >
                  <div className={cn("p-2 rounded-lg", type.bgColor)}>
                    <Icon className={cn("w-4 h-4", type.color)} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {type.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          <Separator />

          {/* Date Range Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    disabled={(date) => date > new Date() || (dateFrom ? date < dateFrom : false)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Quick Date Range Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setMonth(start.getMonth() - 1);
                setDateFrom(start);
                setDateTo(end);
              }}
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setMonth(start.getMonth() - 3);
                setDateFrom(start);
                setDateTo(end);
              }}
            >
              Last Quarter
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setMonth(start.getMonth() - 12);
                setDateFrom(start);
                setDateTo(end);
              }}
            >
              Last Year
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom(undefined);
                setDateTo(undefined);
              }}
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              Clear
            </Button>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerateReport} 
            className="w-full h-12 text-base font-medium"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Generate {reportTypes.find(r => r.value === reportType)?.label}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Reports Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary" />
                Recent Reports
              </CardTitle>
              <CardDescription>
                Previously generated reports and downloads
              </CardDescription>
            </div>
            
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {filteredReports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No reports found</p>
                </div>
              ) : (
                filteredReports.map((report) => {
                  const reportTypeConfig = reportTypes.find(t => t.value === report.type);
                  const Icon = reportTypeConfig?.icon || FileText;
                  
                  return (
                    <div
                      key={report.id}
                      className="group relative flex items-center gap-4 p-4 border rounded-xl hover:shadow-md transition-all duration-200 hover:border-primary/50"
                    >
                      {/* Icon */}
                      <div className={cn(
                        "p-3 rounded-xl hidden sm:block",
                        reportTypeConfig?.bgColor || "bg-muted"
                      )}>
                        <Icon className={cn("w-5 h-5", reportTypeConfig?.color || "text-muted-foreground")} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{report.name}</p>
                          {getStatusBadge(report.status)}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {format(new Date(report.date), "MMM d, yyyy")} at {report.time}
                          </span>
                          <span>•</span>
                          <span>{report.format}</span>
                          <span>•</span>
                          <span>{report.size}</span>
                          <span>•</span>
                          <span>{report.downloads} downloads</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDownload(report.name, report.format)}
                          disabled={report.status === "processing"}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Footer Stats */}
          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{recentReports.length}</p>
                <p className="text-xs text-muted-foreground">Total Reports</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {recentReports.reduce((acc, r) => acc + r.downloads, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Downloads</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {recentReports.filter(r => r.status === "completed").length}
                </p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {recentReports.reduce((acc, r) => {
                    const size = parseFloat(r.size);
                    return acc + (isNaN(size) ? 0 : size);
                  }, 0).toFixed(1)} MB
                </p>
                <p className="text-xs text-muted-foreground">Total Size</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TyreReports;