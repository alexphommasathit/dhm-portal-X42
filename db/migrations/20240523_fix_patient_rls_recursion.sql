-- Migration to fix infinite recursion in patients and appointments RLS policies
-- The issue is in the circular reference between patients and appointments tables

-- 1. First, drop the problematic policy in appointments table
DROP POLICY IF EXISTS "staff_can_view_all_appointments" ON appointments;

-- 2. Create a new corrected policy that avoids the recursion
-- This policy uses profile_id from patients table to link directly to auth.uid()
CREATE POLICY "staff_can_view_all_appointments_fixed" 
ON appointments
FOR SELECT
USING (
  (
    -- Staff with permissions can view all appointments
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM user_permissions 
      WHERE user_id = auth.uid() 
      AND resource = 'patients' 
      AND permission IN ('read', 'write', 'admin')
    )
  )
  OR 
  (
    -- Patients can only view their own appointments
    -- This now directly links profile_id to auth.uid() to avoid recursion
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 
      FROM patients 
      WHERE patients.id = appointments.patient_id 
      AND patients.profile_id = auth.uid()
    )
  )
);

-- 3. Add appropriate indexes to ensure efficient policy evaluation
CREATE INDEX IF NOT EXISTS idx_patients_profile_id ON patients(profile_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id); 