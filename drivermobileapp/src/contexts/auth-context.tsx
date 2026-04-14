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
import { useQueryClient } from "@tanstack/react-query";

const PROFILE_CACHE_KEY = "mata-driver-profile";
const SESSION_BACKUP_KEY = "mata-driver-session-backup";

/** Persist profile in localStorage so it survives page refreshes */
function cacheProfile(p: Profile | null) {
  try {
    if (p) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch { /* storage full / blocked */ }
}

function loadCachedProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (raw) return JSON.parse(raw) as Profile;
  } catch { /* corrupted / blocked */ }
  return null;
}

/** Backup session tokens to a separate key the SDK doesn't touch.
 *  Only the refresh_token + access_token are needed for recovery. */
function backupSession(s: Session | null) {
  try {
    if (s?.refresh_token && s?.access_token) {
      localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify({
        access_token: s.access_token,
        refresh_token: s.refresh_token,
      }));
    } else {
      localStorage.removeItem(SESSION_BACKUP_KEY);
    }
  } catch { /* storage full / blocked */ }
}

function loadBackupSession(): { access_token: string; refresh_token: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_BACKUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.access_token && parsed?.refresh_token) return parsed;
    }
  } catch { /* corrupted */ }
  return null;
}

function clearBackupSession() {
  try { localStorage.removeItem(SESSION_BACKUP_KEY); } catch { /* ignore */ }
}

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
  isSigningOut: boolean;
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
  const [profile, setProfileState] = useState<Profile | null>(loadCachedProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Wrapper that also persists profile to localStorage
  const setProfile = useCallback((p: Profile | null) => {
    setProfileState(p);
    cacheProfile(p);
  }, []);

  // Refs for mounted state and fetch versioning
  const mountedRef = useRef(true);
  const fetchVersionRef = useRef(0);
  const isLoadingRef = useRef(true);
  const isSigningOutRef = useRef(false);
  const recoveryInProgressRef = useRef(false);

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
  }, [user, fetchProfile, setProfile]);

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

    // Subscribe to auth changes — this is the PRIMARY source of truth.
    // onAuthStateChange fires INITIAL_SESSION with the cached/refreshed session
    // before getUser() even resolves, so it handles most cases.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;

      // ── SIGNED_OUT ───────────────────────────────────────────────
      // Only wipe state on INTENTIONAL sign-out.  The SDK fires
      // SIGNED_OUT on failed token refreshes (common when a mobile
      // PWA resumes from background with a brief network gap).
      // For those spurious events, attempt to recover the session
      // from our backup instead of wiping the entire app state.
      if (event === "SIGNED_OUT") {
        if (isSigningOutRef.current) {
          // Intentional sign-out — clear everything
          setSession(null);
          setUser(null);
          setProfile(null);
          queryClient.clear();
          clearBackupSession();
          finishInit();
          return;
        }

        // Unexpected SIGNED_OUT — likely a failed token refresh on mobile resume.
        // Try to recover from our backup session.
        console.warn("Unexpected SIGNED_OUT — attempting session recovery");
        const backup = loadBackupSession();
        if (backup && !recoveryInProgressRef.current) {
          recoveryInProgressRef.current = true;
          // Defer to avoid re-entrance in onAuthStateChange
          setTimeout(async () => {
            try {
              const { error: restoreError } = await supabase.auth.setSession({
                access_token: backup.access_token,
                refresh_token: backup.refresh_token,
              });
              if (restoreError) {
                console.error("Session recovery failed:", restoreError.message);
                if (mountedRef.current) {
                  setSession(null);
                  setUser(null);
                  setProfile(null);
                  queryClient.clear();
                  clearBackupSession();
                }
              }
              // If successful, onAuthStateChange will fire with the new session
            } catch (err) {
              console.error("Session recovery exception:", err);
              if (mountedRef.current) {
                setSession(null);
                setUser(null);
                setProfile(null);
                queryClient.clear();
                clearBackupSession();
              }
            } finally {
              recoveryInProgressRef.current = false;
            }
          }, 200);
        } else if (!backup) {
          // No backup to recover from — truly signed out
          setSession(null);
          setUser(null);
          setProfile(null);
          queryClient.clear();
          clearBackupSession();
        }
        finishInit();
        return;
      }

      if (event === "TOKEN_REFRESHED" && !newSession) {
        // Token refresh returned empty — this is often transient on mobile.
        // Don't wipe state; wait for the SDK to fire SIGNED_OUT if it's terminal.
        console.warn("TOKEN_REFRESHED with no session — ignoring (waiting for SIGNED_OUT if terminal)");
        finishInit();
        return;
      }

      // For all other events (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED),
      // update state from the new session
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        // Backup session tokens for recovery after spurious mobile SIGNED_OUT
        backupSession(newSession);
        // Mark init as done — we have a valid session from the SDK
        finishInit();

        if (newSession.user.email) {
          const p = await fetchProfile(newSession.user.email, newSession.user);
          if (mountedRef.current) setProfile(p);
        }
      } else if (event === "INITIAL_SESSION") {
        // INITIAL_SESSION with no session means either no stored session or
        // the refresh token was invalid/expired. Clear any state that may
        // have been set from stale cache and show the login screen.
        if (!initComplete) {
          setSession(null);
          setUser(null);
          setProfile(null);
          queryClient.clear();
        }
        finishInit();
      }
    });

    // Secondary validation: getUser() verifies the JWT server-side.
    // This catches edge cases where the stored JWT is invalid/revoked but
    // onAuthStateChange still loaded it from cache.
    // IMPORTANT: Only clear state if onAuthStateChange hasn't already set a user.
    supabase.auth.getUser()
      .then(async ({ data: { user: verifiedUser }, error: userError }) => {
        if (!mountedRef.current) return;

        if (userError || !verifiedUser) {
          // getUser() says the token is invalid/expired.
          // Do NOT fall back to getSession() — it returns unvalidated cached
          // data and can create a zombie state (authenticated UI, expired token).
          // Let onAuthStateChange be the sole authority for session restoration.
          if (initComplete) {
            // onAuthStateChange already handled init. If it set a valid refreshed
            // session, the getUser() error is stale (used old token). If the
            // session is truly dead, the SDK will fire SIGNED_OUT.
            console.warn("getUser() failed after init already complete — deferring to SDK:", userError?.message);
          } else {
            // Init not yet complete — onAuthStateChange(INITIAL_SESSION) will
            // fire shortly with either a refreshed session or null.
            console.warn("getUser() failed, waiting for onAuthStateChange:", userError?.message);
          }
          return;
        }

        // getUser() succeeded — if init already done by onAuthStateChange, skip
        if (initComplete) return;

        // Token is valid — now read the (refreshed) session for the JWT
        const { data: { session: freshSession } } = await supabase.auth.getSession();

        setSession(freshSession);
        setUser(verifiedUser);
        finishInit();

        if (verifiedUser.email) {
          const p = await fetchProfile(verifiedUser.email, verifiedUser);
          if (mountedRef.current) setProfile(p);
        }
      })
      .catch((err) => {
        console.error("Auth initialization error:", err);
        if (!mountedRef.current) return;

        // Network error during getUser() — don't fall back to getSession()
        // (which returns unvalidated cached data). Let onAuthStateChange
        // handle session restoration; the safety timeout catches edge cases.
        if (initComplete) {
          console.warn("getUser() network error after init complete — ignoring");
        } else {
          console.warn("getUser() network error, waiting for onAuthStateChange");
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
  }, [supabase, fetchProfile, queryClient, setProfile]); // Keep these dependencies

  // ── Visibility-based session recovery ──────────────────────────
  // When the app comes back from background on mobile, proactively
  // refresh the session.  This ensures the token is valid before any
  // data-fetching queries fire, and catches cases where the SDK's
  // internal auto-refresh already failed and emitted SIGNED_OUT.
  useEffect(() => {
    if (!supabase) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      if (isSigningOutRef.current || !mountedRef.current) return;

      // Check if we still have a session — if the SDK already wiped it,
      // attempt recovery from backup.
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession) {
        // Session present — proactively refresh to ensure the access token is fresh.
        // The SDK may skip its own refresh if the access token hasn't expired,
        // but on mobile resume the token may be very close to expiry.
        return;
      }

      // No current session — the SDK may have wiped it.  Try our backup.
      if (recoveryInProgressRef.current) return;
      const backup = loadBackupSession();
      if (backup) {
        console.warn("No session on foreground resume — restoring from backup");
        recoveryInProgressRef.current = true;
        try {
          const { error: restoreError } = await supabase.auth.setSession({
            access_token: backup.access_token,
            refresh_token: backup.refresh_token,
          });
          if (restoreError) {
            console.error("Foreground session restore failed:", restoreError.message);
            // Don't wipe state here — let the SIGNED_OUT handler deal with it
          }
        } catch (err) {
          console.error("Foreground session restore exception:", err);
        } finally {
          recoveryInProgressRef.current = false;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [supabase]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Authentication service not available") };

    fetchVersionRef.current++;
    setIsSigningOut(false);
    isSigningOutRef.current = false;

    // Clear any stale cache from previous session
    queryClient.clear();

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
        backupSession(data.session);
        const p = await fetchProfile(data.user.email, data.user);
        if (mountedRef.current) setProfile(p);
      }

      return { error: null };
    } catch (err) {
      console.error("Sign in exception:", err);
      return { error: err as Error };
    }
  }, [supabase, fetchProfile, queryClient, setProfile]);

  const signOut = useCallback(async () => {
    fetchVersionRef.current++;
    setIsSigningOut(true);
    isSigningOutRef.current = true;

    if (!supabase) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsLoading(false);
      clearBackupSession();
      return;
    }

    try {
      // Race signOut against a timeout to prevent hanging if the auth lock
      // is held by a stuck token refresh.
      const signOutResult = await Promise.race([
        supabase.auth.signOut({ scope: "local" }),
        new Promise<{ error: Error }>(resolve =>
          setTimeout(() => resolve({ error: new Error("Sign out timed out") }), 5000)
        ),
      ]);
      if (signOutResult.error) {
        console.error("Sign out error:", signOutResult.error);
      }
    } catch (err) {
      console.error("Sign out exception:", err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsLoading(false);
      // Clear stale query cache so re-login fetches fresh data
      queryClient.clear();
      // Ensure auth storage is cleared even if signOut() timed out,
      // so the stale session doesn't persist on next app open.
      clearBackupSession();
      try { localStorage.removeItem('mata-driver-auth'); } catch { /* ignore */ }
    }
  }, [supabase, queryClient, setProfile]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    profile,
    isLoading,
    isSigningOut,
    error,
    signIn,
    signOut,
    refreshProfile,
  }), [user, session, profile, isLoading, isSigningOut, error, signIn, signOut, refreshProfile]);

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