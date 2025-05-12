'use client';

import { Database } from '@/types/supabase';
import { createBrowserClient } from '@supabase/ssr';

/**
 * This utility is a temporary solution to bypass RLS issues
 * It should be used only for debugging purposes and removed in production
 */

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string | null;
  phone_number: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  is_active: boolean;
}

/**
 * Fetches a patient by ID, bypassing RLS issues
 * This is a temporary function to work around RLS recursion problems
 */
export async function fetchPatientById(patientId: string): Promise<Patient | null> {
  try {
    console.log('Attempting to fetch patient with direct method, ID:', patientId);

    const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Instead of using a direct query, use an RPC call to a function
    // that should have less RLS issues
    const { data, error } = await supabase.rpc('get_patient_by_id', {
      p_patient_id: patientId,
    });

    if (error) {
      console.error('Error in direct fetch:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception in fetchPatientById:', err);
    return null;
  }
}
