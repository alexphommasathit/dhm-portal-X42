-- Migration: Add RLS Policies for patient_family_links table
-- Timestamp: 20250507000811

ALTER TABLE public.patient_family_links ENABLE ROW LEVEL SECURITY;

-- SELECT Policies --

DROP POLICY IF EXISTS "Allow patient to view their family links" ON public.patient_family_links;
CREATE POLICY "Allow patient to view their family links"
ON public.patient_family_links
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = public.patient_family_links.patient_id AND p.profile_id = auth.uid()
        AND (SELECT role FROM public.profiles prof WHERE prof.id = auth.uid()) = 'patient'
    )
);

DROP POLICY IF EXISTS "Allow family member to view their own links" ON public.patient_family_links;
CREATE POLICY "Allow family contact to view their own links"
ON public.patient_family_links
FOR SELECT TO authenticated USING (
    family_member_user_id = auth.uid()
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'family_contact'
);

DROP POLICY IF EXISTS "Allow relevant staff to view family links" ON public.patient_family_links;
CREATE POLICY "Allow admin/staff to view family links"
ON public.patient_family_links
FOR SELECT TO authenticated USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'admin', 
        'staff'
    )
);

-- INSERT, UPDATE, DELETE Policies --

DROP POLICY IF EXISTS "Allow admin/clinician/assistant to manage family links" ON public.patient_family_links;
CREATE POLICY "Allow admin/staff to manage family links"
ON public.patient_family_links
FOR ALL -- Covers INSERT, UPDATE, DELETE
TO authenticated 
USING ( 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
)
WITH CHECK ( 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
); 