-- Migration: Add RLS Policies for appointments table
-- Timestamp: 20250506235716

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- SELECT Policies --

DROP POLICY IF EXISTS "Allow patients to view their own appointments" ON public.appointments;
CREATE POLICY "Allow patients to view their own appointments"
ON public.appointments
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = public.appointments.patient_id AND p.profile_id = auth.uid()
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
    )
);

DROP POLICY IF EXISTS "Allow linked family caregivers to view patient appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow linked family contacts to view patient appointments" ON public.appointments;
CREATE POLICY "Allow linked family contacts to view patient appointments"
ON public.appointments
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.patient_family_links pfl
        WHERE pfl.patient_id = public.appointments.patient_id AND pfl.family_member_user_id = auth.uid() AND pfl.is_active = TRUE
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'family_contact'
    )
);

DROP POLICY IF EXISTS "Allow staff to view all appointments" ON public.appointments;
CREATE POLICY "Allow staff/admin to view all appointments"
ON public.appointments
FOR SELECT TO authenticated USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'admin',
        'staff'
    )
);

-- INSERT, UPDATE, DELETE Policies --

DROP POLICY IF EXISTS "Allow admin/staff to insert appointments" ON public.appointments;
CREATE POLICY "Allow admin/staff to insert appointments"
ON public.appointments
FOR INSERT TO authenticated WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
);

DROP POLICY IF EXISTS "Allow admin/staff to update appointments" ON public.appointments;
CREATE POLICY "Allow admin/staff to update appointments"
ON public.appointments
FOR UPDATE TO authenticated USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
) WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
);

DROP POLICY IF EXISTS "Allow admin/staff to delete appointments" ON public.appointments;
CREATE POLICY "Allow admin/staff to delete appointments"
ON public.appointments
FOR DELETE TO authenticated USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
); 