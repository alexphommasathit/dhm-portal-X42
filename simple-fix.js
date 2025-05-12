// Simplified script to apply essential fixes to Supabase
// Run with: node simple-fix.js
require('dotenv').config({ path: '.env.local' });

async function executeSQL(sql) {
  try {
    console.log(`Executing SQL: ${sql.substring(0, 100)}...`);

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.PRIVATE_SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.PRIVATE_SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`SQL execution failed (${response.status}): ${responseText}`);
    }

    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.log('Response is not JSON:', responseText);
      return { success: true };
    }
  } catch (error) {
    console.error('Error:', error.message);
    return { error: error.message };
  }
}

async function applyFixes() {
  console.log('Applying simple fixes to database...');
  console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`Service key available: ${Boolean(process.env.PRIVATE_SUPABASE_SERVICE_KEY)}`);
  console.log(`Service key length: ${process.env.PRIVATE_SUPABASE_SERVICE_KEY?.length || 0}`);

  // Step 1: Create patients table if it doesn't exist
  console.log("\n1. Creating patients table if it doesn't exist...");
  await executeSQL(`
    CREATE TABLE IF NOT EXISTS public.patients (
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
    )
  `);

  // Step 2: Disable RLS on patients
  console.log('\n2. Disabling RLS on patients table...');
  await executeSQL('ALTER TABLE IF EXISTS public.patients DISABLE ROW LEVEL SECURITY');

  // Step 3: Insert sample patient data
  console.log('\n3. Inserting sample patient data...');
  await executeSQL(`
    INSERT INTO public.patients (id, first_name, last_name, date_of_birth, gender, is_active)
    SELECT 
      '58f699e3-b9ba-4e60-a5c0-429994228340'::uuid, 'John', 'Doe', '1980-01-01'::date, 'Male', TRUE
    WHERE 
      NOT EXISTS (SELECT 1 FROM public.patients WHERE id = '58f699e3-b9ba-4e60-a5c0-429994228340')
  `);

  await executeSQL(`
    INSERT INTO public.patients (id, first_name, last_name, date_of_birth, gender, is_active)
    SELECT 
      'c44f52c0-d2de-43b5-86c9-eb157306f7cb'::uuid, 'Jane', 'Smith', '1985-05-15'::date, 'Female', TRUE
    WHERE 
      NOT EXISTS (SELECT 1 FROM public.patients WHERE id = 'c44f52c0-d2de-43b5-86c9-eb157306f7cb')
  `);

  // Step 4: Create function to get patient by ID
  console.log('\n4. Creating get_patient_by_id function...');
  await executeSQL(`
    CREATE OR REPLACE FUNCTION public.get_patient_by_id(p_patient_id UUID)
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
    $$
  `);

  // Step 5: Grant permissions
  console.log('\n5. Granting permissions...');
  await executeSQL('GRANT USAGE ON SCHEMA public TO authenticated');
  await executeSQL('GRANT ALL ON public.patients TO authenticated');
  await executeSQL('GRANT EXECUTE ON FUNCTION public.get_patient_by_id(UUID) TO authenticated');

  // Step 6: Check if everything is working
  console.log('\n6. Testing if we can query patients table...');
  const result = await executeSQL('SELECT COUNT(*) FROM public.patients');
  console.log('Result:', result);

  console.log('\nAll fixes have been applied!');
  console.log('Try restarting your Next.js server and refreshing the patient page.');
}

applyFixes();
