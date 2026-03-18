"use client";

import { MobileShell } from "@/components/layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VehicleSelect } from "@/components/ui/vehicle-select";
import { useAuth } from "@/contexts/auth-context";
import { useDriverDocuments } from "@/hooks/use-driver-documents";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import
  {
    Bell,
    Car,
    ChevronRight,
    FileText,
    Fuel,
    HelpCircle,
    Loader2,
    LogOut,
    Mail,
    Phone,
    Settings,
    Shield,
    Smartphone,
    Truck,
    User
  } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";


interface Vehicle {
  id: string;
  fleet_number: string;
  registration?: string;
  registration_number?: string; // Database column name
  vehicle_type?: string | null;
  make?: string | null;
  model?: string | null;
  active?: boolean | null;
  tonnage?: number | null;
  current_driver_id?: string | null;
  [key: string]: unknown; // Allow additional columns from select("*")
}

interface DriverAssignment {
  id: string;
  driver_id: string;
  vehicle_id: string;
  assigned_at: string;
  is_active: boolean;
  unassigned_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  vehicles?: Vehicle | null;
}

interface Driver {
  id: string;
  driver_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  license_number?: string | null;
}

interface VehicleOption {
  value: string;
  label: string;
  sublabel: string;
  details: {
    fleetNumber: string | null;
    registration: string | null;
    type: string | null;
    make?: string | null;
    model?: string | null;
    reefer?: string | null;
  };
}

