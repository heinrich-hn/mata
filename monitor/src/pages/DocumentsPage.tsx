import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, CalendarDays, Clock, FileText, IdCard, RefreshCw, Truck, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Define types locally
interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  driver_number: string;
  email?: string | null;
  phone?: string | null;
}

// Combined alert type that can come from either source
interface CombinedAlert {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'acknowledged' | 'resolved' | 'pending';
  source: 'db' | 'local';
  entityType: 'vehicle' | 'driver';
  metadata: {
    entity_type?: 'vehicle' | 'driver';
    driver_id?: string;
    driver_name?: string;
    driver_number?: string;
    vehicle_id?: string;
    registration?: string;
    registration_number?: string;
    fleet_number?: string | null;
    make?: string;
    model?: string;
    document_type?: string | null;
    document_number?: string;
    expiry_date?: string;
    days_until_expiry?: number;
    [key: string]: unknown;
  };
  triggered_at: string;
}

type EntityType = 'vehicle' | 'driver';

export default function DocumentsPage() {
  const [entityFilter, setEntityFilter] = useState<EntityType>('vehicle');
  const [allDriverAlerts, setAllDriverAlerts] = useState<CombinedAlert[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // Fetch drivers
  useEffect(() => {
    const fetchDrivers = async () => {
      const { data } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, driver_number, email, phone')
        .eq('status', 'active');

      if (data) {
        setDrivers(data);
      }
    };

    fetchDrivers();
  }, []);

  // Fetch all drivers and their document alerts
  useEffect(() => {
    const fetchAllDriverAlerts = async () => {
      const alerts: CombinedAlert[] = [];

      for (const driver of drivers) {
        const { data: documents } = await supabase
          .from('driver_documents')
          .select('*')
          .eq('driver_id', driver.id);

        if (documents) {
          documents.forEach(doc => {
            if (!doc.expiry_date) return;

            const expiryDate = new Date(doc.expiry_date);
            const today = new Date();
            const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';

            if (expiryDate < today) {
              severity = 'critical';
            } else if (daysUntil <= 7) {
              severity = 'high';
            } else if (daysUntil <= 14) {
              severity = 'medium';
            } else if (daysUntil <= 30) {
              severity = 'low';
            } else {
              return; // Skip if more than 30 days away
            }

            const docType = doc.document_type.replace(/_/g, ' ');
            const driverName = `${driver.first_name} ${driver.last_name}`.trim();

            alerts.push({
              id: `driver-${doc.id}`,
              title: expiryDate < today
                ? `Driver Document Expired: ${docType}`
                : `Driver Document Expiring Soon: ${docType}`,
              message: expiryDate < today
                ? `${driverName}'s ${docType} expired on ${format(new Date(doc.expiry_date), 'dd MMM yyyy')}.`
                : `${driverName}'s ${docType} expires in ${daysUntil} days.`,
              severity,
              status: 'active',
              source: 'local',
              entityType: 'driver',
              metadata: {
                entity_type: 'driver',
                driver_id: driver.id,
                driver_name: driverName,
                driver_number: driver.driver_number,
                document_type: doc.document_type,
                document_number: doc.document_number,
                expiry_date: doc.expiry_date,
                days_until_expiry: daysUntil,
              },
              triggered_at: new Date().toISOString(),
            });
          });
        }
      }

      setAllDriverAlerts(alerts);
    };

    if (drivers.length > 0) {
      fetchAllDriverAlerts();
    }
  }, [drivers]);

  // Fetch vehicle documents directly from source (vehicles with work_documents)
  const { data: vehiclesWithDocs = [], isLoading: isLoadingDb, refetch, isRefetching } = useQuery({
    queryKey: ['vehicle-documents-expiry'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          id,
          registration_number,
          fleet_number,
          make,
          model,
          work_documents (
            id,
            document_type,
            document_number,
            title,
            metadata
          )
        `);

      if (error) {
        console.error('Error fetching vehicle documents:', error);
        throw error;
      }

      // Filter to only vehicles with documents that have expiry dates
      const vehiclesWithExpirableDocs = (data || []).filter((vehicle: { work_documents: { metadata?: { expiry_date?: string } }[] }) =>
        vehicle.work_documents?.some((doc: { metadata?: { expiry_date?: string } }) => doc.metadata?.expiry_date)
      );

      console.log('Fetched vehicles with expirable documents:', vehiclesWithExpirableDocs.length);
      return vehiclesWithExpirableDocs as {
        id: string;
        registration_number: string;
        fleet_number: string | null;
        make: string;
        model: string;
        work_documents: {
          id: string;
          document_type: string | null;
          document_number: string;
          title: string;
          metadata: { expiry_date?: string;[key: string]: unknown } | null;
        }[];
      }[];
    },
    refetchInterval: 30000,
  });

  // Convert vehicle documents to alert format
  const today = new Date();
  const convertedVehicleAlerts: CombinedAlert[] = vehiclesWithDocs.flatMap(vehicle => {
    return (vehicle.work_documents || [])
      .filter(doc => doc.metadata?.expiry_date)
      .map(doc => {
        const expiryDate = new Date(doc.metadata!.expiry_date!);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = expiryDate < today;

        return {
          id: doc.id,
          title: `${doc.document_type?.toUpperCase() || 'Document'} ${isOverdue ? 'Expired' : 'Expiring Soon'}`,
          message: `${doc.title || doc.document_number} ${isOverdue ? 'expired on' : 'expires on'} ${expiryDate.toLocaleDateString('en-GB')}`,
          severity: (isOverdue ? 'critical' : daysUntilExpiry <= 7 ? 'high' : 'medium') as 'critical' | 'high' | 'medium' | 'low' | 'info',
          status: 'active' as const,
          source: 'db' as const,
          entityType: 'vehicle' as const,
          metadata: {
            entity_type: 'vehicle' as const,
            vehicle_id: vehicle.id,
            registration_number: vehicle.registration_number,
            fleet_number: vehicle.fleet_number,
            make: vehicle.make,
            model: vehicle.model,
            document_id: doc.id,
            document_type: doc.document_type,
            document_number: doc.document_number,
            expiry_date: doc.metadata!.expiry_date,
            status: isOverdue ? 'overdue' : 'soon',
            issue_type: 'document_expiry',
            days_until_expiry: daysUntilExpiry,
          },
          triggered_at: new Date().toISOString(),
        };
      });
  });

  // Combine and filter alerts
  const combinedAlerts: CombinedAlert[] = [
    ...convertedVehicleAlerts,
    ...allDriverAlerts,
  ].filter(alert => {
    // Apply entity filter only
    return alert.entityType === entityFilter;
  }).sort((a, b) => {
    // Sort by severity first, then by date
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const severityDiff = (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5);
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
  });

  const stats = {
    total: combinedAlerts.length,
    expired: combinedAlerts.filter(a => {
      return a.metadata?.expiry_date && new Date(a.metadata.expiry_date) < new Date();
    }).length,
    expiringSoon: combinedAlerts.filter(a => {
      if (!a.metadata?.expiry_date) return false;
      const expDate = new Date(a.metadata.expiry_date);
      const today = new Date();
      const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return expDate > today && daysUntil <= 30;
    }).length,
    vehicle: combinedAlerts.filter(a => a.entityType === 'vehicle').length,
    driver: combinedAlerts.filter(a => a.entityType === 'driver').length,
  };

  const getStatusBadge = (expiryDate: string) => {
    const isOverdue = new Date(expiryDate) < new Date();
    if (isOverdue) {
      return <Badge variant="destructive">OVERDUE</Badge>;
    }
    return <Badge variant="warning" className="bg-amber-500/10 text-amber-500 border-amber-500/20">EXPIRING SOON</Badge>;
  };

  const getEntityIcon = (entityType?: string) => {
    switch (entityType) {
      case 'driver':
        return <User className="h-4 w-4" />;
      case 'vehicle':
        return <Truck className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getEntityColor = (entityType?: string) => {
    switch (entityType) {
      case 'driver':
        return 'bg-blue-500/10 text-blue-500';
      case 'vehicle':
        return 'bg-emerald-500/10 text-emerald-500';
      default:
        return 'bg-slate-500/10 text-slate-500';
    }
  };

  const formatDocumentType = (type: string | null | undefined) => {
    if (!type) return 'Document';
    return type.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const isLoading = isLoadingDb || (drivers.length === 0 && allDriverAlerts.length === 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading document alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Document Expiry Alerts</h1>
            <p className="text-sm text-muted-foreground">
              Track expired and expiring documents for vehicles and drivers
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetch();
            // Refresh driver alerts by re-fetching drivers
            window.location.reload();
          }}
          disabled={isRefetching}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.vehicle} vehicle · {stats.driver} driver
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.expired}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires immediate action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{stats.expiringSoon}</div>
            <p className="text-xs text-muted-foreground mt-1">Within 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vehicle Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{stats.vehicle}</div>
            <p className="text-xs text-muted-foreground mt-1">Active alerts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Driver Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.driver}</div>
            <p className="text-xs text-muted-foreground mt-1">Active alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Tabs value={entityFilter} onValueChange={(v) => setEntityFilter(v as EntityType)} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="vehicle" className="gap-2 flex-1 sm:flex-none">
            <Truck className="h-4 w-4" />
            Vehicles
          </TabsTrigger>
          <TabsTrigger value="driver" className="gap-2 flex-1 sm:flex-none">
            <User className="h-4 w-4" />
            Drivers
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Alerts List */}
      {combinedAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No document alerts</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                All {entityFilter} documents are up to date. No expiry alerts to display.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {combinedAlerts.map((alert) => {
            const metadata = alert.metadata;
            const isOverdue = metadata.expiry_date && new Date(metadata.expiry_date) < new Date();
            const entityType = alert.entityType;
            const entityColor = getEntityColor(entityType);

            return (
              <Link
                key={alert.id}
                to={alert.source === 'db' ? `/alerts/${alert.id}` : '#'}
                className="block"
                onClick={(e) => {
                  if (alert.source === 'local') {
                    e.preventDefault();
                    if (metadata.driver_id) {
                      window.location.href = `/drivers/${metadata.driver_id}`;
                    }
                  }
                }}
              >
                <Card className={cn(
                  "hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4",
                  isOverdue ? 'border-l-red-500' : 'border-l-amber-500',
                  "hover:border-l-4"
                )}>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isOverdue ? 'bg-red-500/10' : 'bg-amber-500/10'
                          )}>
                            {isOverdue ?
                              <AlertTriangle className="h-5 w-5 text-red-500" /> :
                              <Clock className="h-5 w-5 text-amber-500" />
                            }
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-base">{alert.title}</h3>
                              {metadata.expiry_date && getStatusBadge(metadata.expiry_date)}
                            </div>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn("gap-1.5", entityColor)}>
                          {getEntityIcon(entityType)}
                          {entityType === 'driver' ? 'Driver Document' : 'Vehicle Document'}
                          {alert.source === 'local' && (
                            <span className="ml-1 text-xs opacity-70">(local)</span>
                          )}
                        </Badge>
                      </div>

                      {/* Document Details */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                        {entityType === 'driver' ? (
                          // Driver details
                          <>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Driver</p>
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {metadata.driver_name || 'Unknown'}
                              </p>
                              {metadata.driver_number && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  ID: {metadata.driver_number}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Document Type</p>
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                <IdCard className="h-4 w-4 text-muted-foreground" />
                                {formatDocumentType(metadata.document_type)}
                              </p>
                            </div>
                          </>
                        ) : (
                          // Vehicle details
                          <>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Vehicle</p>
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                {metadata.registration || metadata.fleet_number || 'Unknown'}
                              </p>
                              {(metadata.make || metadata.model) && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {metadata.make} {metadata.model}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Document Type</p>
                              <p className="text-sm font-medium">
                                {formatDocumentType(metadata.document_type)}
                              </p>
                            </div>
                          </>
                        )}

                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Document Number</p>
                          <p className="text-sm font-medium font-mono">
                            {metadata.document_number || 'N/A'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Expiry Date</p>
                          <p className={cn(
                            "text-sm font-medium flex items-center gap-1.5",
                            isOverdue ? "text-red-500" : "text-amber-500"
                          )}>
                            <CalendarDays className="h-4 w-4" />
                            {metadata.expiry_date
                              ? format(new Date(metadata.expiry_date), 'dd MMM yyyy')
                              : 'N/A'
                            }
                          </p>
                          {metadata.expiry_date && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isOverdue
                                ? `Overdue by ${Math.abs(Math.ceil((new Date(metadata.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} days`
                                : `${Math.ceil((new Date(metadata.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining`
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Status Footer */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn(
                            "capitalize",
                            alert.status === 'active' && "border-red-200 bg-red-50 text-red-700",
                            alert.status === 'acknowledged' && "border-amber-200 bg-amber-50 text-amber-700",
                            alert.status === 'resolved' && "border-emerald-200 bg-emerald-50 text-emerald-700",
                            alert.status === 'pending' && "border-blue-200 bg-blue-50 text-blue-700"
                          )}>
                            {alert.status}
                          </Badge>
                          <span>Severity: <span className="font-medium capitalize">{alert.severity}</span></span>
                        </div>
                        <span>
                          {alert.source === 'db' ? 'Triggered: ' : 'Updated: '}
                          {format(new Date(alert.triggered_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}