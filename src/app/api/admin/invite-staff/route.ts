import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

// Define the schema for the request body, mirroring InviteStaffModal
const inviteStaffSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  // Ensure this enum/type matches the one in InviteStaffModal and your DB user_role enum
  role: z.string(), // For now, keeping it simple; ideally, use an enum shared with the frontend
  jobTitle: z.string().optional(), // Added jobTitle, optional
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(_name: string, _value: string, _options: CookieOptions) {},
        remove(_name: string, _options: CookieOptions) {},
      },
    }
  );
  const supabaseAdmin = createSupabaseAdmin();

  try {
    console.log('[Invite API] Route handler started.');
    // 1. Check user authentication and authorization
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Invite API] Authentication failed:', authError);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.log('[Invite API] Admin authenticated:', user.id);

    // Fetch the profile of the user making the request to check their role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[Invite API] Error fetching inviter profile:', profileError);
      return NextResponse.json({ error: 'Could not verify inviter permissions.' }, { status: 500 });
    }
    console.log('[Invite API] Admin profile fetched:', profile);

    // Authorization check: Only allow 'administrator' to invite staff
    if (profile.role !== 'administrator') {
      console.warn('[Invite API] Authorization failed. Admin role:', profile.role);
      // Ensure 'admin' is a valid role if used -- Comment no longer relevant
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to invite staff.' },
        { status: 403 }
      );
    }

    // 2. Parse and validate the request body
    console.log('[Invite API] Attempting to parse request body.');
    const body = await request.json();
    const parsedBody = inviteStaffSchema.safeParse(body);

    if (!parsedBody.success) {
      console.error('[Invite API] Invalid request body:', parsedBody.error.format());
      return NextResponse.json(
        { error: 'Invalid request body', details: parsedBody.error.format() },
        { status: 400 }
      );
    }

    const { email, firstName, lastName, role, jobTitle } = parsedBody.data;
    console.log('[Invite API] Request body parsed successfully. Data:', parsedBody.data);

    // 3. Use Supabase Admin Client to invite the user
    // The redirectTo URL should be a page in your app where users complete their signup
    // e.g., set password, confirm details.
    const redirectTo = new URL('/auth/confirm', request.url).toString();
    // Or your custom page: const redirectTo = new URL('/complete-invitation', request.url).toString();

    console.log(`[Invite API] Calling supabaseAdmin.auth.admin.inviteUserByEmail for ${email}`);
    // DEBUG: Only pass email and redirectTo, no custom data fields
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectTo,
        // data: {
        //   role: role,
        //   first_name: firstName,
        //   last_name: lastName,
        //   job_title: jobTitle,
        // },
      });

    if (inviteError) {
      console.error('[Invite API] Supabase Admin Invite Error:', inviteError);
      // Provide more specific error messages based on inviteError.message or inviteError.status if possible
      if (inviteError.message.includes('User already registered')) {
        return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 });
      }
      return NextResponse.json(
        { error: inviteError.message || 'Failed to send invitation.' },
        { status: 500 }
      );
    }

    console.log('[Invite API] Invitation successful. Invite data:', inviteData);
    // 4. Return success response
    return NextResponse.json({
      message: 'Invitation sent successfully.',
      userId: inviteData.user?.id,
    });
  } catch (error) {
    console.error('[Invite API] POST /api/admin/invite-staff Error:', error);
    let message = 'An unexpected error occurred.';
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
