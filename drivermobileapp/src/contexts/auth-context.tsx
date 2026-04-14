// src/contexts/auth-context.tsx
import { createClient } from "@/lib/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  persistSessionToIndexedDB,
  loadSessionFromIndexedDB,
  clearSessionFromIndexedDB,
  type SessionBackup,
} from "@/lib/session-persistence";

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

/** Backup session tokens to localStorage and IndexedDB */
async function backupSession(s: Session | null) {
  try {
    if (s?.refresh_token && s?.access_token) {
      const sessionData = {
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_at: s.expires_at,
        expires_in: s.expires_in,
        user: {
          id: s.user.id,
          email: s.user.email,
          user_metadata: s.user.user_metadata,
        }
      };

      // Store in localStorage for quick access
      localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(sessionData));

      // Store in IndexedDB for persistence
      await persistSessionToIndexedDB(sessionData);
    } else {
      localStorage.removeItem(SESSION_BACKUP_KEY);
      await clearSessionFromIndexedDB();
    }
  } catch { /* storage full / blocked */ }
}

async function loadBackupSession(): Promise<SessionBackup | null> {
  try {
    // Try IndexedDB first (more reliable)
    const indexedDBSession = await loadSessionFromIndexedDB();
    if (indexedDBSession?.access_token && indexedDBSession?.refresh_token) {
      return indexedDBSession;
    }

    // Fallback to localStorage
    const raw = localStorage.getItem(SESSION_BACKUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.access_token && parsed?.refresh_token) return parsed;
    }
  } catch { /* corrupted */ }
  return null;
}

