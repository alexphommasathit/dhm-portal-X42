// Script to apply our development environment setup to the Supabase database
// Run with: node apply-dev-setup.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Create a service client to the database
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

async function executeSQL(sql) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sql`, {
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
  } catch (error) {
    console.error('Error executing SQL:', error.message);
    throw error;
  }
}

async function applyDevSetup() {
  console.log('Applying development environment setup to database...');
  console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('dev-setup.sql', 'utf8');
    console.log('\nSQL file loaded successfully.');

    // Split into manageable chunks (due to API limits)
    const sqlStatements = sqlContent.split(';').filter(stmt => stmt.trim().length > 0);

    // Apply each statement one by one
    console.log(`\nExecuting ${sqlStatements.length} SQL statements...`);
    for (let i = 0; i < sqlStatements.length; i++) {
      const stmt = sqlStatements[i].trim() + ';';
      console.log(`\n[${i + 1}/${sqlStatements.length}] Executing: ${stmt.substring(0, 60)}...`);

      try {
        await executeSQL(stmt);
        console.log('  ✅ Statement executed successfully');
      } catch (error) {
        console.error(`  ❌ Statement failed: ${error.message}`);
        // Continue with next statement
      }
    }

    console.log('\nDevelopment environment setup complete!');
    console.log('You can now restart your Next.js server and refresh the patient page.');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

applyDevSetup();
