-- Migration: Create Patient Portal Tables
-- Timestamp: 20250506234007

-- 1. patients Table: Stores core patient information.
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL, -- If the patient is a direct user
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
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON COLUMN public.patients.profile_id IS 'Links to the user profile if the patient themselves has a login.';
COMMENT ON COLUMN public.patients.email IS 'Patient''s direct email, might be different from their user account email.';

CREATE INDEX IF NOT EXISTS idx_patients_profile_id ON public.patients(profile_id);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.patients IS 'Stores detailed information about patients.';

-- 3. appointments Table: Stores patient appointments.
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_datetime TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    service_type TEXT, -- E.g., 'Initial Assessment', 'Follow-up Visit', 'Therapy Session'
    practitioner_name TEXT,
    location TEXT,
    notes TEXT,
    status TEXT DEFAULT 'scheduled' NOT NULL, -- E.g., 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL -- Admin/staff who created
);
COMMENT ON COLUMN public.appointments.status IS 'Current status of the appointment.';
COMMENT ON COLUMN public.appointments.created_by IS 'User ID of the staff member who scheduled the appointment.';

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON public.appointments(appointment_datetime);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.appointments IS 'Schedules and tracks patient appointments.';

-- 4. patient_portal_invitations Table: Manages invites for patients and family caregivers.
CREATE TABLE public.patient_portal_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    invitee_email TEXT NOT NULL,
    invited_as_role public.user_role NOT NULL CHECK (invited_as_role IN ('patient', 'family_contact')),
    invitation_token TEXT UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
    status TEXT DEFAULT 'pending' NOT NULL, -- E.g., 'pending', 'accepted', 'expired', 'revoked'
    expires_at TIMESTAMPTZ NOT NULL,
    invited_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    accepted_by_user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_patient_email_role UNIQUE (patient_id, invitee_email, invited_as_role)
);
COMMENT ON COLUMN public.patient_portal_invitations.invited_as_role IS 'Role assigned to the user upon accepting the invitation (patient or family_contact).';
COMMENT ON COLUMN public.patient_portal_invitations.invitation_token IS 'Secure, unique token for accepting the invitation.';
COMMENT ON COLUMN public.patient_portal_invitations.status IS 'Current status of the invitation.';
COMMENT ON COLUMN public.patient_portal_invitations.accepted_by_user_id IS 'User ID of the profile that accepted this invitation.';

CREATE INDEX IF NOT EXISTS idx_invitations_patient_id ON public.patient_portal_invitations(patient_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_email ON public.patient_portal_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.patient_portal_invitations(invitation_token);
ALTER TABLE public.patient_portal_invitations ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.patient_portal_invitations IS 'Tracks invitations sent to patients and family members for portal access.';

-- 5. patient_family_links Table: Links users with 'family_contact' role to specific patients.
CREATE TABLE public.patient_family_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    family_member_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relationship_type TEXT, -- E.g., 'Spouse', 'Parent', 'Child', 'Sibling', 'Guardian'
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_patient_family_member UNIQUE (patient_id, family_member_user_id)
);
COMMENT ON COLUMN public.patient_family_links.family_member_user_id IS 'User ID of the family member (profile with family_contact role).';
COMMENT ON COLUMN public.patient_family_links.relationship_type IS 'Describes the family relationship (e.g., Spouse, Parent).';

CREATE INDEX IF NOT EXISTS idx_patient_family_links_patient_id ON public.patient_family_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_family_links_user_id ON public.patient_family_links(family_member_user_id);
ALTER TABLE public.patient_family_links ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.patient_family_links IS 'Links family members (users with family_contact role) to patients they are authorized to access.';

-- Trigger function to set updated_at timestamp automatically
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  _new RECORD;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to new tables that have an updated_at column
CREATE TRIGGER set_patients_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_patient_portal_invitations_updated_at
BEFORE UPDATE ON public.patient_portal_invitations
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_patient_family_links_updated_at
BEFORE UPDATE ON public.patient_family_links
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at(); 