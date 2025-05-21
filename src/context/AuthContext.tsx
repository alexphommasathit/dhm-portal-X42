'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import { logoutUser } from '@/app/actions';

type Profile = Database['public']['Tables']['profiles']['Row'] & {
  employment_start_date?: string | null;
  avatar_url?: string | null;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  authLoaded: boolean;
  profileLoaded: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const supabase = createClientComponentSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initAttempted, setInitAttempted] = useState(false);

  // Add a safety timeout to ensure we never get stuck in loading state
  useEffect(() => {
    // If loading persists for more than 5 seconds, force it to complete
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('[AuthContext] Safety timeout triggered to prevent infinite loading');
        setLoading(false);
        setAuthLoaded(true);
        setProfileLoaded(true);

        if (!error) {
          setError('Authentication timed out. Please refresh the page.');
        }
      }
    }, 5000);

    return () => clearTimeout(safetyTimeout);
  }, [loading, error]);

  // Helper function to fetch profile using RPC first, with fallback to direct query
  const fetchProfile = useCallback(
    async (userId: string) => {
      if (!userId) {
        console.warn('[fetchProfile] Called with no userId');
        setProfileLoaded(true); // Mark as loaded even if no user
        return;
      }

      console.log(`[fetchProfile] Fetching profile for user: ${userId}`);
      setProfileLoaded(false); // Reset before fetching

      try {
        console.log('[fetchProfile] Attempting direct fetch by id...');
        const { data: directData, error: directError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId) // Query by id (matches auth.users.id)
          .single();

        if (directError) {
          if (directError.code === 'PGRST116') {
            // No profile found via direct query - this might indicate an issue with the trigger or replication delay
            console.warn(
              `[fetchProfile] No profile found for id: ${userId}. The backend trigger should have created one.`
            );
            setProfile(null); // Set profile to null as it was not found
            // setError('User profile not found. Please try refreshing or contact support if the issue persists.'); // Optional: inform user
          } else {
            // Other unexpected error during fetch
            console.error('[fetchProfile] Direct fetch error:', directError);
            setError(`Failed to fetch profile: ${directError.message}`);
            setProfile(null);
          }
        } else if (directData) {
          console.log('[fetchProfile] Profile fetched via id:', directData);
          setProfile(directData as Profile); // Explicitly cast to Profile type
        } else {
          // Should not happen if .single() is used and no error, but as a fallback
          console.warn(
            `[fetchProfile] No profile data returned for id: ${userId}, though no error was thrown.`
          );
          setProfile(null);
        }
      } catch (err) {
        console.error('[fetchProfile] Catch block error:', err);
        setError(
          `Unexpected error fetching profile: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        );
        setProfile(null); // Reset profile on error
      } finally {
        setProfileLoaded(true); // Always mark profile as loaded
      }
    },
    [supabase]
  );

  // Public method to manually refresh the profile
  const refreshProfile = useCallback(async () => {
    if (!user) {
      console.warn('[refreshProfile] Cannot refresh - no user logged in');
      return;
    }

    console.log('[refreshProfile] Manually refreshing profile');
    setLoading(true);
    setError(null);
    setProfileLoaded(false);

    try {
      await fetchProfile(user.id);
    } catch (err) {
      console.error('[refreshProfile] Error during refresh:', err);
      setError(`Refresh error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      // Ensure profileLoaded is set to true no matter what
      setProfileLoaded(true);
    }
  }, [user, fetchProfile]);

  // Effect for initial load and auth state changes
  useEffect(() => {
    if (initAttempted) {
      return; // Prevent multiple initialization attempts
    }

    console.log('[AuthContext] Starting initialization...');
    setInitAttempted(true); // Mark that we've tried to initialize

    // 1. Get initial session
    const fetchInitialSession = async () => {
      try {
        console.log('[AuthContext] Fetching initial session...');
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AuthContext] Error fetching initial session:', sessionError);
          setError(`Session error: ${sessionError.message}`);
          setLoading(false);
          setAuthLoaded(true);
          setProfileLoaded(true);
          return;
        }

        const currentSession = data.session;
        console.log('[AuthContext] Initial session:', currentSession);

        // Always set auth as loaded after session check
        setAuthLoaded(true);

        // Set session state
        setSession(currentSession);

        // Handle user data
        const currentUser = currentSession?.user || null;
        console.log('[AuthContext] Current user:', currentUser?.id || 'none');
        setUser(currentUser);

        // Fetch profile only if user exists
        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          console.log('[AuthContext] No user, skipping profile fetch');
          setProfileLoaded(true); // No user, so profile loading is "complete"
        }

        // Finish initialization
        setLoading(false);
        console.log('[AuthContext] Initialization complete');
      } catch (err) {
        console.error('[AuthContext] Initialization error:', err);
        setError(`Authentication error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
        setAuthLoaded(true);
        setProfileLoaded(true);
      }
    };

    // Run initialization
    fetchInitialSession();

    // 2. Subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, changedSession) => {
      console.log('[AuthContext] Auth state change event:', event);

      // Always update session
      setSession(changedSession);

      // Get user from session
      const changedUser = changedSession?.user || null;

      // If user changed, update user state
      if (JSON.stringify(changedUser) !== JSON.stringify(user)) {
        console.log('[AuthContext] User changed:', changedUser?.id || 'none');
        setUser(changedUser);
      }

      if (event === 'SIGNED_IN' && changedUser) {
        console.log('[AuthContext] Processing sign in event');
        setLoading(true);
        setProfileLoaded(false);

        try {
          await fetchProfile(changedUser.id);
        } catch (err) {
          console.error('[AuthContext] Error fetching profile after sign in:', err);
        } finally {
          setLoading(false);
          setProfileLoaded(true);
        }
      }

      if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] Processing sign out event');
        setUser(null);
        setProfile(null);
        setProfileLoaded(true);
        setLoading(false);
      }
    });

    // Cleanup listener on unmount
    return () => {
      console.log('[AuthContext] Cleaning up auth listener');
      listener?.subscription.unsubscribe();
    };
  }, [initAttempted, user, fetchProfile, supabase.auth]);

  // Sign out function
  const signOut = async () => {
    console.log('[signOut] Initiating sign out...');
    setLoading(true);
    try {
      // Use our server action for logout
      const result = await logoutUser();

      if (!result.success) {
        throw new Error(result.error);
      }

      // Clear state immediately after successful logout
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (err) {
      console.error('[signOut] Error signing out:', err);
      setError(`Sign out error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      // Ensure loading state is cleared
      setLoading(false);
      setProfileLoaded(true);
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    authLoaded,
    profileLoaded,
    error,
    refreshProfile,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {/* We could optionally show a global loading spinner here instead of in page.tsx 
          {loading ? <div>Global Loading...</div> : children} 
          For now, pages should handle their own loading state based on context.loading 
      */}
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the AuthContext
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
