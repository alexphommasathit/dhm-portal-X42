-- Add Google Calendar integration fields to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ics_uid TEXT,
ADD COLUMN IF NOT EXISTS needs_sync BOOLEAN DEFAULT TRUE;

-- Create enum for appointment status if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE public.appointment_status AS ENUM (
            'scheduled',
            'confirmed',
            'completed',
            'cancelled',
            'no_show',
            'rescheduled'
        );
    END IF;
END$$;

-- Add index for Google Calendar event ID
CREATE INDEX IF NOT EXISTS idx_appointments_google_calendar_event_id ON public.appointments(google_calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_appointments_needs_sync ON public.appointments(needs_sync) WHERE needs_sync = TRUE;

-- Function to create a new appointment
CREATE OR REPLACE FUNCTION public.create_appointment(
    p_patient_id UUID,
    p_appointment_datetime TIMESTAMPTZ,
    p_duration_minutes INTEGER DEFAULT 60,
    p_service_type TEXT DEFAULT NULL,
    p_practitioner_name TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'scheduled',
    p_is_all_day BOOLEAN DEFAULT FALSE,
    p_recurrence_rule TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment_id UUID;
    v_status appointment_status;
BEGIN
    -- Check if user has permission
    IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('administrator', 'clinician', 'assistant', 'financial_admin') THEN
        RAISE EXCEPTION 'Insufficient permissions to create appointments';
    END IF;
    
    -- Convert status string to enum
    v_status := p_status::appointment_status;
    
    -- Insert new appointment
    INSERT INTO public.appointments (
        patient_id,
        appointment_datetime,
        duration_minutes,
        service_type,
        practitioner_name,
        location,
        notes,
        status,
        created_by,
        is_all_day,
        recurrence_rule,
        needs_sync
    ) VALUES (
        p_patient_id,
        p_appointment_datetime,
        p_duration_minutes,
        p_service_type,
        p_practitioner_name,
        p_location,
        p_notes,
        v_status,
        auth.uid(),
        p_is_all_day,
        p_recurrence_rule,
        TRUE -- Always needs initial sync
    )
    RETURNING id INTO v_appointment_id;
    
    RETURN v_appointment_id;
END;
$$;

-- Function to update an appointment
CREATE OR REPLACE FUNCTION public.update_appointment(
    p_appointment_id UUID,
    p_appointment_datetime TIMESTAMPTZ DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT NULL,
    p_service_type TEXT DEFAULT NULL,
    p_practitioner_name TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_is_all_day BOOLEAN DEFAULT NULL,
    p_recurrence_rule TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
    v_status appointment_status;
BEGIN
    -- Check if user has permission
    IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('administrator', 'clinician', 'assistant', 'financial_admin') THEN
        RAISE EXCEPTION 'Insufficient permissions to update appointments';
    END IF;
    
    -- Get appointment record
    SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;
    
    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;
    
    -- Convert status string to enum if provided
    IF p_status IS NOT NULL THEN
        v_status := p_status::appointment_status;
    END IF;
    
    -- Update appointment with provided values
    UPDATE public.appointments
    SET
        appointment_datetime = COALESCE(p_appointment_datetime, appointment_datetime),
        duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
        service_type = COALESCE(p_service_type, service_type),
        practitioner_name = COALESCE(p_practitioner_name, practitioner_name),
        location = COALESCE(p_location, location),
        notes = COALESCE(p_notes, notes),
        status = COALESCE(v_status, status),
        is_all_day = COALESCE(p_is_all_day, is_all_day),
        recurrence_rule = COALESCE(p_recurrence_rule, recurrence_rule),
        updated_at = NOW(),
        needs_sync = TRUE -- Mark as needing sync after any update
    WHERE id = p_appointment_id;
    
    RETURN TRUE;
END;
$$;

-- Function to delete an appointment
CREATE OR REPLACE FUNCTION public.delete_appointment(
    p_appointment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
BEGIN
    -- Check if user has permission
    IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('administrator', 'clinician', 'assistant', 'financial_admin') THEN
        RAISE EXCEPTION 'Insufficient permissions to delete appointments';
    END IF;
    
    -- Get appointment record
    SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;
    
    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;
    
    -- Delete appointment
    DELETE FROM public.appointments WHERE id = p_appointment_id;
    
    RETURN TRUE;
END;
$$;

-- Function to reschedule an appointment (special case of update)
CREATE OR REPLACE FUNCTION public.reschedule_appointment(
    p_appointment_id UUID,
    p_new_datetime TIMESTAMPTZ,
    p_new_duration_minutes INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
BEGIN
    -- Check if user has permission
    IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('administrator', 'clinician', 'assistant', 'financial_admin') THEN
        RAISE EXCEPTION 'Insufficient permissions to reschedule appointments';
    END IF;
    
    -- Get appointment record
    SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;
    
    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;
    
    -- Update appointment with new datetime and optional duration
    UPDATE public.appointments
    SET
        appointment_datetime = p_new_datetime,
        duration_minutes = COALESCE(p_new_duration_minutes, duration_minutes),
        status = 'rescheduled',
        updated_at = NOW(),
        needs_sync = TRUE
    WHERE id = p_appointment_id;
    
    RETURN TRUE;
END;
$$;

-- Function to mark Google Calendar sync status
CREATE OR REPLACE FUNCTION public.update_appointment_sync_status(
    p_appointment_id UUID,
    p_google_calendar_event_id TEXT DEFAULT NULL,
    p_ics_uid TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
BEGIN
    -- Check if user has permission (this could be limited to system/service accounts)
    IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('administrator', 'system') THEN
        RAISE EXCEPTION 'Insufficient permissions to update sync status';
    END IF;
    
    -- Get appointment record
    SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id;
    
    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;
    
    -- Update sync status
    UPDATE public.appointments
    SET
        google_calendar_event_id = COALESCE(p_google_calendar_event_id, google_calendar_event_id),
        ics_uid = COALESCE(p_ics_uid, ics_uid),
        last_synced_at = NOW(),
        needs_sync = FALSE
    WHERE id = p_appointment_id;
    
    RETURN TRUE;
END;
$$;

-- Function to get appointments needing sync
CREATE OR REPLACE FUNCTION public.get_appointments_needing_sync()
RETURNS SETOF public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user has permission (this could be limited to system/service accounts)
    IF NOT (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('administrator', 'system') THEN
        RAISE EXCEPTION 'Insufficient permissions to query sync status';
    END IF;
    
    RETURN QUERY
    SELECT * FROM public.appointments
    WHERE needs_sync = TRUE
    ORDER BY updated_at DESC;
END;
$$;

-- Function to get upcoming appointments for a patient
CREATE OR REPLACE FUNCTION public.get_patient_upcoming_appointments(
    p_patient_id UUID,
    p_days_ahead INTEGER DEFAULT 30
)
RETURNS SETOF public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_is_linked BOOLEAN;
BEGIN
    -- Get current user ID and role
    v_user_id := auth.uid();
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    
    -- Check if user is staff
    IF v_user_role IN ('administrator', 'clinician', 'assistant', 'financial_admin') THEN
        -- Staff can see all appointments
        RETURN QUERY
        SELECT * FROM public.appointments
        WHERE patient_id = p_patient_id
          AND appointment_datetime >= NOW()
          AND appointment_datetime <= NOW() + (p_days_ahead * INTERVAL '1 day')
          AND status NOT IN ('cancelled', 'completed', 'no_show')
        ORDER BY appointment_datetime ASC;
    ELSE
        -- Check if user is the patient or linked to patient
        SELECT EXISTS (
            SELECT 1 FROM public.patients 
            WHERE id = p_patient_id AND profile_id = v_user_id
        ) OR EXISTS (
            SELECT 1 FROM public.patient_relationships
            WHERE patient_id = p_patient_id AND user_id = v_user_id AND is_active = TRUE
        ) INTO v_is_linked;
        
        IF NOT v_is_linked THEN
            RAISE EXCEPTION 'Not authorized to view appointments for this patient';
        END IF;
        
        -- Return upcoming appointments for the patient
        RETURN QUERY
        SELECT * FROM public.appointments
        WHERE patient_id = p_patient_id
          AND appointment_datetime >= NOW()
          AND appointment_datetime <= NOW() + (p_days_ahead * INTERVAL '1 day')
          AND status NOT IN ('cancelled', 'completed', 'no_show')
        ORDER BY appointment_datetime ASC;
    END IF;
END;
$$;

-- Function to generate ICS format for an appointment
CREATE OR REPLACE FUNCTION public.generate_appointment_ics(
    p_appointment_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment RECORD;
    v_patient RECORD;
    v_ics_content TEXT;
    v_uid TEXT;
    v_now TEXT;
    v_start_date TEXT;
    v_end_date TEXT;
    v_description TEXT;
BEGIN
    -- Get appointment and patient details
    SELECT a.*, p.first_name, p.last_name INTO v_appointment
    FROM public.appointments a
    JOIN public.patients p ON a.patient_id = p.id
    WHERE a.id = p_appointment_id;
    
    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;
    
    -- Check if user has permission
    IF NOT (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('administrator', 'clinician', 'assistant', 'financial_admin')
        OR (auth.uid() = (SELECT profile_id FROM public.patients WHERE id = v_appointment.patient_id))
        OR EXISTS (
            SELECT 1 FROM public.patient_relationships
            WHERE patient_id = v_appointment.patient_id 
            AND user_id = auth.uid() 
            AND is_active = TRUE
        )
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to access this appointment';
    END IF;
    
    -- Generate UID if not exists
    IF v_appointment.ics_uid IS NULL THEN
        v_uid := v_appointment.id || '@dhm-portal.example.com';
        
        -- Update the UID in the database
        UPDATE public.appointments
        SET ics_uid = v_uid
        WHERE id = p_appointment_id;
    ELSE
        v_uid := v_appointment.ics_uid;
    END IF;
    
    -- Format dates
    v_now := to_char(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"');
    v_start_date := to_char(v_appointment.appointment_datetime AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"');
    v_end_date := to_char((v_appointment.appointment_datetime + (v_appointment.duration_minutes * INTERVAL '1 minute')) AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"');
    
    -- Create description
    v_description := COALESCE(v_appointment.notes, '');
    IF v_appointment.location IS NOT NULL AND v_appointment.location != '' THEN
        v_description := v_description || E'\nLocation: ' || v_appointment.location;
    END IF;
    
    -- Build ICS content
    v_ics_content := 'BEGIN:VCALENDAR' || E'\n' ||
                    'VERSION:2.0' || E'\n' ||
                    'PRODID:-//DHM Patient Portal//Appointment Calendar//EN' || E'\n' ||
                    'CALSCALE:GREGORIAN' || E'\n' ||
                    'METHOD:PUBLISH' || E'\n' ||
                    'BEGIN:VEVENT' || E'\n' ||
                    'UID:' || v_uid || E'\n' ||
                    'DTSTAMP:' || v_now || E'\n' ||
                    'DTSTART:' || v_start_date || E'\n' ||
                    'DTEND:' || v_end_date || E'\n' ||
                    'SUMMARY:' || COALESCE(v_appointment.service_type, 'Appointment') || 
                        ' with ' || v_appointment.first_name || ' ' || v_appointment.last_name || E'\n';
    
    -- Add description if available
    IF v_description != '' THEN
        v_ics_content := v_ics_content || 'DESCRIPTION:' || v_description || E'\n';
    END IF;
    
    -- Add location if available
    IF v_appointment.location IS NOT NULL AND v_appointment.location != '' THEN
        v_ics_content := v_ics_content || 'LOCATION:' || v_appointment.location || E'\n';
    END IF;
    
    -- Add practitioner if available
    IF v_appointment.practitioner_name IS NOT NULL AND v_appointment.practitioner_name != '' THEN
        v_ics_content := v_ics_content || 'ORGANIZER;CN=' || v_appointment.practitioner_name || ':mailto:noreply@example.com' || E'\n';
    END IF;
    
    -- Add status
    CASE v_appointment.status
        WHEN 'scheduled' THEN v_ics_content := v_ics_content || 'STATUS:CONFIRMED' || E'\n';
        WHEN 'confirmed' THEN v_ics_content := v_ics_content || 'STATUS:CONFIRMED' || E'\n';
        WHEN 'cancelled' THEN v_ics_content := v_ics_content || 'STATUS:CANCELLED' || E'\n';
        ELSE v_ics_content := v_ics_content || 'STATUS:TENTATIVE' || E'\n';
    END CASE;
    
    -- Add recurrence rule if available
    IF v_appointment.recurrence_rule IS NOT NULL AND v_appointment.recurrence_rule != '' THEN
        v_ics_content := v_ics_content || 'RRULE:' || v_appointment.recurrence_rule || E'\n';
    END IF;
    
    -- Complete the ICS content
    v_ics_content := v_ics_content || 'END:VEVENT' || E'\n' || 'END:VCALENDAR';
    
    RETURN v_ics_content;
END;
$$; 