export default function ProfilePage() {
  const { user, profile, signOut: _signOut } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Find driver by matching email - handles multiple rows gracefully
  const { data: driver, isLoading: _driverLoading } = useQuery<Driver | null>({
    queryKey: ["driver-by-email", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;

      try {
        // First check if ANY driver exists with this email (regardless of status)
        const { data: _allDrivers, error: checkError } = await supabase
          .from("drivers")
          .select("id, email, status, first_name, last_name")
          .eq("email", user.email);
        
        if (checkError) return null;

        const { data, error } = await supabase
          .from("drivers")
          .select("*")
          .eq("email", user.email)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error) {
          return null;
        }

        const drivers = data ?? [];

        if (drivers.length === 0) {
          return null;
        }

        return drivers[0];
      } catch {
        return null;
      }
    },
    enabled: !!user?.email,
  });

  // Fetch all active vehicles
  const { data: vehicles = [], isLoading: vehiclesLoading, error: _vehiclesError } = useQuery<Vehicle[]>({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      // Check if we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!session || sessionError) return [];

      const { data, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number, vehicle_type, make, model, active")
        .eq("active", true)
        .order("fleet_number");

      if (error) {
        throw error;
      }

      return data || [];
    },
  });

  // Fetch current driver assignment
  // Note: driver_vehicle_assignments.driver_id references auth.users(id), not drivers(id)
  const { data: currentAssignment, isLoading: assignmentLoading } = useQuery<DriverAssignment | null>({
    queryKey: ["driver-assignment", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return null;
      }

      try {

        const { data, error } = await supabase
          .from("driver_vehicle_assignments")
          .select(`
            id,
            driver_id,
            vehicle_id,
            assigned_at,
            is_active,
            unassigned_at,
            notes,
            created_at,
            updated_at,
            vehicles!inner (
              id,
              fleet_number,
              registration_number,
              vehicle_type,
              make,
              model,
              active
            )
          `)
          .eq("driver_id", user.id)
          .eq("is_active", true)
          .order("assigned_at", { ascending: false })
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return data as DriverAssignment | null;
      } catch {
        return null;
      }
    },
    enabled: !!user?.id,
  });

  // Assign vehicle mutation
  // Note: driver_vehicle_assignments.driver_id references auth.users(id), not drivers(id)
  const assignVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      if (!vehicleId) {

        const { error } = await supabase
          .from("driver_vehicle_assignments")
          .update({
            is_active: false,
            unassigned_at: new Date().toISOString()
          } as never)
          .eq("driver_id", user.id)
          .eq("is_active", true);

        if (error) {
          throw error;
        }

        // Clear the cache immediately for unassignment
        queryClient.setQueryData(["driver-assignment", user.id], null);
        return null;
      }

      // Unassign existing
      await supabase
        .from("driver_vehicle_assignments")
        .update({
          is_active: false,
          unassigned_at: new Date().toISOString()
        } as never)
        .eq("driver_id", user.id)
        .eq("is_active", true);

      // Create new assignment
      const { data, error } = await supabase
        .from("driver_vehicle_assignments")
        .insert([{
          driver_id: user.id,
          vehicle_id: vehicleId,
          assigned_at: new Date().toISOString(),
          is_active: true,
          notes: `Assigned via mobile app by ${user?.email || "driver"}`
        }] as never)
        .select(`
          id,
          driver_id,
          vehicle_id,
          assigned_at,
          is_active,
          created_at,
          updated_at,
          vehicles!inner (
            id,
            fleet_number,
            registration_number,
            vehicle_type,
            make,
            model,
            active
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      // Transform the data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assignmentData = data as any;
      const { vehicles: vehiclesArr, ...rest } = assignmentData;
      const transformed: DriverAssignment = {
        ...rest,
        vehicles: Array.isArray(vehiclesArr) ? vehiclesArr[0] ?? null : vehiclesArr
      } as DriverAssignment;
      return transformed;
    },
    onSuccess: (data) => {
      // Immediately update the assignment cache for instant UI update
      queryClient.setQueryData(["driver-assignment", user?.id], data);
      
      // Invalidate queries in the background (don't await) - this triggers refetch
      // Using invalidateQueries instead of resetQueries for better performance
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["driver-assignment"] }),
        queryClient.invalidateQueries({ queryKey: ["assigned-vehicle"] }),
        queryClient.invalidateQueries({ queryKey: ["driver-assigned-vehicle"] }),
        queryClient.invalidateQueries({ queryKey: ["wialon-vehicle"] }),
        // Data that depends on assigned vehicle
        queryClient.invalidateQueries({ queryKey: ["monthly-diesel-records"] }),
        queryClient.invalidateQueries({ queryKey: ["monthly-trips"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-diesel-records"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-trips"] }),
      ]).catch(console.error);

      toast({
        title: data ? "Vehicle assigned" : "Vehicle unassigned",
        description: data
          ? `You are now assigned to ${data.vehicles?.fleet_number || "Unknown"} - ${data.vehicles?.registration_number || data.vehicles?.registration || "Unknown"}`
          : "You are no longer assigned to a vehicle",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update assignment",
        variant: "destructive",
      });
    },
  });

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Clear query cache first
      queryClient.clear();

      // Clear all storage
      localStorage.clear();
      sessionStorage.clear();

      // Clear all cookies related to Supabase
      document.cookie.split(";").forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
        // Delete cookie for all possible paths
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      });

      // Sign out from Supabase
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // signOut error - continue with cleanup
      }

      // Clear service worker caches for PWA
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        } catch {
          // cache clear error - non-critical
        }
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
          }
        } catch {
          // service worker unregister error - non-critical
        }
      }

      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
      });

      // Force hard redirect to login (bypasses any client-side routing cache)
      window.location.replace("/login");

    } catch {
      // Even on error, force redirect to login
      window.location.replace("/login");
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getVehicleTypeIcon = (vehicleType?: string | null) => {
    switch (vehicleType?.toLowerCase()) {
      case 'truck':
      case 'horse':
        return <Truck className="w-3.5 h-3.5" />;
      case 'trailer':
        return <Settings className="w-3.5 h-3.5" />;
      case 'reefer':
        return <Fuel className="w-3.5 h-3.5" />;
      default:
        return <Car className="w-3.5 h-3.5" />;
    }
  };

  // Document expiry notifications
  const { alerts: _alerts, expiredCount, expiringCount, hasAlerts } = useDriverDocuments(driver?.id);

  const menuItems = [
    {
      icon: Bell,
      label: "Notifications",
      description: hasAlerts
        ? `${expiredCount + expiringCount} document alert${expiredCount + expiringCount > 1 ? "s" : ""}`
        : "No alerts",
      badge: hasAlerts ? (expiredCount > 0 ? "destructive" : "warning") : undefined,
      badgeCount: expiredCount + expiringCount,
      onClick: () => router.push("/profile/documents"),
    },
    {
      icon: FileText,
      label: "Documents",
      description: "License, PDP & more",
      badge: hasAlerts ? (expiredCount > 0 ? "destructive" : "warning") : undefined,
      badgeCount: expiredCount + expiringCount,
      onClick: () => router.push("/profile/documents"),
    },
    {
      icon: HelpCircle,
      label: "Support",
      description: "Get help",
      badge: undefined as string | undefined,
      badgeCount: 0,
      onClick: () => toast({
        title: "Support",
        description: "Contact administrator for assistance",
      }),
    },
    {
      icon: Smartphone,
      label: "About",
      description: "v2.1.0",
      badge: undefined as string | undefined,
      badgeCount: 0,
      onClick: () => toast({
        title: "Matanuska Fleet",
        description: "Version 2.1.0",
      }),
    },
  ];

  const vehicleOptions: VehicleOption[] = vehicles.map((v) => {
    const reg = v.registration_number || v.registration || "";
    return {
      value: v.id,
      label: v.fleet_number || reg || `Vehicle ${v.id.slice(0, 4)}`,
      sublabel: `${reg || "No Reg"} • ${v.vehicle_type || "Unknown"}`,
      details: {
        fleetNumber: v.fleet_number || null,
        registration: reg || null,
        type: v.vehicle_type || null,
        make: v.make || null,
        model: v.model || null,
        reefer: null,
      }
    };
  });

  const assignedVehicle = currentAssignment?.vehicles;

  return (
    <MobileShell>
      <div className="p-5 space-y-6">
        <div className="flex flex-col items-center py-6">
          <Avatar className="h-20 w-20 ring-4 ring-background shadow-xl mb-4">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xl font-semibold">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-semibold">{profile?.full_name || "Driver"}</h1>
          <Badge variant="secondary" className="mt-2">
            <Shield className="w-3 h-3 mr-1" strokeWidth={1.5} />
            {profile?.role || "Driver"}
          </Badge>
        </div>

        {process.env.NODE_ENV === "development" && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-xs font-mono mb-2">Debug Info:</p>
              <p className="text-xs">User Email: {user?.email || "None"}</p>
              <p className="text-xs">Driver: {driver ? `${driver.first_name} ${driver.last_name}` : "Not found"}</p>
              <p className="text-xs">Driver ID: {driver?.id || "None"}</p>
              <p className="text-xs">Vehicles: {vehicles.length} active</p>
              <p className="text-xs">Assignment: {currentAssignment ? "Active" : "None"}</p>
              <p className="text-xs">Assigned Vehicle: {assignedVehicle?.fleet_number || "None"}</p>
            </CardContent>
          </Card>
        )}

        {driver && (
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-border/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <User className="w-4 h-4 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-muted-foreground">Driver Profile</p>
                    <p className="text-sm font-semibold">{driver.first_name} {driver.last_name}</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {driver.driver_number}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  {driver.phone && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Phone className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Driver Phone</p>
                        <p className="text-sm text-muted-foreground">{driver.phone}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Badge variant="secondary" className="text-xs">
                        ID
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Driver Number</p>
                      <p className="text-sm text-muted-foreground">{driver.driver_number}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-border/50">
              <p className="font-medium text-sm mb-3 text-muted-foreground">Account Contact</p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Mail className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {profile?.email || user?.email || "Not set"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Phone className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">
                      {profile?.phone || "Not set"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Truck className="w-4 h-4 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium">Assigned Vehicle</p>
                <p className="text-xs text-muted-foreground">
                  {assignmentLoading || vehiclesLoading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading...
                    </span>
                                      ) : assignedVehicle ? (
                    <span className="flex items-center gap-2">
                      {getVehicleTypeIcon(assignedVehicle.vehicle_type)}
                      <span>
                        {assignedVehicle.fleet_number || "Unknown"} - {assignedVehicle.registration_number || assignedVehicle.registration || "Unknown"}
                      </span>
                    </span>
                  ) : (
                    "No vehicle assigned"
                  )}
                </p>
              </div>
            </div>

            {assignmentLoading || vehiclesLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading vehicles...</span>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">No active vehicles available</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  All vehicles are currently assigned or inactive
                </p>
              </div>
            ) : (
              <>
                <VehicleSelect
                  options={vehicleOptions}
                  value={assignedVehicle?.id || ""}
                  onChange={(value) => assignVehicleMutation.mutate(value)}
                  placeholder="Select your vehicle"
                  disabled={assignVehicleMutation.isPending || assignmentLoading}
                />
                {assignedVehicle && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => assignVehicleMutation.mutate("")}
                    disabled={assignVehicleMutation.isPending}
                  >
                    {assignVehicleMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    ) : null}
                    Unassign Vehicle
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors ${
                    index !== menuItems.length - 1 ? "border-b border-border/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative p-2 bg-muted rounded-lg">
                      <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                      {item.badge && item.badgeCount > 0 && (
                        <span
                          className={`absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white ${
                            item.badge === "destructive" ? "bg-destructive" : "bg-amber-500"
                          }`}
                        >
                          {item.badgeCount}
                        </span>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full h-12 border-destructive/30 hover:border-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 mr-2" strokeWidth={1.5} />
          )}
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </Button>

        <p className="text-center text-xs text-muted-foreground pt-2">
          Matanuska Fleet Management • {assignedVehicle ? `Assigned: ${assignedVehicle.fleet_number || "Unknown"}` : "No assignment"}
        </p>
      </div>
    </MobileShell>
  );
}