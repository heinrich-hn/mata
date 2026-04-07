import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  User,
  Fuel,
  MapPin,
  Gauge,
  FileDown,
  Share2,
} from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  generateDebriefPDF,
  generateDriverDebriefPDF,
  buildDebriefWhatsAppMessage,
  buildDriverWhatsAppMessage,
  openWhatsApp,
} from "@/lib/debriefExport";
import { ExportMenu } from "@/components/ExportMenu";
import { exportDieselDebriefs } from "@/lib/monitorExport";

interface PendingRecord {
  id: string;
  fleet_number: string;
  driver_name: string;
  date: string;
  fuel_station: string | null;
  litres_filled: number | null;
  total_cost: number | null;
  currency: string | null;
  km_per_litre: number | null;
  distance_travelled: number | null;
  expected_km_per_litre: number | null;
}

export default function DieselAlertsPage() {
  const queryClient = useQueryClient();
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());

  const { data: records = [], isLoading, refetch, isRefetching } = useQuery<PendingRecord[]>({
    queryKey: ["pending-debriefs"],
    queryFn: async () => {
      const [recordsRes, normsRes] = await Promise.all([
        supabase
          .from("diesel_records")
          .select("id, fleet_number, driver_name, date, fuel_station, litres_filled, total_cost, currency, km_per_litre, distance_travelled")
          .eq("requires_debrief", true)
          .eq("debrief_signed", false)
          .not("fleet_number", "is", null)
          .not("fleet_number", "eq", "")
          .not("driver_name", "is", null)
          .not("driver_name", "eq", "")
          .order("date", { ascending: false }),
        supabase
          .from("diesel_norms")
          .select("fleet_number, expected_km_per_litre"),
      ]);

      if (recordsRes.error) throw recordsRes.error;

      const normMap = new Map(
        (normsRes.data || []).map(n => [n.fleet_number, n.expected_km_per_litre])
      );

      return (recordsRes.data || []).map(record => ({
        id: record.id,
        fleet_number: record.fleet_number,
        driver_name: record.driver_name,
        date: record.date,
        fuel_station: record.fuel_station,
        litres_filled: record.litres_filled,
        total_cost: record.total_cost,
        currency: record.currency,
        km_per_litre: record.km_per_litre,
        distance_travelled: record.distance_travelled,
        expected_km_per_litre: normMap.get(record.fleet_number) ?? null,
      }));
    },
    refetchInterval: 30000,
  });

  // Group records by driver name
  const groupedByDriver = useMemo(() => {
    const map = new Map<string, PendingRecord[]>();
    for (const record of records) {
      const existing = map.get(record.driver_name) || [];
      existing.push(record);
      map.set(record.driver_name, existing);
    }
    // Sort drivers alphabetically
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [records]);

  const toggleDriver = (driverName: string) => {
    setExpandedDrivers(prev => {
      const next = new Set(prev);
      if (next.has(driverName)) {
        next.delete(driverName);
      } else {
        next.add(driverName);
      }
      return next;
    });
  };

  // Set up realtime subscription
  useEffect(() => {
    const subscription = supabase
      .channel('diesel-records-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'diesel_records',
          filter: 'debrief_signed=eq.true',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pending-debriefs"] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading pending debriefs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="monitor-page-wide w-full">
        {/* Stats and Actions Bar */}
        <div className="flex-shrink-0 px-6 py-4 border border-slate-200/90 rounded-xl bg-gradient-to-r from-cyan-50/70 via-white to-blue-50/65 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm text-slate-500">
                  {records.length} transaction{records.length !== 1 ? 's' : ''} across {groupedByDriver.length} driver{groupedByDriver.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {records.length > 0 && (
                <>
                  <ExportMenu
                    disabled={records.length === 0}
                    onExport={(target) => exportDieselDebriefs(records, target)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateDebriefPDF(groupedByDriver)}
                    className="border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Debrief PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openWhatsApp(buildDebriefWhatsAppMessage(groupedByDriver))}
                    className="border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Driver list */}
        <div className="flex-1 min-h-0 px-6 py-4 space-y-2 monitor-soft-panel rounded-xl">
          {records.length === 0 ? (
            <div className="flex items-center justify-center h-64 border border-slate-200 rounded-lg bg-slate-50/50">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-2">All Caught Up</h3>
                <p className="text-sm text-slate-500">
                  No pending debriefs at this time
                </p>
              </div>
            </div>
          ) : (
            groupedByDriver.map(([driverName, driverRecords]) => {
              const isExpanded = expandedDrivers.has(driverName);
              return (
                <Card key={driverName} className="border-slate-200">
                  <button
                    className="w-full text-left"
                    onClick={() => toggleDriver(driverName)}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-slate-500" />
                        </div>
                        <span className="font-medium text-slate-900">{driverName}</span>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600">{driverRecords.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-slate-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                generateDriverDebriefPDF(driverName, driverRecords);
                              }}
                              title="Export PDF"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-slate-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                openWhatsApp(buildDriverWhatsAppMessage(driverName, driverRecords));
                              }}
                              title="Share via WhatsApp"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-slate-400" />
                          : <ChevronRight className="h-4 w-4 text-slate-400" />
                        }
                      </div>
                    </CardContent>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 divide-y divide-slate-100">
                      {driverRecords.map((record) => (
                        <div
                          key={record.id}
                          className="px-4 py-3 bg-slate-50/30"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-sm text-slate-900">{record.fleet_number}</span>
                              <span className="text-sm text-slate-500">
                                {format(new Date(record.date), "dd MMM yyyy")}
                              </span>
                            </div>
                            {record.km_per_litre != null && record.expected_km_per_litre != null && (
                              <span className="text-xs font-medium">
                                <span className="text-slate-700">
                                  {record.km_per_litre.toFixed(2)}
                                </span>
                                <span className="text-slate-400 mx-1">/</span>
                                <span className="text-slate-500">{record.expected_km_per_litre.toFixed(2)} km/L</span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                            {record.fuel_station && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {record.fuel_station}
                              </span>
                            )}
                            {record.litres_filled != null && (
                              <span className="flex items-center gap-1">
                                <Fuel className="h-3 w-3" />
                                {record.litres_filled.toFixed(1)} L
                              </span>
                            )}
                            {record.total_cost != null && (
                              <span>
                                {(record.currency || "ZAR")} {record.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                            {record.distance_travelled != null && (
                              <span>{record.distance_travelled.toFixed(0)} km</span>
                            )}
                            {record.km_per_litre != null && record.expected_km_per_litre == null && (
                              <span className="flex items-center gap-1">
                                <Gauge className="h-3 w-3" />
                                {record.km_per_litre.toFixed(2)} km/L
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}