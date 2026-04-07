import { MobileShell } from "@/components/layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { useDriverDocuments } from "@/hooks/use-driver-documents";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
import { useNavigate } from "react-router-dom";


interface Vehicle {
  id: string;
  fleet_number: string;
  registration?: string;
  registration_number?: string;
  vehicle_type?: string | null;
  make?: string | null;
  model?: string | null;
  active?: boolean | null;
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

const TRUCK_TYPES = ['truck', 'van', 'bus', 'rigid_truck', 'horse_truck', 'refrigerated_truck'];
const TRAILER_TYPES = ['reefer', 'trailer', 'interlink'];

export default function ProfilePage() {
  const { user, profile, signOut: _signOut } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Find driver by auth_user_id (primary) or email (fallback)
  const { data: driver, isLoading: _driverLoading } = useQuery<Driver | null>({
    queryKey: ["driver-by-email-docs", user?.id, user?.email],
    queryFn: async () => {
      if (!user) return null;
      try {
        // Try auth_user_id first (set by Dashboard when creating driver auth profile)
        if (user.id) {
          const { data } = await supabase
            .from("drivers")
            .select("*")
            .eq("auth_user_id", user.id)
            .eq("status", "active")
            .limit(1)
            .maybeSingle();
          if (data) return data as Driver;
        }
        // Fallback: match by email
        if (user.email) {
          const { data } = await supabase
            .from("drivers")
            .select("*")
            .eq("email", user.email)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) return data as Driver;
        }
        return null;
      } catch {
        return null;
      }
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  // NOTE: driver_vehicle_assignments.driver_id = auth.users.id (Auth UUID),
  // NOT drivers.id. Use user.id for assignment queries.

  // Fetch all active driver assignments (assigned by admin from dashboard)
  const { data: vehicleAssignments, isLoading: assignmentLoading } = useQuery<{ truck: Vehicle | null; reefer: Vehicle | null }>({
    queryKey: ["driver-assignment", user?.id],
    queryFn: async () => {
      if (!user?.id) return { truck: null, reefer: null };
      try {
        const { data, error } = await supabase
          .from("driver_vehicle_assignments")
          .select(`
            id,
            driver_id,
            vehicle_id,
            assigned_at,
            is_active,
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
          .order("assigned_at", { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) return { truck: null, reefer: null };

        type AssignmentRow = { vehicles: Vehicle };
        const rows = data as unknown as AssignmentRow[];
        const truckRow = rows.find(r => !r.vehicles.vehicle_type || TRUCK_TYPES.includes(r.vehicles.vehicle_type));
        const reeferRow = rows.find(r => r.vehicles.vehicle_type && TRAILER_TYPES.includes(r.vehicles.vehicle_type));

        return {
          truck: truckRow?.vehicles || null,
          reefer: reeferRow?.vehicles || null,
        };
      } catch {
        return { truck: null, reefer: null };
      }
    },
    enabled: !!user?.id,
  });

  const handleSignOut = async () => {
    setIsSigningOut(true);

    // Save email before clearing anything
    const lastEmail = user?.email;

    try {
      queryClient.clear();
      await _signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }

    // Restore saved email so login page pre-fills
    if (lastEmail) {
      try { localStorage.setItem("mata_last_email", lastEmail); } catch { /* ignore */ }
    }

    // Force navigation — use window.location as fallback to guarantee redirect
    window.location.href = "/login";
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
      case "truck":
      case "horse":
        return <Truck className="w-3.5 h-3.5" />;
      case "trailer":
        return <Settings className="w-3.5 h-3.5" />;
      case "reefer":
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
      onClick: () => navigate("/profile/documents"),
    },
    {
      icon: FileText,
      label: "Documents",
      description: "License, PDP & more",
      badge: hasAlerts ? (expiredCount > 0 ? "destructive" : "warning") : undefined,
      badgeCount: expiredCount + expiringCount,
      onClick: () => navigate("/profile/documents"),
    },
    {
      icon: HelpCircle,
      label: "Support",
      description: "Get help",
      badge: undefined as string | undefined,
      badgeCount: 0,
      onClick: () =>
        toast({
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
      onClick: () =>
        toast({
          title: "Matanuska Fleet",
          description: "Version 2.1.0",
        }),
    },
  ];

  const assignedTruck = vehicleAssignments?.truck;
  const assignedReefer = vehicleAssignments?.reefer;
  const hasAssignment = !!assignedTruck || !!assignedReefer;

  return (
    <MobileShell>
      <div className="p-5 space-y-6">
        {/* Avatar & Name */}
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

        {/* Debug Info (dev only) */}
        {process.env.NODE_ENV === "development" && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-xs font-mono mb-2">Debug Info:</p>
              <p className="text-xs">User Email: {user?.email || "None"}</p>
              <p className="text-xs">
                Driver: {driver ? `${driver.first_name} ${driver.last_name}` : "Not found"}
              </p>
              <p className="text-xs">Driver ID: {driver?.id || "None"}</p>
              <p className="text-xs">Assignment: {vehicleAssignments?.truck || vehicleAssignments?.reefer ? "Active" : "None"}</p>
              <p className="text-xs">
                Truck: {vehicleAssignments?.truck?.fleet_number || "None"}
              </p>
              <p className="text-xs">
                Reefer: {vehicleAssignments?.reefer?.fleet_number || "None"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Driver Profile */}
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
                    <p className="text-sm font-semibold">
                      {driver.first_name} {driver.last_name}
                    </p>
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

        {/* Account Contact */}
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

        {/* Assigned Vehicles (read-only — assigned by admin from dashboard) */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Truck className="w-4 h-4 text-primary" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium">Assigned Vehicles</p>
            </div>
            {assignmentLoading ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading...
              </span>
            ) : hasAssignment ? (
              <div className="space-y-3">
                {assignedTruck && (
                  <div className="pl-2 border-l-2 border-primary/30">
                    <div className="flex items-center gap-2 text-sm">
                      {getVehicleTypeIcon(assignedTruck.vehicle_type)}
                      <span className="font-semibold">
                        {assignedTruck.fleet_number || "Unknown"}
                      </span>
                      <span className="text-muted-foreground">—</span>
                      <span className="text-muted-foreground">
                        {assignedTruck.registration_number || assignedTruck.registration || "Unknown"}
                      </span>
                    </div>
                    {(assignedTruck.make || assignedTruck.vehicle_type) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[assignedTruck.vehicle_type, assignedTruck.make, assignedTruck.model]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                )}
                {assignedReefer && (
                  <div className="pl-2 border-l-2 border-blue-400/30">
                    <div className="flex items-center gap-2 text-sm">
                      {getVehicleTypeIcon(assignedReefer.vehicle_type)}
                      <span className="font-semibold">
                        {assignedReefer.fleet_number || "Unknown"}
                      </span>
                      <span className="text-muted-foreground">—</span>
                      <span className="text-muted-foreground">
                        {assignedReefer.registration_number || assignedReefer.registration || "Unknown"}
                      </span>
                    </div>
                    {(assignedReefer.make || assignedReefer.vehicle_type) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[assignedReefer.vehicle_type, assignedReefer.make, assignedReefer.model]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No vehicle assigned — contact your administrator
              </p>
            )}
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card>
          <CardContent className="p-0">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors ${index !== menuItems.length - 1 ? "border-b border-border/50" : ""
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative p-2 bg-muted rounded-lg">
                      <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                      {item.badge && item.badgeCount > 0 && (
                        <span
                          className={`absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white ${item.badge === "destructive" ? "bg-destructive" : "bg-warning"
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

        {/* Sign Out */}
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
          Matanuska Fleet Management •{" "}
          {assignedTruck || assignedReefer
            ? `Assigned: ${[assignedTruck?.fleet_number, assignedReefer?.fleet_number].filter(Boolean).join(" + ") || "Unknown"}`
            : "No assignment"}
        </p>
      </div>
    </MobileShell>
  );
}
