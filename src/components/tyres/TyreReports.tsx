import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useState, useMemo } from "react";
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
  Search,
  AlertCircle,
  CheckCircle2,
  PieChart,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ReportType {
  value: string;
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
  bgColor: string;
  recommendedFrequency?: string;
  averageGenerationTime?: string;
}

interface RecentReport {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  date: string;
  time: string;
  size: string;
  sizeBytes: number;
  format: string;
  status: "completed" | "processing" | "failed";
  downloads: number;
  lastAccessed?: string;
  isFavorite?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const reportTypes: ReportType[] = [
  { 
    value: "performance", 
    label: "Performance Report", 
    icon: TrendingUp,
    description: "Tyre wear rates, lifespan analysis, and performance metrics",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    recommendedFrequency: "Monthly",
    averageGenerationTime: "~30 seconds"
  },
  { 
    value: "cost-analysis", 
    label: "Cost Analysis", 
    icon: DollarSign,
    description: "Total cost of ownership, cost per km, and expense breakdown",
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/50",
    recommendedFrequency: "Quarterly",
    averageGenerationTime: "~45 seconds"
  },
  { 
    value: "inventory-summary", 
    label: "Inventory Summary", 
    icon: Package,
    description: "Stock levels, reorder points, and inventory valuation",
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/50",
    recommendedFrequency: "Weekly",
    averageGenerationTime: "~20 seconds"
  },
  { 
    value: "inspection-history", 
    label: "Inspection History", 
    icon: ClipboardCheck,
    description: "Historical inspection data and compliance records",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/50",
    recommendedFrequency: "Monthly",
    averageGenerationTime: "~35 seconds"
  },
  { 
    value: "sales-report", 
    label: "Sales Report", 
    icon: BarChart3,
    description: "Sales transactions, revenue, and profit margins",
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/50",
    recommendedFrequency: "Monthly",
    averageGenerationTime: "~25 seconds"
  },
  { 
    value: "warranty-claims", 
    label: "Warranty Claims", 
    icon: Shield,
    description: "Warranty status, claims history, and recovery rates",
    color: "text-rose-500",
    bgColor: "bg-rose-50 dark:bg-rose-950/50",
    recommendedFrequency: "Quarterly",
    averageGenerationTime: "~40 seconds"
  },
];

const recentReports: RecentReport[] = [
  {
    id: "1",
    name: "Monthly Performance Report - May 2025",
    type: "performance",
    typeLabel: "Performance",
    date: "2025-05-31",
    time: "14:30",
    size: "2.4 MB",
    sizeBytes: 2.4 * 1024 * 1024,
    format: "PDF",
    status: "completed",
    downloads: 12,
    lastAccessed: "2025-06-01T10:30:00",
    isFavorite: true,
  },
  {
    id: "2",
    name: "Q2 Cost Analysis",
    type: "cost-analysis",
    typeLabel: "Cost Analysis",
    date: "2025-06-15",
    time: "09:15",
    size: "1.8 MB",
    sizeBytes: 1.8 * 1024 * 1024,
    format: "Excel",
    status: "completed",
    downloads: 8,
    lastAccessed: "2025-06-20T14:15:00",
    isFavorite: false,
  },
  {
    id: "3",
    name: "Inventory Summary - June",
    type: "inventory-summary",
    typeLabel: "Inventory",
    date: "2025-06-30",
    time: "11:45",
    size: "1.2 MB",
    sizeBytes: 1.2 * 1024 * 1024,
    format: "PDF",
    status: "completed",
    downloads: 5,
    lastAccessed: "2025-07-01T09:00:00",
    isFavorite: true,
  },
  {
    id: "4",
    name: "Warranty Claims - Q2 2025",
    type: "warranty-claims",
    typeLabel: "Warranty",
    date: "2025-07-01",
    time: "16:20",
    size: "0.8 MB",
    sizeBytes: 0.8 * 1024 * 1024,
    format: "PDF",
    status: "processing",
    downloads: 0,
    lastAccessed: null,
    isFavorite: false,
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

const getStatusBadge = (status: RecentReport["status"]) => {
  switch (status) {
    case "completed":
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Processing
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return format(date, 'MMM d, yyyy');
};

// ============================================================================
// Main Component
// ============================================================================

const TyreReports = () => {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [reportType, setReportType] = useState("performance");
  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const selectedReportType = reportTypes.find(r => r.value === reportType);

  // Filter recent reports
  const filteredReports = useMemo(() => {
    return recentReports.filter(report => 
      report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.typeLabel.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const completedReports = recentReports.filter(r => r.status === "completed");
    const totalDownloads = recentReports.reduce((acc, r) => acc + r.downloads, 0);
    const totalSize = recentReports.reduce((acc, r) => acc + r.sizeBytes, 0);
    const favoriteCount = recentReports.filter(r => r.isFavorite).length;
    
    return {
      totalReports: recentReports.length,
      completedReports: completedReports.length,
      totalDownloads,
      totalSize,
      favoriteCount,
      averageDownloads: recentReports.length > 0 
        ? Math.round(totalDownloads / recentReports.length) 
        : 0,
    };
  }, []);

  const handleGenerateReport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Date range required", {
        description: "Please select both start and end dates for the report",
        duration: 4000,
      });
      return;
    }

    if (dateFrom > dateTo) {
      toast.error("Invalid date range", {
        description: "Start date cannot be after end date",
        duration: 4000,
      });
      return;
    }

    const dateRangeDiff = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
    if (dateRangeDiff > 365) {
      toast.warning("Large date range selected", {
        description: "Reports with over 365 days may take longer to generate",
        duration: 5000,
      });
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    
    // Simulate progressive report generation
    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      setIsGenerating(false);
      setGenerationProgress(100);
      
      toast.success("Report generated successfully", {
        description: `${selectedReportType?.label} is ready for download. Generated for ${format(dateFrom, "MMM d")} - ${format(dateTo, "MMM d, yyyy")}`,
        duration: 5000,
        icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
      });
      
      // Reset progress after a delay
      setTimeout(() => setGenerationProgress(0), 3000);
    }, 2000);
  };

