-- Enable Row Level Security
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy for viewing appointments:
-- Staff with 'read' permission on patients can view all appointments
-- Patients can only view their own appointments
CREATE POLICY "staff_can_view_all_appointments" 
ON appointments
FOR SELECT
USING (
  (
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
    -- Modified to avoid recursive policy check on patients table
    -- This assumes there's a direct way to link patient_id to the user without going through patients again
    -- Adjust based on your actual schema
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'patient'
      AND profiles.id IN (
        SELECT profile_id FROM patients WHERE patients.id = appointments.patient_id
      )
    )
  )
);

-- Policy for editing appointments:
-- Staff with 'write' permission on patients can edit all appointments
-- Patients can't edit appointments directly (they would use a function)
CREATE POLICY "staff_can_edit_appointments" 
ON appointments
FOR UPDATE
USING (
  auth.role() = 'authenticated' AND 
  EXISTS (
    SELECT 1 FROM user_permissions 
    WHERE user_id = auth.uid() 
    AND resource = 'patients' 
    AND permission IN ('write', 'admin')
  )
);

-- Policy for creating appointments:
-- Staff with 'write' permission on patients can create appointments
CREATE POLICY "staff_can_create_appointments" 
ON appointments
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND 
  EXISTS (
    SELECT 1 FROM user_permissions 
    WHERE user_id = auth.uid() 
    AND resource = 'patients' 
    AND permission IN ('write', 'admin')
  )
);

-- Policy for deleting appointments:
-- Only staff with 'admin' permission on patients can delete appointments
CREATE POLICY "staff_can_delete_appointments" 
ON appointments
FOR DELETE
USING (
  auth.role() = 'authenticated' AND 
  EXISTS (
    SELECT 1 FROM user_permissions 
    WHERE user_id = auth.uid() 
    AND resource = 'patients' 
    AND permission = 'admin'
  )
); 