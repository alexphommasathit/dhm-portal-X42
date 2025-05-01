'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { User, Session } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  authLoaded: boolean
  profileLoaded: boolean
  error: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const supabase = createClientComponentClient<Database>();
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
  const fetchProfile = useCallback(async (userId: string) => {
    if (!userId) {
      console.warn('[fetchProfile] Called with no userId');
      setProfileLoaded(true); // Mark as loaded even if no user
      return;
    }

    console.log(`[fetchProfile] Fetching profile for user: ${userId}`);
    
    try {
      // First try direct fetch from profiles table - simpler approach to make sure it works
      console.log('[fetchProfile] Attempting direct fetch...');
      const { data: directData, error: directError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (directError) {
        if (directError.code === 'PGRST116') {
          // No profile found via direct query
          console.log('[fetchProfile] No profile found via direct query');
          
          // Attempt to create a profile if it doesn't exist
          console.log('[fetchProfile] Attempting to create a new profile...');
          try {
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                first_name: '',
                last_name: '',
                role: 'unassigned',
                updated_at: new Date().toISOString()
              });
              
            if (insertError) {
              console.error('[fetchProfile] Error creating profile:', insertError);
              setError('Failed to create user profile. Please contact support.');
              setProfile(null);
            } else {
              console.log('[fetchProfile] Profile created successfully, fetching new profile...');
              
              // Fetch the newly created profile after a short delay to allow for db propagation
              setTimeout(async () => {
                const { data: newProfile, error: fetchError } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', userId)
                  .single();
                  
                if (fetchError) {
                  console.error('[fetchProfile] Error fetching new profile:', fetchError);
                  setProfile(null);
                } else {
                  console.log('[fetchProfile] New profile fetched:', newProfile);
                  setProfile(newProfile);
                }
                setProfileLoaded(true);
              }, 500);
              return; // Exit early as we're handling the profile loaded state in the timeout
            }
          } catch (createErr: any) {
            console.error('[fetchProfile] Exception creating profile:', createErr);
            setError(`Error creating profile: ${createErr.message}`);
            setProfile(null);
          }
        } else {
          console.error('[fetchProfile] Direct fetch error:', directError);
          setError(`Failed to fetch profile: ${directError.message}`);
          setProfile(null);
        }
      } else if (directData) {
        console.log('[fetchProfile] Profile fetched via direct access:', directData);
        setProfile(directData);
      } else {
        // If we get here, no profile was found via either method
        console.warn('[fetchProfile] No profile found for user');
        setProfile(null);
      }
    } catch (err: any) {
      console.error('[fetchProfile] Catch block error:', err);
      setError(`Unexpected error fetching profile: ${err.message}`);
      setProfile(null); // Reset profile on error
    } finally {
      // Always mark profile as loaded unless we exited early
      setProfileLoaded(true);
    }
  }, [supabase]);

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
    } catch (err: any) {
      console.error('[refreshProfile] Error during refresh:', err);
      setError(`Refresh error: ${err.message}`);
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
    
    console.log("[AuthContext] Starting initialization...");
    setInitAttempted(true); // Mark that we've tried to initialize
    
    // 1. Get initial session
    const fetchInitialSession = async () => {
      try {
        console.log("[AuthContext] Fetching initial session...");
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("[AuthContext] Error fetching initial session:", sessionError);
          setError(`Session error: ${sessionError.message}`);
          setLoading(false);
          setAuthLoaded(true);
          setProfileLoaded(true);
          return;
        }
        
        const currentSession = data.session;
        console.log("[AuthContext] Initial session:", currentSession);
        
        // Always set auth as loaded after session check
        setAuthLoaded(true);
        
        // Set session state
        setSession(currentSession);
        
        // Handle user data
        const currentUser = currentSession?.user || null;
        console.log("[AuthContext] Current user:", currentUser?.id || "none");
        setUser(currentUser);

        // Fetch profile only if user exists
        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          console.log("[AuthContext] No user, skipping profile fetch");
          setProfileLoaded(true); // No user, so profile loading is "complete"
        }
        
        // Finish initialization
        setLoading(false);
        console.log("[AuthContext] Initialization complete");
      } catch (err: any) {
        console.error("[AuthContext] Initialization error:", err);
        setError(`Authentication error: ${err.message}`);
        setLoading(false);
        setAuthLoaded(true);
        setProfileLoaded(true);
      }
    };

    // Run initialization
    fetchInitialSession();

    // 2. Subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, changedSession) => {
        console.log('[AuthContext] Auth state change event:', event);
        
        // Always update session
        setSession(changedSession);
        
        // Get user from session
        const changedUser = changedSession?.user || null;
        
        // If user changed, update user state
        if (JSON.stringify(changedUser) !== JSON.stringify(user)) {
          console.log('[AuthContext] User changed:', changedUser?.id || "none");
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
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log("[AuthContext] Cleaning up auth listener");
      listener?.subscription.unsubscribe();
    };
  }, [initAttempted, user, fetchProfile, supabase.auth]);

  // Sign out function
  const signOut = async () => {
    console.log("[signOut] Initiating sign out...");
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err: any) {
      console.error("[signOut] Error signing out:", err);
      setError(`Sign out error: ${err.message}`);
    } finally {
      // Manually clear state in case event listener doesn't fire
      setUser(null);
      setProfile(null);
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