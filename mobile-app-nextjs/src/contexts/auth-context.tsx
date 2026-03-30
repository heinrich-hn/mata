import { createClient } from "@/lib/supabase/client";
import { Session, User } from "@supabase/supabase-js";

export interface Profile {
  user_id: number;
  name: string;
  username: string;
  shortcode: string;
  email: string | null;
  phone: string | null;
  role_id: number | null;
  status: string;
  role: string;
  full_name: string;
  avatar_url?: string | null;
}
import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react";

// Define the shape of the user data returned from Supabase
interface UserData {
  user_id: number;
  name: string;
  username: string;
  shortcode: string;
  notification_email: string;
  role_id: number | null;
  status: string;
  roles: {
    role_name: string;
  } | {
    role_name: string;
  }[] | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildFallbackProfile(userEmail: string, authUser: User): Profile {
  const metadata = authUser.user_metadata || {};
  return {
    user_id: 0,
    name: metadata.full_name || metadata.name || userEmail.split('@')[0],
    username: userEmail.split('@')[0],
    shortcode: (userEmail.split('@')[0]).substring(0, 3).toUpperCase(),
    email: userEmail,
    phone: metadata.phone || null,
    role_id: null,
    status: "Active",
    role: "Driver",
    full_name: metadata.full_name || metadata.name || userEmail.split('@')[0],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for mounted state and fetch versioning
  const mountedRef = useRef(true);
  const fetchVersionRef = useRef(0);
  const isLoadingRef = useRef(true);

  // Keep isLoadingRef in sync
  isLoadingRef.current = isLoading;

  // Memoize Supabase client creation
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
      return null;
    }
  }, []);

  // If client failed, surface error once
  useEffect(() => {
    if (!supabase) {
      setError("Failed to initialize authentication");
      setIsLoading(false);
    }
  }, [supabase]);

  const fetchProfile = useCallback(async (
    userEmail: string | undefined,
    authUser?: User | null,
  ): Promise<Profile | null> => {
    if (!userEmail || !supabase || !mountedRef.current) return null;

    const thisVersion = ++fetchVersionRef.current;

    try {
      const { data, error: queryError } = await supabase
        .from("users")
        .select(`
          user_id,
          name,
          username,
          shortcode,
          notification_email,
          role_id,
          status,
          roles:role_id (
            role_name
          )
        `)
        .or(`notification_email.eq.${userEmail},username.eq.${userEmail}`)
        .eq("status", "Active")
        .maybeSingle();

      // Stale-request guard
      if (fetchVersionRef.current !== thisVersion || !mountedRef.current) return null;

      if (queryError) {
        console.error("Profile query error:", queryError);
        return authUser ? buildFallbackProfile(userEmail, authUser) : null;
      }

      if (!data) {
        return authUser ? buildFallbackProfile(userEmail, authUser) : null;
      }

      const userData = data as unknown as UserData;

      let roleName: string | null = null;
      if (userData.roles) {
        if (Array.isArray(userData.roles) && userData.roles.length > 0) {
          roleName = userData.roles[0]?.role_name;
        } else if (typeof userData.roles === "object") {
          roleName = (userData.roles as { role_name: string }).role_name;
        }
      }

      return {
        user_id: userData.user_id,
        name: userData.name,
        username: userData.username,
        shortcode: userData.shortcode,
        email: userData.notification_email,
        phone: null,
        role_id: userData.role_id,
        status: userData.status,
        role: roleName || "Driver",
        full_name: userData.name,
      };
    } catch (err) {
      if (err instanceof Error && (err.name === "AbortError" || err.name === "DOMException")) {
        return null;
      }
      if (fetchVersionRef.current !== thisVersion || !mountedRef.current) return null;

      console.error("Error fetching profile:", err);
      return authUser ? buildFallbackProfile(userEmail, authUser) : null;
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user?.email && mountedRef.current) {
      const p = await fetchProfile(user.email, user);
      if (mountedRef.current) setProfile(p);
    }
  }, [user, fetchProfile]);

  // Single initialisation effect
  useEffect(() => {
    mountedRef.current = true;

    if (!supabase) return;

    // Safety timeout — generous to handle slow mobile networks.
    // Only stops the loading spinner; does NOT clear user state if a cached
    // session was already loaded (that would wipe visible data).
    const loadingTimeout = setTimeout(() => {
      if (mountedRef.current && isLoadingRef.current) {
        console.warn("Auth init timeout — forcing loading = false");
        setIsLoading(false);
      }
    }, 10_000);

    let initComplete = false;

    // Helper: mark initialisation done and stop the spinner.
    const finishInit = () => {
      if (!initComplete && mountedRef.current) {
        initComplete = true;
        setIsLoading(false);
      }
    };

    // Capture the ref object and current value at effect setup for cleanup safety
    const fetchVersion = fetchVersionRef;
    const initialFetchVersion = fetchVersion.current;

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      // Stop loading NOW — user/session are set, profile can load in background.
      // This prevents the safety timeout from firing while fetchProfile is slow.
      finishInit();

      if (newSession?.user?.email) {
        const p = await fetchProfile(newSession.user.email, newSession.user);
        if (mountedRef.current) setProfile(p);
      } else {
        setProfile(null);
      }
    });

    // Validate session server-side with getUser() — getSession() only reads the
    // cached JWT from storage and will happily return an expired token.
    // getUser() hits Supabase's /auth/v1/user endpoint to verify + refresh.
    supabase.auth.getUser()
      .then(async ({ data: { user: verifiedUser }, error: userError }) => {
        if (!mountedRef.current || initComplete) return;

        if (userError || !verifiedUser) {
          // Token expired / invalid — clear stale state so UI shows login
          console.warn("Session invalid or expired:", userError?.message);
          setSession(null);
          setUser(null);
          setProfile(null);
          finishInit();
          return;
        }

        // Token is valid — now read the (refreshed) session for the JWT
        const { data: { session: freshSession } } = await supabase.auth.getSession();

        setSession(freshSession);
        setUser(verifiedUser);

        // Stop loading before the profile network call
        finishInit();

        if (verifiedUser.email) {
          const p = await fetchProfile(verifiedUser.email, verifiedUser);
          if (mountedRef.current) setProfile(p);
        }
      })
      .catch((err) => {
        console.error("Auth initialization error:", err);
        if (mountedRef.current) {
          setSession(null);
          setUser(null);
          setProfile(null);
          finishInit();
        }
      });

    return () => {
      // Unsubscribe FIRST to prevent listener firing after mounted=false
      subscription.unsubscribe();
      mountedRef.current = false;
      clearTimeout(loadingTimeout);

      // Use the captured initial version to increment safely
      // Only increment if no other effect has already incremented it
      if (fetchVersion.current === initialFetchVersion) {
        fetchVersion.current++;
      }
    };
  }, [supabase, fetchProfile]); // Keep these dependencies

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Authentication service not available") };

    fetchVersionRef.current++;

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error("Sign in error:", signInError);
        return { error: signInError as Error };
      }

      if (data.user && data.session && mountedRef.current) {
        setUser(data.user);
        setSession(data.session);
        const p = await fetchProfile(data.user.email, data.user);
        if (mountedRef.current) setProfile(p);
      }

      return { error: null };
    } catch (err) {
      console.error("Sign in exception:", err);
      return { error: err as Error };
    }
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    fetchVersionRef.current++;

    if (!supabase) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        console.error("Sign out error:", signOutError);
        throw signOutError;
      }
    } catch (err) {
      console.error("Sign out exception:", err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsLoading(false);
    }
  }, [supabase]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    profile,
    isLoading,
    error,
    signIn,
    signOut,
    refreshProfile,
  }), [user, session, profile, isLoading, error, signIn, signOut, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}