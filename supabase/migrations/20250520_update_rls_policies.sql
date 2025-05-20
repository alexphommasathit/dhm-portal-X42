-- ========== PROFILES ==========
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());

-- ========== PATIENT DOCUMENTS ==========
DROP POLICY IF EXISTS staff_manage_documents ON public.patient_documents;
CREATE POLICY staff_manage_documents ON public.patient_documents
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
  );

DROP POLICY IF EXISTS patient_view_documents ON public.patient_documents;
CREATE POLICY patient_view_documents ON public.patient_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = public.patient_documents.patient_id
        AND p.profile_id = auth.uid()
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
    )
  );

DROP POLICY IF EXISTS family_view_documents ON public.patient_documents;
CREATE POLICY family_view_documents ON public.patient_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.patient_family_links pfl
      WHERE pfl.patient_id = public.patient_documents.patient_id
        AND pfl.family_member_user_id = auth.uid()
        AND pfl.is_active = TRUE
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'family_contact'
    )
  );

-- ========== PATIENT FAMILY LINKS ==========
DROP POLICY IF EXISTS "Allow admin/staff to manage family links" ON public.patient_family_links;
CREATE POLICY "Allow admin/staff to manage family links"
  ON public.patient_family_links
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
  );

-- ========== APPOINTMENTS ==========
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
