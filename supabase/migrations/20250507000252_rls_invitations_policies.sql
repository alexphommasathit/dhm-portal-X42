-- Migration: Add RLS Policies for patient_portal_invitations table
-- Timestamp: 20250507000252

ALTER TABLE public.patient_portal_invitations ENABLE ROW LEVEL SECURITY;

-- Policy 1: Specified staff can manage all invitations.
DROP POLICY IF EXISTS "Allow specified staff to manage all invitations" ON public.patient_portal_invitations;
CREATE POLICY "Allow admin/staff to manage all invitations"
ON public.patient_portal_invitations
FOR ALL -- Covers SELECT, INSERT, UPDATE, DELETE
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
)
WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
);

-- Policy 2: Authenticated users can view their own accepted invitation.
-- This allows a user (patient or family_contact) to see the record of the invitation they accepted.
DROP POLICY IF EXISTS "Allow user to view their accepted invitation" ON public.patient_portal_invitations;
CREATE POLICY "Allow user to view their accepted invitation"
ON public.patient_portal_invitations
FOR SELECT
TO authenticated
USING (
    accepted_by_user_id = auth.uid() AND status = 'accepted'
); 