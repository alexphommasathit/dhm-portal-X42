import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Define a list of roles that are NOT considered staff for filtering purposes
const NON_STAFF_ROLES = ['patient', 'family_contact', 'unassigned'];

export async function GET() {
  console.log('API /admin/staff: GET handler started (with full logic)');
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {},
          remove(name, options) {},
        },
      }
    );
    console.log('API /admin/staff: Supabase client created with @supabase/ssr');

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log(
      'API /admin/staff getUser data (@supabase/ssr):',
      JSON.stringify({ user }, null, 2)
    );
    console.log(
      'API /admin/staff getUser error (@supabase/ssr):',
      JSON.stringify(authError, null, 2)
    );

    if (authError || !user) {
      console.error('API /admin/staff: Authentication failed (@supabase/ssr).', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.log(`API /admin/staff: User ${user.email} authenticated.`);

    // Fetch the user's profile to check their role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id) // Update to use 'id' column
      .single();

    if (profileError || !profile) {
      console.error(`Error fetching profile for user ${user.id}:`, profileError);
      return NextResponse.json(
        { error: 'Could not verify user permissions. Profile not found or error.' },
        { status: 500 }
      );
    }
    console.log(`API /admin/staff: Profile fetched for ${user.email}, role: ${profile.role}`);

    // Authorization check: Only allow 'administrator' to fetch staff list
    if (profile.role !== 'administrator') {
      console.warn(
        `API /admin/staff: User ${user.email} with role ${profile.role} is not authorized.`
      );
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view staff.' },
        { status: 403 }
      );
    }
    console.log(`API /admin/staff: User ${user.email} is authorized as ${profile.role}.`);

    // Fetch staff profiles, excluding non-staff roles
    const { data: staffList, error: staffListError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, job_title')
      .not('role', 'in', `(${NON_STAFF_ROLES.join(',')})`);

    if (staffListError) {
      console.error('Error fetching staff list:', staffListError);
      return NextResponse.json(
        { error: staffListError.message || 'Failed to fetch staff list.' },
        { status: 500 }
      );
    }
    console.log(`API /admin/staff: Fetched ${staffList.length} staff members.`);

    const staffWithStatus = staffList.map(staff => ({
      ...staff,
      status: 'Active', // Placeholder
    }));

    return NextResponse.json(staffWithStatus);
  } catch (e) {
    console.error('Critical error in GET /api/admin/staff:', e);
    return NextResponse.json(
      {
        error: 'Internal server error during API execution',
        message: (e as Error)?.message,
      },
      { status: 500 }
    );
  }
}
