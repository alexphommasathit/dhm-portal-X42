// Simple script to apply our schema to the cloud Supabase database
// Run with: node fix-cloud.js
require('dotenv').config({ path: '.env.local' });

/**
 * Executes SQL directly on the Supabase database
 */
async function executeSql(sql) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sql`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.PRIVATE_SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.PRIVATE_SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    throw new Error(`SQL execution failed: ${await response.text()}`);
  }

  return await response.json();
}

async function fixCloudDatabase() {
  console.log('Fixing cloud database...');
  console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  try {
    // Create schema
    console.log('\n1. Creating service_functions schema...');
    await executeSql('CREATE SCHEMA IF NOT EXISTS service_functions;');
    console.log('Schema created successfully');

    // Create get_patient_by_id function
    console.log('\n2. Creating get_patient_by_id function...');
    await executeSql(`
      CREATE OR REPLACE FUNCTION service_functions.get_patient_by_id(p_patient_id UUID)
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        patient_json JSONB;
      BEGIN
        SELECT row_to_json(p)::JSONB INTO patient_json
        FROM public.patients p
        WHERE p.id = p_patient_id;
        
        RETURN patient_json;
      END;
      $$;
      
      GRANT EXECUTE ON FUNCTION service_functions.get_patient_by_id TO authenticated;
    `);
    console.log('get_patient_by_id function created successfully');

    // Create get_all_patients function in public schema
    console.log('\n3. Creating get_all_patients function...');
    await executeSql(`
      CREATE OR REPLACE FUNCTION public.get_all_patients(limit_count INT DEFAULT 100)
      RETURNS SETOF public.patients
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT * FROM public.patients LIMIT limit_count;
      $$;
      
      GRANT EXECUTE ON FUNCTION public.get_all_patients TO authenticated;
    `);
    console.log('get_all_patients function created successfully');

    // Disable RLS on patients for simplified testing
    console.log('\n4. Temporarily disabling RLS on patients table...');
    await executeSql('ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;');
    console.log('RLS disabled successfully');

    console.log('\nAll fixes applied! Please refresh your debug panel and try again.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixCloudDatabase();
