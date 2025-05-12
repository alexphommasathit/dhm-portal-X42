#!/bin/bash

# Reset Database Script for DHM Portal Winds
# This is a last resort to completely reset the local development database

echo "⚠️  WARNING: This will completely reset your local Supabase database!"
echo "All data will be lost and the database will be restored to its initial state."
echo ""
read -p "Type 'RESET' to confirm: " confirmation

if [ "$confirmation" != "RESET" ]; then
  echo "Reset cancelled."
  exit 1
fi

echo ""
echo "🚀 Starting database reset..."

# Stop Supabase
echo "Stopping Supabase..."
npx supabase stop

# Remove the database volume to ensure a complete reset
echo "Removing database volume..."
docker volume rm dhm-portal-winds_db_data || true

# Restart Supabase
echo "Starting fresh Supabase instance..."
npx supabase start

# Wait for Supabase to be ready
echo "Waiting for Supabase to be ready..."
sleep 10

# Apply migrations to set up the database structure
echo "Applying migrations..."
npx supabase db reset

echo ""
echo "✅ Database reset complete!"
echo "You should now be able to access your application with a clean database."
echo ""
echo "Next steps:"
echo "1. Restart your Next.js development server"
echo "2. Try accessing the debug panel at: http://localhost:3000/admin/debug-panel"
echo "3. Verify that you can access data with: http://localhost:3000/api/direct-db?table=patients"
echo "" 