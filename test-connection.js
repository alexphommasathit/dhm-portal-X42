// Simple Node.js script to test Supabase connection
// Run with: node test-connection.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Log environment variables (without showing full keys)
console.log('=== Environment Variables ===');
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Service Key Available:', Boolean(process.env.PRIVATE_SUPABASE_SERVICE_KEY));
console.log('Service Key Length:', process.env.PRIVATE_SUPABASE_SERVICE_KEY?.length || 0);
console.log('Anon Key Length:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0);

// Create a service client
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

async function testConnection() {
  try {
    console.log('\n=== Checking Database Connection ===');

    // 1. List all tables (direct SQL)
    console.log('\nListing tables in database:');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      console.error('Error listing tables:', tablesError);
    } else {
      console.log('Tables:', tables.map(t => t.table_name).join(', '));
    }

    // 2. Try to access patients table
    console.log('\nAttempting to query patients table:');
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('*')
      .limit(1);

    if (patientsError) {
      console.error('Error accessing patients table:', patientsError);
    } else {
      console.log('Patients table accessible! Found', patients.length, 'records');
      console.log('Sample data:', patients);
    }

    // 3. Try service function
    console.log('\nAttempting to use service function:');
    const { data: funcData, error: funcError } = await supabase.rpc('get_all_patients', {
      limit_count: 1,
    });

    if (funcError) {
      console.error('Error using service function:', funcError);
    } else {
      console.log('Service function works! Found', funcData.length, 'records');
    }

    console.log('\n=== Test Complete ===');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testConnection();
