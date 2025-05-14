-- supabase/migrations/20250513001720_create_patient_statuses_table.sql

-- Create the patient_statuses table
CREATE TABLE public.patient_statuses (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add comments to the table and columns
COMMENT ON TABLE public.patient_statuses IS '''Defines the possible statuses for a patient record (e.g., Prospective, Active, No Admit).''';
COMMENT ON COLUMN public.patient_statuses.id IS '''Unique identifier for the status.''';
COMMENT ON COLUMN public.patient_statuses.name IS '''The name of the status (e.g., Active, Inactive).''';
COMMENT ON COLUMN public.patient_statuses.description IS '''Optional description of the status.''';
COMMENT ON COLUMN public.patient_statuses.created_at IS '''Timestamp when the status was created.''';
COMMENT ON COLUMN public.patient_statuses.updated_at IS '''Timestamp when the status was last updated.''';

-- Enable Row Level Security (RLS)
ALTER TABLE public.patient_statuses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (Allow public read access)
CREATE POLICY "Allow public read access to patient statuses"
ON public.patient_statuses
FOR SELECT
USING (true);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.patient_statuses
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Insert default statuses
INSERT INTO public.patient_statuses (name, description) VALUES
('Prospective', 'Patient has been entered but not yet admitted or fully active.'),
('Active', 'Patient is currently receiving services or is actively managed.'),
('Inactive', 'Patient is no longer actively managed but record is retained.'),
('Discharged', 'Patient has been formally discharged from services.'),
('No Admit', 'Patient was entered but never admitted (e.g., referral cancelled).');