async function clearBackupSession() {
  try {
    localStorage.removeItem(SESSION_BACKUP_KEY);
    await clearSessionFromIndexedDB();
  } catch { /* ignore */ }
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
    const loadingTimeout = setTimeout(() => {
      if (mountedRef.current && isLoadingRef.current) {
        console.warn("Auth init timeout — forcing loading = false");
        setIsLoading(false);
      }
    }, 10_000);

    let initComplete = false;

    const finishInit = () => {
      if (!initComplete && mountedRef.current) {
        initComplete = true;
        setIsLoading(false);
      }
    };

    const fetchVersion = fetchVersionRef;
    const initialFetchVersion = fetchVersion.current;

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;

      if (event === "SIGNED_OUT") {
        if (isSigningOutRef.current) {
          // Intentional sign-out — clear everything
          setSession(null);
          setUser(null);
          setProfile(null);
          queryClient.clear();
          await clearBackupSession();
          finishInit();
          return;
        }

        // Unexpected SIGNED_OUT — attempt session recovery
        console.warn("Unexpected SIGNED_OUT — attempting session recovery");
        const backup = await loadBackupSession();
        if (backup && !recoveryInProgressRef.current) {
          recoveryInProgressRef.current = true;
          setTimeout(async () => {
            if (!mountedRef.current || isSigningOutRef.current) {
              recoveryInProgressRef.current = false;
              return;
            }
            let recovered = false;
            for (let attempt = 0; attempt < 2; attempt++) {
              if (!mountedRef.current || isSigningOutRef.current) break;
              try {
                const { data: restored, error: restoreError } = await supabase.auth.setSession({
                  access_token: backup.access_token,
                  refresh_token: backup.refresh_token,
                });
                if (!restoreError && restored.session) {
                  console.log("Session recovered from backup (SIGNED_OUT handler), attempt", attempt + 1);
                  recovered = true;
                  break;
                }
                console.warn("Recovery attempt", attempt + 1, "failed:", restoreError?.message);
              } catch (err) {
                console.error("Recovery attempt", attempt + 1, "exception:", err);
              }
              if (attempt < 1) {
                await new Promise(r => setTimeout(r, 1500));
              }
            }
            if (!recovered && mountedRef.current && !isSigningOutRef.current) {
              console.error("All recovery attempts failed — clearing session");
              setSession(null);
              setUser(null);
              setProfile(null);
              queryClient.clear();
              await clearBackupSession();
            }
            if (recovered) {
              // Reset error state on all queries (e.g. 401s from stale token)
              // then invalidate so they refetch with the fresh access token.
              queryClient.resetQueries();
              queryClient.invalidateQueries({ refetchType: 'all' });
            }
            recoveryInProgressRef.current = false;
          }, 500);
        } else if (!backup) {
          setSession(null);
          setUser(null);
          setProfile(null);
          queryClient.clear();
          await clearBackupSession();
        }
        finishInit();
        return;
      }

      if (event === "TOKEN_REFRESHED" && !newSession) {
        console.warn("TOKEN_REFRESHED with no session — ignoring (waiting for SIGNED_OUT if terminal)");
        finishInit();
        return;
      }

      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        await backupSession(newSession);
        finishInit();

        if (newSession.user.email) {
          const p = await fetchProfile(newSession.user.email, newSession.user);
          if (mountedRef.current) setProfile(p);
        }
      } else if (event === "INITIAL_SESSION") {
        const backup = await loadBackupSession();
        if (backup && !recoveryInProgressRef.current) {
          console.warn("INITIAL_SESSION with no session — attempting recovery from backup");
          recoveryInProgressRef.current = true;
          try {
            const { data: restored, error: restoreError } = await supabase.auth.setSession({
              access_token: backup.access_token,
              refresh_token: backup.refresh_token,
            });
            if (restoreError || !restored.session) {
              console.error("Backup session restore failed on init:", restoreError?.message);
              if (mountedRef.current) {
                setSession(null);
                setUser(null);
                setProfile(null);
                queryClient.clear();
                await clearBackupSession();
              }
            }
          } catch (err) {
            console.error("Backup session restore exception on init:", err);
            if (mountedRef.current) {
              setSession(null);
              setUser(null);
              setProfile(null);
              queryClient.clear();
              await clearBackupSession();
            }
          } finally {
            recoveryInProgressRef.current = false;
          }
        } else if (!backup) {
          if (!initComplete) {
            setSession(null);
            setUser(null);
            setProfile(null);
            queryClient.clear();
          }
        }
        finishInit();
      }
    });

    supabase.auth.getUser()
      .then(async ({ data: { user: verifiedUser }, error: userError }) => {
        if (!mountedRef.current) return;

        if (userError || !verifiedUser) {
          if (initComplete) {
            console.warn("getUser() failed after init already complete — deferring to SDK:", userError?.message);
          } else {
            console.warn("getUser() failed, waiting for onAuthStateChange:", userError?.message);
          }
          return;
        }

        if (initComplete) return;

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

        if (initComplete) {
          console.warn("getUser() network error after init complete — ignoring");
        } else {
          console.warn("getUser() network error, waiting for onAuthStateChange");
        }
      });

    return () => {
      subscription.unsubscribe();
      mountedRef.current = false;
      clearTimeout(loadingTimeout);

      if (fetchVersion.current === initialFetchVersion) {
        fetchVersion.current++;
      }
    };
  }, [supabase, fetchProfile, queryClient, setProfile]);

  // Visibility-based session recovery
  useEffect(() => {
    if (!supabase) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      if (isSigningOutRef.current || !mountedRef.current) return;
      if (recoveryInProgressRef.current) return;

      await new Promise(r => setTimeout(r, 300));
      if (!mountedRef.current || isSigningOutRef.current) return;

      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession?.refresh_token) {
        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.warn("Proactive session refresh failed (non-fatal):", refreshError.message);
          } else {
            // Reset error state on queries that may have failed with 401
            // during the stale-token window, then refetch everything.
            queryClient.resetQueries();
            queryClient.invalidateQueries({ refetchType: 'all' });
          }
        } catch {
          // Network might not be ready yet — non-fatal
        }
        return;
      }

      const backup = await loadBackupSession();
      if (!backup) return;

      console.warn("No session on foreground resume — restoring from backup");
      recoveryInProgressRef.current = true;

      let recovered = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!mountedRef.current || isSigningOutRef.current) break;
        try {
          const { data: restored, error: restoreError } = await supabase.auth.setSession({
            access_token: backup.access_token,
            refresh_token: backup.refresh_token,
          });
          if (!restoreError && restored.session) {
            console.log("Session recovered from backup on attempt", attempt + 1);
            recovered = true;
            break;
          }
          if (attempt < 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        } catch (err) {
          console.error("Foreground session restore exception:", err);
          if (attempt < 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      if (recovered) {
        queryClient.resetQueries();
        queryClient.invalidateQueries({ refetchType: 'all' });
      }
      recoveryInProgressRef.current = false;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [supabase, queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Authentication service not available") };

    fetchVersionRef.current++;
    setIsSigningOut(false);
    isSigningOutRef.current = false;

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
        await backupSession(data.session);
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
      await clearBackupSession();
      return;
    }

    try {
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
      queryClient.clear();
      await clearBackupSession();
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