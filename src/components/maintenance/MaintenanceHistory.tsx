import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import
  {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { exportHistoryToExcel, exportHistoryToPDF } from "@/lib/maintenanceExport";
import { format } from "date-fns";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type HistoryRow = Database["public"]["Tables"]["maintenance_schedule_history"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["maintenance_schedules"]["Row"];

interface HistoryRecord extends HistoryRow {
  maintenance_schedules: Pick<ScheduleRow, "service_type" | "vehicle_id"> | null;
}

export function MaintenanceHistory() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("maintenance_schedule_history")
        .select(`
          *,
          maintenance_schedules(service_type, vehicle_id)
        `)
        .order("completed_date", { ascending: false });

      if (startDate) {
        query = query.gte("completed_date", startDate);
      }
      if (endDate) {
        query = query.lte("completed_date", endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load maintenance history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const filteredHistory = history.filter((record) =>
    record.maintenance_schedules?.service_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCost = filteredHistory.reduce((sum, record) => sum + (record.total_cost || 0), 0);
  const totalHours = filteredHistory.reduce((sum, record) => sum + (record.duration_hours || 0), 0);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-green-500",
      cancelled: "bg-gray-500",
      skipped: "bg-yellow-500",
    };
    return colors[status] || "bg-blue-500";
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredHistory.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R {totalCost.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Maintenance History</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exportHistoryToPDF(filteredHistory, 'Maintenance History Report');
                  toast.success('PDF exported successfully');
                }}
                disabled={filteredHistory.length === 0}
              >
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exportHistoryToExcel(filteredHistory, 'maintenance-history');
                  toast.success('Excel file exported successfully');
                }}
                disabled={filteredHistory.length === 0}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search by title or technician..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <DatePicker
                  id="start-date"
                  value={startDate}
                  onChange={(date) => setStartDate(date ? date.toISOString().split('T')[0] : '')}
                  placeholder="Select start date"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <DatePicker
                  id="end-date"
                  value={endDate}
                  onChange={(date) => setEndDate(date ? date.toISOString().split('T')[0] : '')}
                  placeholder="Select end date"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading history...</div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No maintenance history found</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                                    <TableHeader>
                    <TableRow>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Completed Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.maintenance_schedules?.service_type || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.completed_date), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {record.duration_hours ? `${record.duration_hours}h` : "-"}
                        </TableCell>
                        <TableCell>
                          {record.total_cost ? `R ${record.total_cost.toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(record.status)}>
                            {record.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
