-- Create test data script
-- This script creates test users and patients for development

-- Create a test user in auth.users table first
-- We need to manually insert the user since local development doesn't have the Auth UI
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  created_at,
  updated_at,
  role,
  is_super_admin,
  aud,
  confirmation_token
) 
VALUES (
  'a74f52c0-d2de-43b5-86c9-eb157306f7cb', -- Use a known UUID for testing
  'admin@example.com',
  '$2a$10$6wZuiPnNt5OEKyQR8C1lremJ.vKFLUwG.tTQEaFRBC0zBjrSjDGna', -- password is 'password'
  NOW(),
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  FALSE,
  'authenticated',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Create the admin profile
INSERT INTO public.profiles (
  id, 
  first_name, 
  last_name, 
  role
) 
VALUES (
  'a74f52c0-d2de-43b5-86c9-eb157306f7cb', -- Same ID as auth.users
  'Admin', 
  'User', 
  'administrator'
) ON CONFLICT (id) DO NOTHING;

-- Create test patients
INSERT INTO public.patients (
  id,
  profile_id,
  first_name,
  last_name,
  date_of_birth,
  gender,
  phone_number,
  email,
  address_line1,
  city,
  state,
  zip_code,
  is_active,
  created_by
)
VALUES 
(
  'b44f52c0-d2de-43b5-86c9-eb157306f7cb',  -- Test patient 1
  NULL, -- Not linked to a user account
  'John',
  'Doe',
  '1980-01-01',
  'Male',
  '555-123-4567',
  'john.doe@example.com',
  '123 Main St',
  'Anytown',
  'CA',
  '90210',
  TRUE,
  'a74f52c0-d2de-43b5-86c9-eb157306f7cb'
),
(
  'c44f52c0-d2de-43b5-86c9-eb157306f7cb',  -- Test patient 2
  NULL,
  'Jane',
  'Smith',
  '1985-05-15',
  'Female',
  '555-987-6543',
  'jane.smith@example.com',
  '456 Oak Ave',
  'Somewhere',
  'NY',
  '10001',
  TRUE,
  'a74f52c0-d2de-43b5-86c9-eb157306f7cb'
);

-- Create an appointment for John Doe
INSERT INTO public.appointments (
  id,
  patient_id,
  appointment_datetime,
  duration_minutes,
  service_type,
  practitioner_name,
  location,
  notes,
  status,
  created_by
)
VALUES (
  'd44f52c0-d2de-43b5-86c9-eb157306f7cb',
  'b44f52c0-d2de-43b5-86c9-eb157306f7cb', -- John Doe's ID
  NOW() + INTERVAL '2 days',
  60,
  'Initial Consultation',
  'Dr. Smith',
  'Main Clinic - Room 3',
  'Initial patient assessment',
  'scheduled',
  'a74f52c0-d2de-43b5-86c9-eb157306f7cb'
);

-- Create a document for John Doe
INSERT INTO public.patient_documents (
  id,
  patient_id,
  title,
  description,
  file_path,
  file_type,
  created_by
)
VALUES (
  'e44f52c0-d2de-43b5-86c9-eb157306f7cb',
  'b44f52c0-d2de-43b5-86c9-eb157306f7cb', -- John Doe's ID
  'Intake Form',
  'Patient initial intake documentation',
  '/documents/intake_form_john_doe.pdf',
  'application/pdf',
  'a74f52c0-d2de-43b5-86c9-eb157306f7cb'
);

-- Create a note for Jane Smith
INSERT INTO public.patient_notes (
  id,
  patient_id,
  note_text,
  created_by
)
VALUES (
  'f44f52c0-d2de-43b5-86c9-eb157306f7cb',
  'c44f52c0-d2de-43b5-86c9-eb157306f7cb', -- Jane Smith's ID
  'Patient called to confirm upcoming appointment. Mentioned she has been feeling better after starting medication.',
  'a74f52c0-d2de-43b5-86c9-eb157306f7cb'
);

-- Populate user permissions for the admin user
SELECT service_functions.refresh_user_permissions('a74f52c0-d2de-43b5-86c9-eb157306f7cb'); 