  const handleDownload = (report: RecentReport) => {
    if (report.status === "processing") {
      toast.info("Report still processing", {
        description: "Please wait for the report to finish generating",
        duration: 3000,
      });
      return;
    }
    
    if (report.status === "failed") {
      toast.error("Download failed", {
        description: "The report generation failed. Please try generating it again.",
        duration: 4000,
      });
      return;
    }
    
    toast.success(`Downloading ${report.name}`, {
      description: `Format: ${report.format} • Size: ${report.size}`,
      duration: 3000,
      icon: <Download className="w-4 h-4" />,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Tyre Reports
          </h2>
          <p className="text-muted-foreground mt-1">
            Generate comprehensive reports and analyze your tyre data with advanced insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 gap-2">
            <Clock className="w-3 h-3" />
            Last updated: {format(new Date(), "MMM d, yyyy HH:mm")}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 gap-2 bg-primary/5">
            <PieChart className="w-3 h-3" />
            {summaryStats.totalReports} total reports
          </Badge>
        </div>
      </div>

      {/* Generate Report Card */}
      <Card className="overflow-hidden border-0 shadow-lg relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Generate New Report
          </CardTitle>
          <CardDescription>
            Customize your report parameters and select a date range for analysis
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
                    "relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left group",
                    isSelected 
                      ? "border-primary bg-primary/5 shadow-md scale-[1.02]" 
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  )}
                >
                  <div className={cn("p-2 rounded-lg transition-colors", type.bgColor)}>
                    <Icon className={cn("w-4 h-4", type.color)} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {type.description}
                    </p>
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground/70">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {type.recommendedFrequency}
                      </span>
                      <span>•</span>
                      <span>{type.averageGenerationTime}</span>
                    </div>
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
              <Label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                From Date
              </Label>
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
              <Label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                To Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 h-4" />
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
                start.setDate(start.getDate() - 30);
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
                start.setFullYear(start.getFullYear() - 1);
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

          {/* Generation Progress */}
          {isGenerating && generationProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Generating report...</span>
                <span className="font-medium">{generationProgress}%</span>
              </div>
              <Progress value={generationProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                This may take a few moments depending on the date range
              </p>
            </div>
          )}

          {/* Generate Button */}
          <Button 
            onClick={handleGenerateReport} 
            className="w-full h-12 text-base font-medium"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating {selectedReportType?.label}...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Generate {selectedReportType?.label}
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
                Previously generated reports and download history
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Try adjusting your search or generate a new report
                  </p>
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
                      {/* Favorite Star */}
                      {report.isFavorite && (
                        <div className="absolute top-2 right-2">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        </div>
                      )}

                      {/* Icon */}
                      <div className={cn(
                        "p-3 rounded-xl hidden sm:block",
                        reportTypeConfig?.bgColor || "bg-muted"
                      )}>
                        <Icon className={cn("w-5 h-5", reportTypeConfig?.color || "text-muted-foreground")} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                          <span>{report.downloads} download{report.downloads !== 1 ? 's' : ''}</span>
                          {report.lastAccessed && (
                            <>
                              <span>•</span>
                              <span>Last accessed: {formatRelativeTime(report.lastAccessed)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDownload(report)}
                          disabled={report.status !== "completed"}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <ChevronDown className="h-4 h-4" />
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
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{summaryStats.totalReports}</p>
                <p className="text-xs text-muted-foreground">Total Reports</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{summaryStats.completedReports}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{summaryStats.totalDownloads}</p>
                <p className="text-xs text-muted-foreground">Downloads</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{summaryStats.averageDownloads}</p>
                <p className="text-xs text-muted-foreground">Avg Downloads</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{summaryStats.favoriteCount}</p>
                <p className="text-xs text-muted-foreground">Favorites</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{formatFileSize(summaryStats.totalSize)}</p>
                <p className="text-xs text-muted-foreground">Total Storage</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips Section */}
      <Alert className="bg-primary/5 border-primary/20">
        <AlertCircle className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <span className="font-medium">💡 Pro Tip:</span> Schedule regular reports to track performance trends. 
          Performance reports are recommended monthly for optimal fleet management.
        </AlertDescription>
      </Alert>
    </div>
  );
};

// Missing Star component import
const Star = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    fill="currentColor" 
    viewBox="0 0 20 20" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

export default TyreReports;