import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Types for better error handling
type DatabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  [key: string]: any;
};

// Create a Supabase client with the service role key for admin access
const createServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.PRIVATE_SUPABASE_SERVICE_KEY || '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
};

// Create a normal Supabase client that respects user permissions
const createNormalClient = (cookieStore: ReturnType<typeof cookies>) => {
  const cookieString = cookieStore.toString();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          cookie: cookieString,
        },
      },
    }
  );
};

export async function GET(request: Request) {
  try {
    // Extract query parameters
    const url = new URL(request.url);
    const table = url.searchParams.get('table') || 'patients';
    const id = url.searchParams.get('id');
    const bypassRLS = url.searchParams.get('bypass') === 'true';
    const useServiceFunction = url.searchParams.get('service') === 'true';

    // Log request details
    console.log('DB Access - URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log(
      'Table:',
      table,
      'ID:',
      id,
      'Bypass RLS:',
      bypassRLS,
      'Use Service:',
      useServiceFunction
    );

    // Create appropriate Supabase client based on request
    const supabaseClient = bypassRLS ? createServiceClient() : createNormalClient(cookies());

    let data = null;
    let error: DatabaseError | null = null;

    // APPROACH 1: Try service functions if specified
    if (useServiceFunction && table === 'patients' && id) {
      try {
        console.log('Using service_functions.get_patient_by_id');
        const { data: functionData, error: functionError } = await supabaseClient.rpc(
          'get_patient_by_id',
          { p_patient_id: id }
        );

        if (!functionError) {
          data = functionData;
          return NextResponse.json({
            success: true,
            data,
            method: 'service_function',
            connectionInfo: {
              url: process.env.NEXT_PUBLIC_SUPABASE_URL,
              hasServiceKey: bypassRLS,
            },
          });
        } else {
          console.error('Service function error:', functionError);
          error = functionError as DatabaseError;
        }
      } catch (err) {
        console.error('Failed to use service function:', err);
      }
    }

    // APPROACH 2: Use direct SQL access if service function wasn't used or failed
    try {
      console.log('Using direct table access');
      console.log('Connection URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('Service Key Available:', Boolean(process.env.PRIVATE_SUPABASE_SERVICE_KEY));

      let query = supabaseClient.from(table).select('*');

      // Apply ID filter if provided
      if (id) {
        query = query.eq('id', id);
      } else {
        // Otherwise limit to prevent large result sets
        query = query.limit(20);
      }

      const { data: tableData, error: tableError } = await query;

      if (!tableError) {
        data = tableData;
      } else if (!error) {
        // Only set this error if we don't already have one from service functions
        error = tableError as DatabaseError;
        console.error('Table access error details:', {
          message: tableError.message,
          code: tableError.code,
          details: tableError.details,
          hint: tableError.hint,
        });
      }
    } catch (err) {
      console.error('Direct table access error:', err);
      if (!error && err instanceof Error) {
        error = { message: err.message };
      }
    }

    // Handle errors
    if (error) {
      console.error('Database access error:', error);

      // Check for RLS policy violation
      if (error.code === '42501' || error.message.includes('permission denied')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Permission denied - RLS policy violation',
            details: error,
            resolution: 'Try using ?bypass=true or ?service=true to bypass RLS',
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Unknown database error',
          details: error,
        },
        { status: 500 }
      );
    }

    // Handle no data found
    if (!data || (Array.isArray(data) && data.length === 0)) {
      // Check if table exists
      try {
        const adminClient = createServiceClient();
        const { data: tableResult, error: tableError } = await adminClient
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', table);

        // Improved table detection logic
        if (tableError || !tableResult || tableResult.length === 0) {
          console.log('Table check failed:', tableError);

          // Try direct SQL query to check tables
          try {
            const { data: directTableCheck } = await adminClient.rpc('get_all_patients', {
              limit_count: 1,
            });
            if (directTableCheck && directTableCheck.length > 0) {
              // The table exists but we might have permission issues
              return NextResponse.json(
                {
                  success: false,
                  error: `Table '${table}' exists but is not accessible due to permissions`,
                  details: { table, exists: true, permissions: false },
                },
                { status: 403 }
              );
            }
          } catch (innerErr) {
            // Function call failed too
            console.error('Function check failed:', innerErr);
          }

          return NextResponse.json(
            {
              success: false,
              error: `Table '${table}' does not exist or is not accessible`,
              details: {
                table,
                exists: false,
                env: {
                  hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
                  hasServiceKey: Boolean(process.env.PRIVATE_SUPABASE_SERVICE_KEY),
                },
              },
            },
            { status: 404 }
          );
        }
      } catch (_err) {
        // Continue - we'll report no data found
      }

      // No data found but table exists
      return NextResponse.json({
        success: true,
        data: [],
        message: id ? `No ${table} found with ID ${id}` : `No ${table} records found`,
        connectionInfo: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          bypassRLS,
          useServiceFunction,
        },
      });
    }

    // Return successful response with data
    return NextResponse.json({
      success: true,
      data,
      connectionInfo: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        bypassRLS,
        useServiceFunction,
      },
    });
  } catch (error) {
    console.error('Unhandled error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
