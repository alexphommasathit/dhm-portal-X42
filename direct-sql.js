// Execute SQL directly using the Postgres API
// Run with: node direct-sql.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// SQL statements to execute
const sqlStatements = [
  // 1. Check if patients table exists
  `SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'patients'
  );`,

  // 2. Create patients table if it doesn't exist
  `CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT,
    phone_number TEXT,
    email TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_by UUID,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT
  );`,

  // 3. Disable RLS on patients
  `ALTER TABLE IF EXISTS public.patients DISABLE ROW LEVEL SECURITY;`,

  // 4. Insert sample patient data - John Doe
  `INSERT INTO public.patients (id, first_name, last_name, date_of_birth, gender, is_active)
  SELECT 
    '58f699e3-b9ba-4e60-a5c0-429994228340'::uuid, 'John', 'Doe', '1980-01-01'::date, 'Male', TRUE
  WHERE 
    NOT EXISTS (SELECT 1 FROM public.patients WHERE id = '58f699e3-b9ba-4e60-a5c0-429994228340');`,

  // 5. Insert sample patient data - Jane Smith
  `INSERT INTO public.patients (id, first_name, last_name, date_of_birth, gender, is_active)
  SELECT 
    'c44f52c0-d2de-43b5-86c9-eb157306f7cb'::uuid, 'Jane', 'Smith', '1985-05-15'::date, 'Female', TRUE
  WHERE 
    NOT EXISTS (SELECT 1 FROM public.patients WHERE id = 'c44f52c0-d2de-43b5-86c9-eb157306f7cb');`,

  // 6. Create function to get patient by ID
  `CREATE OR REPLACE FUNCTION public.get_patient_by_id(p_patient_id UUID)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    patient_json JSONB;
  BEGIN
    SELECT row_to_json(p)::JSONB INTO patient_json
    FROM public.patients p
    WHERE p.id = p_patient_id;
    
    RETURN patient_json;
  END;
  $$;`,

  // 7. Grant permissions
  `GRANT USAGE ON SCHEMA public TO authenticated;`,
  `GRANT ALL ON public.patients TO authenticated;`,
  `GRANT EXECUTE ON FUNCTION public.get_patient_by_id(UUID) TO authenticated;`,

  // 8. Check for patients
  `SELECT * FROM public.patients;`,
];

// Execute each SQL statement one by one using the Postgres API
async function executeSQLStatements() {
  console.log('Database URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Service key available:', Boolean(process.env.PRIVATE_SUPABASE_SERVICE_KEY));

  for (let i = 0; i < sqlStatements.length; i++) {
    const sql = sqlStatements[i];
    console.log(`\n[${i + 1}/${sqlStatements.length}] Executing SQL: ${sql.substring(0, 60)}...`);

    try {
      // Use the Postgres API directly through Supabase client
      const { data, error } = await supabase.rpc('pg_query', { sql_query: sql });

      if (error) {
        console.error('  ❌ supabase.rpc Error:', error.message);
      } else {
        if (data && data.error_summary) {
          console.error('  ❌ pg_query Function Error Report:');
          console.error(JSON.stringify(data, null, 2));
        } else {
          console.log(
            '  ✅ pg_query Function Success:',
            data ? JSON.stringify(data).substring(0, 200) : 'No data returned (or null)'
          );
        }
      }
    } catch (err) {
      console.error('  ❌ Exception:', err.message);

      // If it's the first execution and we get a function not found error, try creating the function
      if (i === 0 && err.message.includes('pg_query')) {
        console.log('Creating pg_query function first...');
        try {
          const createFunctionSQL = `
          CREATE OR REPLACE FUNCTION pg_query(sql_query TEXT)
          RETURNS JSONB
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
            result JSONB;
          BEGIN
            EXECUTE sql_query INTO result;
            RETURN result;
          EXCEPTION WHEN OTHERS THEN
            RETURN jsonb_build_object('error', SQLERRM);
          END;
          $$;
          `;

          const { error: funcError } = await supabase.rpc('pg_query', {
            sql_query: createFunctionSQL,
          });

          if (funcError) {
            console.error('  ❌ Failed to create pg_query function:', funcError.message);
            if (funcError.message.includes('pg_query')) {
              console.log('Please run this SQL in Supabase SQL Editor instead:');
              console.log(createFunctionSQL);
            }
          } else {
            console.log('  ✅ Created pg_query function, retrying...');
            i--; // Retry the current statement
          }
        } catch (funcErr) {
          console.error('  ❌ Function creation exception:', funcErr.message);
        }
      }
    }
  }

  console.log('\nAll statements executed! Check for any errors above.');
  console.log('Restart your Next.js server and try the patient page again.');
}

executeSQLStatements();
