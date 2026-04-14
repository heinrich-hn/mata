// src/hooks/use-app-state-recovery.ts
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { loadSessionFromIndexedDB } from '@/lib/session-persistence';
import { createClient } from '@/lib/supabase/client';

export function useAppStateRecovery() {
  const { user, profile } = useAuth();
  const recoveryAttempted = useRef(false);
  const lastRecoveryTime = useRef(0);
  
  useEffect(() => {
    const handleAppStateChange = async () => {
      // Don't attempt recovery if we already have a user
      if (user) return;
      
      // Throttle recovery attempts (max once every 30 seconds)
      const now = Date.now();
      if (now - lastRecoveryTime.current < 30000) {
        return;
      }
      
      if (recoveryAttempted.current) return;
      
      recoveryAttempted.current = true;
      lastRecoveryTime.current = now;
      
      try {
        console.log('Attempting app state recovery...');
        const supabase = createClient();
        
        // Try to load session from IndexedDB
        const savedSession = await loadSessionFromIndexedDB();
        
        if (savedSession?.refresh_token) {
          console.log('Found saved session, attempting recovery');
          
          // Attempt to restore the session
          const { data, error } = await supabase.auth.setSession({
            access_token: savedSession.access_token,
            refresh_token: savedSession.refresh_token,
          });
          
          if (error) {
            console.error('Session recovery failed:', error);
          } else if (data.session) {
            console.log('Session recovered successfully');
          }
        } else {
          console.log('No saved session found');
        }
      } catch (error) {
        console.error('App state recovery error:', error);
      } finally {
        recoveryAttempted.current = false;
      }
      
      // Reset recovery flag after a delay
      setTimeout(() => {
        recoveryAttempted.current = false;
      }, 5000);
    };
    
    // Listen for app state changes
    document.addEventListener('visibilitychange', handleAppStateChange);
    window.addEventListener('focus', handleAppStateChange);
    
    // Also attempt recovery on mount if no user
    if (!user) {
      handleAppStateChange();
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleAppStateChange);
      window.removeEventListener('focus', handleAppStateChange);
    };
  }, [user, profile]);
}