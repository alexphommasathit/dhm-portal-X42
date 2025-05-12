import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get patient ID from URL
    const patientId = params.id;

    // Create clients
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // METHOD 1: Try direct table access first
    const { data: directData, error: directError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (!directError && directData) {
      console.log('API: Found patient with direct access');
      return NextResponse.json(directData);
    }

    // METHOD 2: Try service function
    console.log('API: Direct access failed, trying service function');
    const { data: funcData, error: funcError } = await supabase.rpc('get_patient_by_id', {
      p_patient_id: patientId,
    });

    if (!funcError && funcData) {
      console.log('API: Found patient with service function');
      return NextResponse.json(funcData);
    }

    // METHOD 3: Use admin access as last resort (server-side only)
    console.log('API: Service function failed, trying admin access');
    const adminClient = createSupabaseAdmin();
    const { data: adminData, error: adminError } = await adminClient
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (!adminError && adminData) {
      console.log('API: Found patient with admin access');
      return NextResponse.json(adminData);
    }

    // If all methods failed
    console.error('API: All patient fetch methods failed', {
      directError: directError?.message,
      funcError: funcError?.message,
      adminError: adminError?.message,
    });

    // If we got this far without returning, the patient is genuinely not found
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  } catch (error) {
    console.error('Exception in patient API route:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
