// Script to apply our schema to the cloud Supabase database
// Run with: node apply-to-cloud.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Create a service client to the cloud database
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

async function applySchemaToDB() {
  console.log('Starting schema application to cloud database...');
  console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  try {
    // First, create the service_functions schema
    console.log('\nCreating service_functions schema...');
    const { error: schemaError } = await supabase.rpc('apply_sql', {
      sql_query: 'CREATE SCHEMA IF NOT EXISTS service_functions;',
    });

    if (schemaError) {
      console.error('Error creating schema:', schemaError);
      if (schemaError.message?.includes('apply_sql')) {
        console.error('The apply_sql function needs to be created first!');
        console.log('Creating apply_sql function...');

        // Using raw SQL API to create the function
        const createFnResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sql`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: process.env.PRIVATE_SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${process.env.PRIVATE_SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
              query: `
                CREATE OR REPLACE FUNCTION apply_sql(sql_query TEXT)
                RETURNS VOID
                LANGUAGE plpgsql
                SECURITY DEFINER
                AS $$
                BEGIN
                  EXECUTE sql_query;
                END;
                $$;
                
                GRANT EXECUTE ON FUNCTION apply_sql TO authenticated;
              `,
            }),
          }
        );

        if (!createFnResponse.ok) {
          console.error('Failed to create apply_sql function:', await createFnResponse.text());
          return;
        }

        console.log('apply_sql function created. Retrying schema creation...');

        // Retry schema creation
        const { error: retryError } = await supabase.rpc('apply_sql', {
          sql_query: 'CREATE SCHEMA IF NOT EXISTS service_functions;',
        });

        if (retryError) {
          console.error('Still failed to create schema:', retryError);
          return;
        }
      } else {
        return;
      }
    }

    // Now apply the service functions for patients
    console.log('\nCreating get_patient_by_id function...');
    const getPatientFn = `
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
    `;

    const { error: fnError1 } = await supabase.rpc('apply_sql', { sql_query: getPatientFn });

    if (fnError1) {
      console.error('Error creating get_patient_by_id function:', fnError1);
      return;
    }

    console.log('\nCreating get_all_patients function...');
    const getAllPatientsFn = `
      CREATE OR REPLACE FUNCTION public.get_all_patients(limit_count INT DEFAULT 100)
      RETURNS SETOF public.patients
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT * FROM public.patients LIMIT limit_count;
      $$;
      
      GRANT EXECUTE ON FUNCTION public.get_all_patients TO authenticated;
    `;

    const { error: fnError2 } = await supabase.rpc('apply_sql', { sql_query: getAllPatientsFn });

    if (fnError2) {
      console.error('Error creating get_all_patients function:', fnError2);
      return;
    }

    console.log('\nSchema application complete!');
    console.log('Please refresh your debug panel and try again.');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

applySchemaToDB();
