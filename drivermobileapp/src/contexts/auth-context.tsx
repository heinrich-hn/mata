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
import { diagLogger } from "@/lib/error-logger";

// ─── Debug Logger ────────────────────────────────────────────────────────────
const DEBUG_AUTH = true;

const authLogger = {
  info: (message: string, data?: unknown) => {
    if (!DEBUG_AUTH) return;
    console.log(`🔐 [AUTH][INFO] ${message}`, data ?? '');
  },
  warn: (message: string, data?: unknown) => {
    if (!DEBUG_AUTH) return;
    console.warn(`⚠️ [AUTH][WARN] ${message}`, data ?? '');
  },
  error: (message: string, data?: unknown) => {
    if (!DEBUG_AUTH) return;
    console.error(`❌ [AUTH][ERROR] ${message}`, data ?? '');
  },
  debug: (message: string, data?: unknown) => {
    if (!DEBUG_AUTH) return;
    console.debug(`🐛 [AUTH][DEBUG] ${message}`, data ?? '');
  },
};
// ─────────────────────────────────────────────────────────────────────────────

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
  /** Timestamp of the last queryClient.invalidateQueries() call.
   *  Used to throttle multiple rapid auth events (SIGNED_IN, TOKEN_REFRESHED,
   *  visibility change) from each triggering a full cache flush. */
  const lastInvalidateRef = useRef(0);
  const INVALIDATE_COOLDOWN_MS = 10_000; // 10 s

  /** Throttled invalidateQueries — skips if called again within the cooldown. */
  const throttledInvalidate = useCallback(() => {
    const now = Date.now();
    if (now - lastInvalidateRef.current < INVALIDATE_COOLDOWN_MS) {
      authLogger.debug('invalidateQueries skipped (cooldown)', {
        msSinceLast: now - lastInvalidateRef.current,
      });
      return;
    }
    lastInvalidateRef.current = now;
    authLogger.info('invalidateQueries — executing');
    queryClient.invalidateQueries();
  }, [queryClient]);

  // Keep isLoadingRef in sync
  isLoadingRef.current = isLoading;

  // Memoize Supabase client creation
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch (err) {
      authLogger.error("Failed to initialize Supabase client", err);
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

  // ─── Debug: Supabase init diagnostics ──────────────────────────────────────
  useEffect(() => {
    if (!supabase) {
      authLogger.error('Supabase client is null!');
      return;
    }

    authLogger.info('Supabase client initialized');

    // Expose supabase to the global debugApp() so it can inspect the live SDK session
    const win = window as unknown as { __SUPABASE_CLIENT__?: typeof supabase };
    win.__SUPABASE_CLIENT__ = supabase;

    // Log environment
    authLogger.debug('Environment check', {
      hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
      hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      mode: import.meta.env.MODE,
    });

    // Check current session
    const checkInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        const detail = {
          hasSession: !!session,
          error: error?.message,
          userId: session?.user?.id,
          email: session?.user?.email,
          expiresAt: session?.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : null,
        };
        authLogger.info('Initial session check', detail);
        diagLogger.authEvent('INIT_SESSION_CHECK', detail);

        // Also run full storage check
        const storageReport = await diagLogger.checkStorage();
        authLogger.debug('Storage diagnostic', storageReport);

        // Check localStorage keys
        const authKeys = Object.keys(localStorage).filter(k =>
          k.includes('mata') || k.includes('supabase') || k.includes('auth')
        );
        authLogger.debug('Storage keys', { keys: authKeys });

        // Check for corrupt data — only test keys that should be JSON
        for (const key of authKeys) {
          try {
            const value = localStorage.getItem(key);
            if (value && value.startsWith('{') || value?.startsWith('[')) {
              JSON.parse(value!);
            }
          } catch (e) {
            authLogger.error(`Corrupt storage key: ${key}`, e);
          }
        }
      } catch (err) {
        authLogger.error('Session check failed', err);
      }
    };

    // Defer the initial session check so it doesn't compete for the
    // gotrue auth lock during initialisation.
    setTimeout(() => checkInitialSession(), 2000);
  }, [supabase]);
  // ───────────────────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async (
    userEmail: string | undefined,
    authUser?: User | null,
  ): Promise<Profile | null> => {
    if (!userEmail || !supabase || !mountedRef.current) return null;

    const thisVersion = ++fetchVersionRef.current;
    authLogger.debug('fetchProfile called', { userEmail, version: thisVersion });

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
        authLogger.error("Profile query error", queryError);
        return authUser ? buildFallbackProfile(userEmail, authUser) : null;
      }

      if (!data) {
        authLogger.warn("No profile data found — using fallback", { userEmail });
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

      const profile: Profile = {
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

      authLogger.info("Profile fetched successfully", {
        user_id: profile.user_id,
        username: profile.username,
        role: profile.role,
      });

      return profile;
    } catch (err) {
      if (err instanceof Error && (err.name === "AbortError" || err.name === "DOMException")) {
        return null;
      }
      if (fetchVersionRef.current !== thisVersion || !mountedRef.current) return null;

      authLogger.error("Error fetching profile", err);
      return authUser ? buildFallbackProfile(userEmail, authUser) : null;
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user?.email && mountedRef.current) {
      authLogger.debug('refreshProfile triggered', { email: user.email });
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
        authLogger.warn("Auth init timeout — forcing loading = false");
        setIsLoading(false);
      }
    }, 10_000);

    let initComplete = false;

    const finishInit = () => {
      if (!initComplete && mountedRef.current) {
        initComplete = true;
        authLogger.debug('finishInit called — setting isLoading = false');
        diagLogger.authEvent('FINISH_INIT');
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

      authLogger.info(`onAuthStateChange: ${event}`, {
        hasSession: !!newSession,
        userId: newSession?.user?.id,
        email: newSession?.user?.email,
        expiresAt: newSession?.expires_at
          ? new Date(newSession.expires_at * 1000).toISOString()
          : null,
      });
      diagLogger.authEvent(`onAuthStateChange:${event}`, {
        hasSession: !!newSession,
        userId: newSession?.user?.id,
      });

      if (event === "SIGNED_OUT") {
        if (isSigningOutRef.current) {
          authLogger.info("Intentional sign-out — clearing state");
          setSession(null);
          setUser(null);
          setProfile(null);
          queryClient.clear();
          await clearBackupSession();
          finishInit();
          return;
        }

        authLogger.warn("Unexpected SIGNED_OUT — attempting session recovery");
        const backup = await loadBackupSession();
        authLogger.debug('Backup session found?', { hasBackup: !!backup });

        if (backup && !recoveryInProgressRef.current) {
          recoveryInProgressRef.current = true;
          setTimeout(async () => {
            if (!mountedRef.current || isSigningOutRef.current) {
              recoveryInProgressRef.current = false;
              finishInit();
              return;
            }
            let recovered = false;
            for (let attempt = 0; attempt < 2; attempt++) {
              if (!mountedRef.current || isSigningOutRef.current) break;
              try {
                authLogger.debug(`Recovery attempt ${attempt + 1} (SIGNED_OUT handler)`);
                const { data: restored, error: restoreError } = await supabase.auth.setSession({
                  access_token: backup.access_token,
                  refresh_token: backup.refresh_token,
                });
                if (!restoreError && restored.session?.user) {
                  authLogger.info(`Session recovered from backup (SIGNED_OUT handler), attempt ${attempt + 1}`);
                  if (mountedRef.current) {
                    setSession(restored.session);
                    setUser(restored.session.user);
                    await backupSession(restored.session);
                    if (restored.session.user.email) {
                      const p = await fetchProfile(restored.session.user.email, restored.session.user);
                      if (mountedRef.current) setProfile(p);
                    }
                  }
                  recovered = true;
                  break;
                }
                authLogger.warn(`Recovery attempt ${attempt + 1} failed`, { error: restoreError?.message });
              } catch (err) {
                authLogger.error(`Recovery attempt ${attempt + 1} exception`, err);
              }
              if (attempt < 1) {
                await new Promise(r => setTimeout(r, 1500));
              }
            }
            if (!recovered && mountedRef.current && !isSigningOutRef.current) {
              authLogger.warn("Recovery failed (likely offline) — keeping backup for later retry");
              setSession(null);
              setUser(null);
              setProfile(null);
            }
            if (recovered) {
              throttledInvalidate();
            }
            recoveryInProgressRef.current = false;
            finishInit();
          }, 500);
        } else if (!backup) {
          authLogger.warn("No backup session available — clearing state");
          setSession(null);
          setUser(null);
          setProfile(null);
          queryClient.clear();
          await clearBackupSession();
          finishInit();
        }
        return;
      }

      if (event === "TOKEN_REFRESHED" && !newSession) {
        authLogger.warn("TOKEN_REFRESHED with no session — ignoring");
        finishInit();
        return;
      }

      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        await backupSession(newSession);
        finishInit();

        // IMPORTANT: Defer query invalidation and profile fetch so they run
        // AFTER the onAuthStateChange callback returns. The gotrue SDK fires
        // this callback while holding an internal auth lock. If we call
        // queryClient.invalidateQueries() synchronously, every TanStack Query
        // triggers getSession() which tries to acquire the same lock → deadlock
        // until the 5 s timeout fires. Using setTimeout(0) lets the callback
        // return first, releasing the lock, so queries proceed immediately.
        const deferredUser = newSession.user;
        const deferredEvent = event;
        setTimeout(() => {
          if (!mountedRef.current) return;
          if (deferredEvent === "TOKEN_REFRESHED" || deferredEvent === "SIGNED_IN") {
            authLogger.info(`${deferredEvent} — invalidating queries (deferred)`);
            diagLogger.authEvent(`INVALIDATE_QUERIES:${deferredEvent}`);
            throttledInvalidate();
          }
          if (deferredUser.email) {
            fetchProfile(deferredUser.email, deferredUser).then(p => {
              if (mountedRef.current) setProfile(p);
            });
          }
        }, 0);
      } else if (event === "INITIAL_SESSION") {
        authLogger.warn("INITIAL_SESSION with no session — attempting recovery from backup");
        const backup = await loadBackupSession();
        authLogger.debug('Backup session found?', { hasBackup: !!backup });

        if (backup && !recoveryInProgressRef.current) {
          recoveryInProgressRef.current = true;
          try {
            authLogger.debug('Attempting backup session restore on init');
            const { data: restored, error: restoreError } = await supabase.auth.setSession({
              access_token: backup.access_token,
              refresh_token: backup.refresh_token,
            });
            if (!restoreError && restored.session?.user && mountedRef.current) {
              authLogger.info("Backup session restored on init successfully");
              setSession(restored.session);
              setUser(restored.session.user);
              await backupSession(restored.session);
              finishInit();
              // Defer profile fetch — same lock-avoidance reason
              const restoredUser = restored.session.user;
              setTimeout(() => {
                if (restoredUser.email && mountedRef.current) {
                  fetchProfile(restoredUser.email, restoredUser).then(p => {
                    if (mountedRef.current) setProfile(p);
                  });
                }
              }, 0);
            } else if (restoreError || !restored.session) {
              authLogger.error("Backup session restore failed on init", { error: restoreError?.message });
              if (mountedRef.current) {
                setSession(null);
                setUser(null);
                setProfile(null);
                queryClient.clear();
                await clearBackupSession();
              }
              finishInit();
            }
          } catch (err) {
            authLogger.error("Backup session restore exception on init", err);
            if (mountedRef.current) {
              setSession(null);
              setUser(null);
              setProfile(null);
              queryClient.clear();
              await clearBackupSession();
            }
            finishInit();
          } finally {
            recoveryInProgressRef.current = false;
          }
        } else if (!backup) {
          authLogger.debug('No backup and no session on INITIAL_SESSION — user is logged out');
          if (!initComplete) {
            setSession(null);
            setUser(null);
            setProfile(null);
            queryClient.clear();
          }
          finishInit();
        }
      }
    });

    // NOTE: We intentionally do NOT call supabase.auth.getUser() here.
    // getUser() makes a network request to /auth/v1/user.  With async
    // custom storage the SDK hasn't loaded the session yet when the
    // effect fires, so getUser() always fails with "Auth session missing!"
    // and then races with onAuthStateChange(INITIAL_SESSION).  The
    // INITIAL_SESSION handler already covers every case (valid session,
    // expired session with backup recovery, and no session at all).

    return () => {
      subscription.unsubscribe();
      mountedRef.current = false;
      clearTimeout(loadingTimeout);

      if (fetchVersion.current === initialFetchVersion) {
        fetchVersion.current++;
      }
    };
  }, [supabase, fetchProfile, queryClient, setProfile, throttledInvalidate]);

  // Visibility-based session recovery
  useEffect(() => {
    if (!supabase) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      if (isSigningOutRef.current || !mountedRef.current) return;
      if (recoveryInProgressRef.current) return;

      authLogger.debug('App foregrounded — checking session');
      diagLogger.authEvent('VISIBILITY_FOREGROUND');

      await new Promise(r => setTimeout(r, 300));
      if (!mountedRef.current || isSigningOutRef.current) return;

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        authLogger.debug('Foreground session check', { hasSession: !!currentSession });

        if (currentSession?.refresh_token) {
          try {
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              authLogger.warn("Proactive session refresh failed (non-fatal)", { error: refreshError.message });
            } else {
              authLogger.info("Proactive session refresh succeeded");
            }
            // refreshSession() fires TOKEN_REFRESHED via onAuthStateChange,
            // which already handles invalidation + fetchProfile (deferred).
            // Just update local state here; skip duplicate invalidation.
            const activeSession = refreshed?.session ?? currentSession;
            if (activeSession?.user && mountedRef.current) {
              setSession(activeSession);
              setUser(activeSession.user);
              await backupSession(activeSession);
            }
          } catch {
            // Network might not be ready yet — non-fatal
          }
          return;
        }
      } catch {
        // getSession() might fail — fall through to backup recovery
      }

      authLogger.warn("No session on foreground resume — restoring from backup");
      const backup = await loadBackupSession();
      if (!backup) {
        authLogger.warn("No backup session available on foreground resume");
        return;
      }

      recoveryInProgressRef.current = true;

      let recovered = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!mountedRef.current || isSigningOutRef.current) break;
        try {
          authLogger.debug(`Foreground recovery attempt ${attempt + 1}`);
          const { data: restored, error: restoreError } = await supabase.auth.setSession({
            access_token: backup.access_token,
            refresh_token: backup.refresh_token,
          });
          if (!restoreError && restored.session?.user) {
            authLogger.info(`Session recovered from backup on foreground attempt ${attempt + 1}`);
            if (mountedRef.current) {
              setSession(restored.session);
              setUser(restored.session.user);
              await backupSession(restored.session);
              if (restored.session.user.email) {
                const p = await fetchProfile(restored.session.user.email, restored.session.user);
                if (mountedRef.current) setProfile(p);
              }
            }
            recovered = true;
            break;
          }
          authLogger.warn(`Foreground recovery attempt ${attempt + 1} failed`, { error: restoreError?.message });
          if (attempt < 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        } catch (err) {
          authLogger.error("Foreground session restore exception", err);
          if (attempt < 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      if (recovered) {
        throttledInvalidate();
      }
      recoveryInProgressRef.current = false;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [supabase, throttledInvalidate, fetchProfile, setProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Authentication service not available") };

    authLogger.info("signIn called", { email });
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
        authLogger.error("Sign in error", { message: signInError.message });
        return { error: signInError as Error };
      }

      authLogger.info("Sign in successful", { userId: data.user?.id, email: data.user?.email });

      if (data.user && data.session && mountedRef.current) {
        setUser(data.user);
        setSession(data.session);
        await backupSession(data.session);
        const p = await fetchProfile(data.user.email, data.user);
        if (mountedRef.current) setProfile(p);
      }

      return { error: null };
    } catch (err) {
      authLogger.error("Sign in exception", err);
      return { error: err as Error };
    }
  }, [supabase, fetchProfile, queryClient, setProfile]);

  const signOut = useCallback(async () => {
    authLogger.info("signOut called");
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
        authLogger.error("Sign out error", signOutResult.error);
      } else {
        authLogger.info("Sign out completed successfully");
      }
    } catch (err) {
      authLogger.error("Sign out exception", err);
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

// Fallback value returned when useAuth is called outside an AuthProvider.
// This can happen transiently during HMR in dev or during a render cycle
// while React is reconciling providers.  The loading state ensures
// ProtectedRoute shows a spinner instead of crashing.
const AUTH_FALLBACK: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isSigningOut: false,
  error: null,
  signIn: async () => ({ error: new Error("Auth not available") }),
  signOut: async () => { },
  refreshProfile: async () => { },
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Warn instead of crashing — lets the UI show a spinner while React
    // catches up with the provider tree.
    if (import.meta.env.DEV) {
      console.warn("useAuth: context is undefined — AuthProvider may be missing or HMR is active");
    }
    return AUTH_FALLBACK;
  }
  return context;
}