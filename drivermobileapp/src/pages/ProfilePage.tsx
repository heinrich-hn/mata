import { MobileShell } from "@/components/layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { RefreshButton } from "@/components/ui/refresh-button";
import { useAuth } from "@/contexts/auth-context";
import { useDriverDocuments } from "@/hooks/use-driver-documents";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
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
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const DEBUG_MODE = process.env.NODE_ENV === 'development';

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
  auth_user_id?: string | null;
}

const TRUCK_TYPES = ['truck', 'van', 'bus', 'rigid_truck', 'horse_truck', 'refrigerated_truck'];
const TRAILER_TYPES = ['reefer', 'trailer', 'interlink'];

export default function ProfilePage() {
  const { user, profile, signOut: _signOut, session } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const debugLoggedRef = useRef(false);

  // Debug logging on mount (only once)
  if (DEBUG_MODE && !debugLoggedRef.current) {
    console.group('👤 ProfilePage Debug Info');
    console.log('User:', { id: user?.id, email: user?.email });
    console.log('Session:', session ? 'Active' : 'None');
    if (session?.expires_at) {
      console.log('Session expires:', new Date(session.expires_at * 1000).toLocaleString());
    }
    console.log('Profile:', profile);
    debugLoggedRef.current = true;
    console.groupEnd();
  }

  // Find driver by auth_user_id (primary) or email (fallback)
  const { data: driver, isLoading: driverLoading, error: driverError } = useQuery<Driver | null>({
    queryKey: ["driver-by-email-docs", user?.id, user?.email],
    queryFn: async () => {
      console.log('🔍 ProfilePage: Fetching driver record for user:', { userId: user?.id, email: user?.email });
      if (!user) return null;

      // Try auth_user_id first (set by Dashboard when creating driver auth profile)
      if (user.id) {
        const { data, error } = await supabase
          .from("drivers")
          .select("*")
          .eq("auth_user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (error) {
          console.error('❌ ProfilePage: Error fetching driver by auth_user_id:', error);
          throw error;
        }
        if (data) {
          console.log('✅ ProfilePage: Driver found by auth_user_id:', data.driver_number);
          return data as Driver;
        }
      }

      // Fallback: match by email
      if (user.email) {
        const { data, error } = await supabase
          .from("drivers")
          .select("*")
          .eq("email", user.email)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.error('❌ ProfilePage: Error fetching driver by email:', error);
          throw error;
        }
        if (data) {
          console.log('✅ ProfilePage: Driver found by email:', data.driver_number);
          return data as Driver;
        }
      }

      console.log('⚠️ ProfilePage: No driver found for user');
      return null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  // NOTE: driver_vehicle_assignments.driver_id = auth.users.id (Auth UUID),
  // NOT drivers.id. Use user.id for assignment queries.

  // Fetch all active driver assignments (assigned by admin from dashboard)
  // Uses same query key as HomePage/TripPage/DieselPage so all pages share the cache.
  const { data: vehicleAssignments, isLoading: assignmentLoading, error: assignmentError } = useQuery<{ truck: Vehicle | null; reefer: Vehicle | null }>({
    queryKey: ["assigned-vehicle", user?.id],
    queryFn: async () => {
      console.log('🔍 ProfilePage: Fetching vehicle assignments for user:', user?.id);
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

        if (error) {
          console.error('❌ ProfilePage: Error fetching assignments:', error);
          throw error;
        }

        console.log('📊 ProfilePage: Assignments found:', data?.length || 0);
        if (!data || data.length === 0) return { truck: null, reefer: null };

        type AssignmentRow = { vehicles: Vehicle };
        const rows = data as unknown as AssignmentRow[];
        const truckRow = rows.find(r => !r.vehicles.vehicle_type || TRUCK_TYPES.includes(r.vehicles.vehicle_type));
        const reeferRow = rows.find(r => r.vehicles.vehicle_type && TRAILER_TYPES.includes(r.vehicles.vehicle_type));

        console.log('🚛 ProfilePage: Truck assignment:', truckRow?.vehicles?.fleet_number || 'None');
        console.log('❄️ ProfilePage: Reefer assignment:', reeferRow?.vehicles?.fleet_number || 'None');

        return {
          truck: truckRow?.vehicles || null,
          reefer: reeferRow?.vehicles || null,
        };
      } catch (err) {
        console.error('❌ ProfilePage: Exception fetching assignments:', err);
        return { truck: null, reefer: null };
      }
    },
    enabled: !!user?.id,
  });

  const handleSignOut = async () => {
    console.log('🚪 ProfilePage: Signing out...');
    setIsSigningOut(true);

    // Save email before clearing anything
    const lastEmail = user?.email;

    try {
      // signOut() handles clearing queryClient internally
      await _signOut();
      console.log('✅ ProfilePage: Sign out successful');
    } catch (err) {
      console.error("❌ ProfilePage: Sign out error:", err);
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

  // Refresh handler — shared by PullToRefresh and RefreshButton
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["driver-by-email-docs"] }),
      queryClient.invalidateQueries({ queryKey: ["assigned-vehicle"] }),
    ]);
  }, [queryClient]);

  // Auto-refresh data when navigating to this tab
  useRefreshOnFocus([
    ["driver-by-email-docs"],
    ["assigned-vehicle"],
  ]);

  return (
    <MobileShell>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="p-5 space-y-6">
          {/* Debug Button */}
          {DEBUG_MODE && (
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="fixed top-20 right-5 bg-black/80 text-white text-xs px-2 py-1 rounded-full z-50"
            >
              🐛 Debug
            </button>
          )}

          {/* Debug Panel */}
          {showDebug && DEBUG_MODE && (
            <Card className="bg-black/90 text-white mb-4">
              <CardContent className="p-4 space-y-2 text-xs font-mono">
                <div className="font-bold text-green-400">🔍 Debug Info</div>
                <div className="border-t border-gray-700 pt-2">
                  <div>User ID: {user?.id}</div>
                  <div>User Email: {user?.email}</div>
                  <div>Session: {session ? '✅ Active' : '❌ None'}</div>
                  {session?.expires_at && (
                    <div>Expires: {new Date(session.expires_at * 1000).toLocaleString()}</div>
                  )}
                </div>
                <div className="border-t border-gray-700 pt-2">
                  <div>Driver ID: {driver?.id || 'None'}</div>
                  <div>Driver Number: {driver?.driver_number || 'None'}</div>
                  <div>Driver auth_user_id: {driver?.auth_user_id || 'None'}</div>
                  <div>Match: {driver?.auth_user_id === user?.id ? '✅' : '❌'}</div>
                </div>
                <div className="border-t border-gray-700 pt-2">
                  <div>Truck: {assignedTruck?.fleet_number || 'None'}</div>
                  <div>Reefer: {assignedReefer?.fleet_number || 'None'}</div>
                  <div>Assignment Loading: {assignmentLoading ? 'Yes' : 'No'}</div>
                </div>
                <div className="border-t border-gray-700 pt-2">
                  <div>Storage Keys: {Object.keys(localStorage).filter(k => k.includes('mata') || k.includes('supabase')).join(', ') || 'None'}</div>
                </div>
                <button
                  onClick={() => {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/login';
                  }}
                  className="bg-red-600 text-white px-2 py-1 rounded text-xs mt-2 w-full"
                >
                  Clear All & Logout
                </button>
                <button
                  onClick={() => {
                    navigator.serviceWorker?.getRegistrations().then(regs => {
                      regs.forEach(reg => reg.unregister());
                      console.log('Service workers unregistered');
                      window.location.reload();
                    });
                  }}
                  className="bg-orange-600 text-white px-2 py-1 rounded text-xs mt-2 w-full"
                >
                  Clear Service Workers
                </button>
              </CardContent>
            </Card>
          )}

          {/* Avatar & Name */}
          <div className="flex flex-col items-center py-6">
            <div className="flex items-center gap-2 self-end">
              <RefreshButton onRefresh={handleRefresh} />
            </div>
            <Avatar className="h-20 w-20 ring-4 ring-background shadow-xl mb-4">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xl font-semibold">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-xl font-semibold">
              {driver ? `${driver.first_name} ${driver.last_name}` : profile?.full_name || user?.email?.split("@")[0] || "Driver"}
            </h1>
            <Badge variant="secondary" className="mt-2">
              <Shield className="w-3 h-3 mr-1" strokeWidth={1.5} />
              {profile?.role || "Driver"}
            </Badge>
          </div>

          {/* Debug Info (dev only) - Enhanced */}
          {process.env.NODE_ENV === "development" && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-xs font-mono mb-2">🔧 Debug Info:</p>
                <p className="text-xs">User ID: {user?.id || "None"}</p>
                <p className="text-xs">User Email: {user?.email || "None"}</p>
                <p className="text-xs">Session Active: {session ? "Yes" : "No"}</p>
                <p className="text-xs">
                  Driver: {driver ? `${driver.first_name} ${driver.last_name}` : "Not found"}
                </p>
                <p className="text-xs">Driver ID: {driver?.id || "None"}</p>
                <p className="text-xs">Driver auth_user_id: {driver?.auth_user_id || "None"}</p>
                <p className="text-xs">Auth Link: {driver?.auth_user_id === user?.id ? "✅ Match" : "❌ Mismatch"}</p>
                <p className="text-xs">Assignment: {vehicleAssignments?.truck || vehicleAssignments?.reefer ? "Active" : "None"}</p>
                <p className="text-xs">Driver Error: {driverError?.message || "None"}</p>
                <p className="text-xs">Assignment Error: {assignmentError?.message || "None"}</p>
                <p className="text-xs">Driver Loading: {driverLoading ? "Yes" : "No"}</p>
                <p className="text-xs">
                  Truck: {vehicleAssignments?.truck?.fleet_number || "None"}
                </p>
                <p className="text-xs">
                  Reefer: {vehicleAssignments?.reefer?.fleet_number || "None"}
                </p>
                <p className="text-xs">
                  Assignment Count: {(vehicleAssignments?.truck ? 1 : 0) + (vehicleAssignments?.reefer ? 1 : 0)}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Driver Profile */}
          {driver ? (
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
          ) : !driverLoading ? (
            <Card className="border-warning/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Driver Profile Not Found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {driverError
                        ? `Error: ${driverError.message}`
                        : "Your login account is not linked to a driver record. Contact your administrator."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

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
                <div>
                  <p className="text-xs text-muted-foreground">
                    No vehicle assigned — contact your administrator
                  </p>
                  {assignmentError && (
                    <p className="text-xs text-destructive mt-1">
                      Error: {assignmentError.message}
                    </p>
                  )}
                </div>
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
                    className={`w-full flex items-center justify-between p-4 hover:bg-muted/50 active:bg-muted active:scale-[0.99] transition-colors ${index !== menuItems.length - 1 ? "border-b border-border/50" : ""
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
      </PullToRefresh>
    </MobileShell>
  );
}