export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_datetime: string;
          created_at: string;
          created_by: string | null;
          duration_minutes: number | null;
          google_calendar_event_id: string | null;
          ics_uid: string | null;
          id: string;
          is_all_day: boolean | null;
          last_synced_at: string | null;
          location: string | null;
          needs_sync: boolean | null;
          notes: string | null;
          patient_id: string;
          practitioner_name: string | null;
          recurrence_rule: string | null;
          service_type: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          appointment_datetime: string;
          created_at?: string;
          created_by?: string | null;
          duration_minutes?: number | null;
          google_calendar_event_id?: string | null;
          ics_uid?: string | null;
          id?: string;
          is_all_day?: boolean | null;
          last_synced_at?: string | null;
          location?: string | null;
          needs_sync?: boolean | null;
          notes?: string | null;
          patient_id: string;
          practitioner_name?: string | null;
          recurrence_rule?: string | null;
          service_type?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          appointment_datetime?: string;
          created_at?: string;
          created_by?: string | null;
          duration_minutes?: number | null;
          google_calendar_event_id?: string | null;
          ics_uid?: string | null;
          id?: string;
          is_all_day?: boolean | null;
          last_synced_at?: string | null;
          location?: string | null;
          needs_sync?: boolean | null;
          notes?: string | null;
          patient_id?: string;
          practitioner_name?: string | null;
          recurrence_rule?: string | null;
          service_type?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'appointments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          }
        ];
      };
      credentials: {
        Row: {
          created_at: string;
          credential_name: string;
          credential_number: string | null;
          credential_type: Database['public']['Enums']['credential_type_enum'];
          document_file_path: string | null;
          employee_id: string;
          expiry_date: string | null;
          id: string;
          issue_date: string | null;
          issuing_body: string | null;
          status: Database['public']['Enums']['credential_status_enum'];
          updated_at: string;
          verified_at: string | null;
          verified_by_user_id: string | null;
        };
        Insert: {
          created_at?: string;
          credential_name: string;
          credential_number?: string | null;
          credential_type: Database['public']['Enums']['credential_type_enum'];
          document_file_path?: string | null;
          employee_id: string;
          expiry_date?: string | null;
          id?: string;
          issue_date?: string | null;
          issuing_body?: string | null;
          status?: Database['public']['Enums']['credential_status_enum'];
          updated_at?: string;
          verified_at?: string | null;
          verified_by_user_id?: string | null;
        };
        Update: {
          created_at?: string;
          credential_name?: string;
          credential_number?: string | null;
          credential_type?: Database['public']['Enums']['credential_type_enum'];
          document_file_path?: string | null;
          employee_id?: string;
          expiry_date?: string | null;
          id?: string;
          issue_date?: string | null;
          issuing_body?: string | null;
          status?: Database['public']['Enums']['credential_status_enum'];
          updated_at?: string;
          verified_at?: string | null;
          verified_by_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'credentials_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      document_templates: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          document_type: Database['public']['Enums']['document_type'];
          file_mime_type: string | null;
          file_storage_path: string;
          form_fields: Json | null;
          id: string;
          is_active: boolean | null;
          requires_signature: boolean | null;
          template_name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          document_type: Database['public']['Enums']['document_type'];
          file_mime_type?: string | null;
          file_storage_path: string;
          form_fields?: Json | null;
          id?: string;
          is_active?: boolean | null;
          requires_signature?: boolean | null;
          template_name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          document_type?: Database['public']['Enums']['document_type'];
          file_mime_type?: string | null;
          file_storage_path?: string;
          form_fields?: Json | null;
          id?: string;
          is_active?: boolean | null;
          requires_signature?: boolean | null;
          template_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'document_templates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      employee_documents: {
        Row: {
          created_at: string;
          document_name: string;
          document_type: Database['public']['Enums']['document_type_enum'];
          employee_id: string;
          file_path: string;
          id: string;
          updated_at: string;
          uploaded_by_user_id: string;
        };
        Insert: {
          created_at?: string;
          document_name: string;
          document_type: Database['public']['Enums']['document_type_enum'];
          employee_id: string;
          file_path: string;
          id?: string;
          updated_at?: string;
          uploaded_by_user_id: string;
        };
        Update: {
          created_at?: string;
          document_name?: string;
          document_type?: Database['public']['Enums']['document_type_enum'];
          employee_id?: string;
          file_path?: string;
          id?: string;
          updated_at?: string;
          uploaded_by_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employee_documents_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      onboarding_tasks: {
        Row: {
          assigned_to_role: Database['public']['Enums']['user_role'];
          completed_at: string | null;
          created_at: string;
          due_date: string | null;
          employee_id: string;
          id: string;
          notes: string | null;
          required_document_type: Database['public']['Enums']['document_type_enum'] | null;
          status: Database['public']['Enums']['onboarding_task_status_enum'];
          task_description: string | null;
          task_name: string;
          updated_at: string;
        };
        Insert: {
          assigned_to_role: Database['public']['Enums']['user_role'];
          completed_at?: string | null;
          created_at?: string;
          due_date?: string | null;
          employee_id: string;
          id?: string;
          notes?: string | null;
          required_document_type?: Database['public']['Enums']['document_type_enum'] | null;
          status?: Database['public']['Enums']['onboarding_task_status_enum'];
          task_description?: string | null;
          task_name: string;
          updated_at?: string;
        };
        Update: {
          assigned_to_role?: Database['public']['Enums']['user_role'];
          completed_at?: string | null;
          created_at?: string;
          due_date?: string | null;
          employee_id?: string;
          id?: string;
          notes?: string | null;
          required_document_type?: Database['public']['Enums']['document_type_enum'] | null;
          status?: Database['public']['Enums']['onboarding_task_status_enum'];
          task_description?: string | null;
          task_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'onboarding_tasks_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      patient_documents: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          document_name: string;
          document_status: Database['public']['Enums']['document_status'];
          document_type: Database['public']['Enums']['document_type'];
          file_mime_type: string | null;
          file_size: number;
          file_storage_path: string;
          id: string;
          is_template: boolean | null;
          metadata: Json | null;
          original_filename: string | null;
          patient_id: string;
          requires_signature: boolean | null;
          signed_at: string | null;
          signed_by: string | null;
          updated_at: string;
          version: number | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          document_name: string;
          document_status?: Database['public']['Enums']['document_status'];
          document_type: Database['public']['Enums']['document_type'];
          file_mime_type?: string | null;
          file_size: number;
          file_storage_path: string;
          id?: string;
          is_template?: boolean | null;
          metadata?: Json | null;
          original_filename?: string | null;
          patient_id: string;
          requires_signature?: boolean | null;
          signed_at?: string | null;
          signed_by?: string | null;
          updated_at?: string;
          version?: number | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          document_name?: string;
          document_status?: Database['public']['Enums']['document_status'];
          document_type?: Database['public']['Enums']['document_type'];
          file_mime_type?: string | null;
          file_size?: number;
          file_storage_path?: string;
          id?: string;
          is_template?: boolean | null;
          metadata?: Json | null;
          original_filename?: string | null;
          patient_id?: string;
          requires_signature?: boolean | null;
          signed_at?: string | null;
          signed_by?: string | null;
          updated_at?: string;
          version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'patient_documents_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patient_documents_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patient_documents_signed_by_fkey';
            columns: ['signed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      patient_family_links: {
        Row: {
          created_at: string;
          family_member_user_id: string;
          id: string;
          is_active: boolean;
          is_designated_representative: boolean;
          is_emergency_contact: boolean;
          patient_id: string;
          relationship: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          family_member_user_id: string;
          id?: string;
          is_active?: boolean;
          is_designated_representative?: boolean;
          is_emergency_contact?: boolean;
          patient_id: string;
          relationship?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          family_member_user_id?: string;
          id?: string;
          is_active?: boolean;
          is_designated_representative?: boolean;
          is_emergency_contact?: boolean;
          patient_id?: string;
          relationship?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patient_family_links_family_member_user_id_fkey';
            columns: ['family_member_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patient_family_links_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          }
        ];
      };
      patient_portal_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by_user_id: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          invitation_token: string;
          invited_as_role: Database['public']['Enums']['user_role'];
          invited_by_user_id: string | null;
          invitee_email: string;
          patient_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by_user_id?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          invitation_token?: string;
          invited_as_role: Database['public']['Enums']['user_role'];
          invited_by_user_id?: string | null;
          invitee_email: string;
          patient_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by_user_id?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          invitation_token?: string;
          invited_as_role?: Database['public']['Enums']['user_role'];
          invited_by_user_id?: string | null;
          invitee_email?: string;
          patient_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patient_portal_invitations_accepted_by_user_id_fkey';
            columns: ['accepted_by_user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patient_portal_invitations_invited_by_user_id_fkey';
            columns: ['invited_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patient_portal_invitations_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          }
        ];
      };
      patient_statuses: {
        Row: {
          created_at: string;
          description: string | null;
          id: number;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: number;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: number;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      patients: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          branch: string | null;
          city: string | null;
          created_at: string;
          date_of_birth: string;
          email: string | null;
          ethnicity: string | null;
          first_name: string;
          gender: string | null;
          id: string;
          is_active: boolean;
          last_name: string;
          marital_status: string | null;
          middle_name: string | null;
          mobile_phone_number: string | null;
          patient_status_id: number | null;
          phone_number: string | null;
          preferred_contact_method: string | null;
          preferred_language: string | null;
          preferred_name: string | null;
          previous_name: string | null;
          profile_id: string | null;
          race: string | null;
          social_security_number: string | null;
          state: string | null;
          suffix: string | null;
          updated_at: string;
          zip_code: string | null;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          branch?: string | null;
          city?: string | null;
          created_at?: string;
          date_of_birth: string;
          email?: string | null;
          ethnicity?: string | null;
          first_name: string;
          gender?: string | null;
          id?: string;
          is_active?: boolean;
          last_name: string;
          marital_status?: string | null;
          middle_name?: string | null;
          mobile_phone_number?: string | null;
          patient_status_id?: number | null;
          phone_number?: string | null;
          preferred_contact_method?: string | null;
          preferred_language?: string | null;
          preferred_name?: string | null;
          previous_name?: string | null;
          profile_id?: string | null;
          race?: string | null;
          social_security_number?: string | null;
          state?: string | null;
          suffix?: string | null;
          updated_at?: string;
          zip_code?: string | null;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          branch?: string | null;
          city?: string | null;
          created_at?: string;
          date_of_birth?: string;
          email?: string | null;
          ethnicity?: string | null;
          first_name?: string;
          gender?: string | null;
          id?: string;
          is_active?: boolean;
          last_name?: string;
          marital_status?: string | null;
          middle_name?: string | null;
          mobile_phone_number?: string | null;
          patient_status_id?: number | null;
          phone_number?: string | null;
          preferred_contact_method?: string | null;
          preferred_language?: string | null;
          preferred_name?: string | null;
          previous_name?: string | null;
          profile_id?: string | null;
          race?: string | null;
          social_security_number?: string | null;
          state?: string | null;
          suffix?: string | null;
          updated_at?: string;
          zip_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'patients_patient_status_id_fkey';
            columns: ['patient_status_id'];
            isOneToOne: false;
            referencedRelation: 'patient_statuses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patients_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      profiles: {
        Row: {
          birthdate: string | null;
          created_at: string;
          email: string;
          first_name: string;
          full_name: string | null;
          gender: string | null;
          id: string;
          job_title: string | null;
          last_name: string;
          preferred_name: string | null;
          role: Database['public']['Enums']['user_role'];
          committees: string | null;
          updated_at: string;
        };
        Insert: {
          birthdate?: string | null;
          created_at?: string;
          email: string;
          first_name: string;
          full_name?: string | null;
          gender?: string | null;
          id?: string;
          job_title?: string | null;
          last_name: string;
          preferred_name?: string | null;
          role?: Database['public']['Enums']['user_role'];
          committees?: string | null;
          updated_at?: string;
        };
        Update: {
          birthdate?: string | null;
          created_at?: string;
          email?: string;
          first_name?: string;
          full_name?: string | null;
          gender?: string | null;
          id?: string;
          job_title?: string | null;
          last_name?: string;
          preferred_name?: string | null;
          role?: Database['public']['Enums']['user_role'];
          committees?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_templates: {
        Row: {
          created_at: string | null;
          description: string | null;
          is_required: boolean | null;
          name: string;
          relevant_policy_chunk_ids: string[] | null;
          step_number: number;
          task_template_id: string;
          updated_at: string | null;
          workflow_template_id: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          is_required?: boolean | null;
          name: string;
          relevant_policy_chunk_ids?: string[] | null;
          step_number: number;
          task_template_id?: string;
          updated_at?: string | null;
          workflow_template_id: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          is_required?: boolean | null;
          name?: string;
          relevant_policy_chunk_ids?: string[] | null;
          step_number?: number;
          task_template_id?: string;
          updated_at?: string | null;
          workflow_template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_templates_workflow_template_id_fkey';
            columns: ['workflow_template_id'];
            isOneToOne: false;
            referencedRelation: 'workflow_templates';
            referencedColumns: ['template_id'];
          }
        ];
      };
      workflow_templates: {
        Row: {
          created_at: string | null;
          description: string | null;
          name: string;
          template_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          name: string;
          template_id?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          name?: string;
          template_id?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_patient_portal_invitation: {
        Args: { p_token: string };
        Returns: boolean;
      };
      create_appointment: {
        Args: {
          p_patient_id: string;
          p_appointment_datetime: string;
          p_duration_minutes?: number;
          p_service_type?: string;
          p_practitioner_name?: string;
          p_location?: string;
          p_notes?: string;
          p_status?: string;
          p_is_all_day?: boolean;
          p_recurrence_rule?: string;
        };
        Returns: string;
      };
      create_document_from_template: {
        Args: {
          p_patient_id: string;
          p_template_id: string;
          p_document_name?: string;
          p_document_status?: string;
          p_form_data?: Json;
        };
        Returns: string;
      };
      create_family_member_profile: {
        Args: {
          p_first_name: string;
          p_last_name: string;
          p_email: string;
          p_phone: string;
        };
        Returns: string;
      };
      create_patient: {
        Args: {
          p_first_name: string;
          p_last_name: string;
          p_date_of_birth: string;
          p_gender?: string;
          p_phone_number?: string;
          p_email?: string;
          p_address_line1?: string;
          p_address_line2?: string;
          p_city?: string;
          p_state?: string;
          p_zip_code?: string;
          p_profile_id?: string;
        };
        Returns: {
          id: string;
          profile_id: string;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          gender: string;
          phone_number: string;
          email: string;
          address_line1: string;
          address_line2: string;
          city: string;
          state: string;
          zip_code: string;
          created_at: string;
          updated_at: string;
        }[];
      };
      delete_appointment: {
        Args: { p_appointment_id: string };
        Returns: boolean;
      };
      delete_patient_document: {
        Args: { p_document_id: string };
        Returns: boolean;
      };
      generate_appointment_ics: {
        Args: { p_appointment_id: string };
        Returns: string;
      };
      get_all_family_links_for_patient: {
        Args: { p_patient_id: string };
        Returns: {
          link_id: string;
          relationship: string;
          is_active: boolean;
          is_emergency_contact: boolean;
          is_designated_representative: boolean;
          profile_first_name: string;
          profile_last_name: string;
          profile_role: string;
          profile_email: string;
          profile_phone: string;
        }[];
      };
      get_appointments_needing_sync: {
        Args: Record<PropertyKey, never>;
        Returns: {
          appointment_datetime: string;
          created_at: string;
          created_by: string | null;
          duration_minutes: number | null;
          google_calendar_event_id: string | null;
          ics_uid: string | null;
          id: string;
          is_all_day: boolean | null;
          last_synced_at: string | null;
          location: string | null;
          needs_sync: boolean | null;
          notes: string | null;
          patient_id: string;
          practitioner_name: string | null;
          recurrence_rule: string | null;
          service_type: string | null;
          status: string;
          updated_at: string;
        }[];
      };
      get_invitation_details: {
        Args: { p_token: string };
        Returns: {
          id: string;
          patient_id: string;
          email: string;
          role: string;
          patient_first_name: string;
          patient_last_name: string;
          expires_at: string;
          status: string;
        }[];
      };
      get_patient_details: {
        Args: { p_patient_id: string };
        Returns: {
          address_line1: string | null;
          address_line2: string | null;
          branch: string | null;
          city: string | null;
          created_at: string;
          date_of_birth: string;
          email: string | null;
          ethnicity: string | null;
          first_name: string;
          gender: string | null;
          id: string;
          is_active: boolean;
          last_name: string;
          marital_status: string | null;
          middle_name: string | null;
          mobile_phone_number: string | null;
          patient_status_id: number | null;
          phone_number: string | null;
          preferred_contact_method: string | null;
          preferred_language: string | null;
          preferred_name: string | null;
          previous_name: string | null;
          profile_id: string | null;
          race: string | null;
          social_security_number: string | null;
          state: string | null;
          suffix: string | null;
          updated_at: string;
          zip_code: string | null;
        }[];
      };
      get_patient_list: {
        Args: Record<PropertyKey, never>;
        Returns: {
          address_line1: string | null;
          address_line2: string | null;
          branch: string | null;
          city: string | null;
          created_at: string;
          date_of_birth: string;
          email: string | null;
          ethnicity: string | null;
          first_name: string;
          gender: string | null;
          id: string;
          is_active: boolean;
          last_name: string;
          marital_status: string | null;
          middle_name: string | null;
          mobile_phone_number: string | null;
          patient_status_id: number | null;
          phone_number: string | null;
          preferred_contact_method: string | null;
          preferred_language: string | null;
          preferred_name: string | null;
          previous_name: string | null;
          profile_id: string | null;
          race: string | null;
          social_security_number: string | null;
          state: string | null;
          suffix: string | null;
          updated_at: string;
          zip_code: string | null;
        }[];
      };
      get_patient_upcoming_appointments: {
        Args: { p_patient_id: string; p_days_ahead?: number };
        Returns: {
          appointment_datetime: string;
          created_at: string;
          created_by: string | null;
          duration_minutes: number | null;
          google_calendar_event_id: string | null;
          ics_uid: string | null;
          id: string;
          is_all_day: boolean | null;
          last_synced_at: string | null;
          location: string | null;
          needs_sync: boolean | null;
          notes: string | null;
          patient_id: string;
          practitioner_name: string | null;
          recurrence_rule: string | null;
          service_type: string | null;
          status: string;
          updated_at: string;
        }[];
      };
      invite_patient_portal_access: {
        Args: {
          p_patient_id: string;
          p_invitee_email: string;
          p_invited_as_role: Database['public']['Enums']['user_role'];
          p_expiry_days?: number;
        };
        Returns: string;
      };
      is_linked_family_contact_for_patient: {
        Args: { p_patient_id: string; p_user_id: string };
        Returns: boolean;
      };
      reschedule_appointment: {
        Args: {
          p_appointment_id: string;
          p_new_datetime: string;
          p_new_duration_minutes?: number;
        };
        Returns: boolean;
      };
      sign_patient_document: {
        Args: { p_document_id: string; p_signed_data?: Json };
        Returns: boolean;
      };
      update_appointment: {
        Args: {
          p_appointment_id: string;
          p_appointment_datetime?: string;
          p_duration_minutes?: number;
          p_service_type?: string;
          p_practitioner_name?: string;
          p_location?: string;
          p_notes?: string;
          p_status?: string;
          p_is_all_day?: boolean;
          p_recurrence_rule?: string;
        };
        Returns: boolean;
      };
      update_appointment_sync_status: {
        Args: {
          p_appointment_id: string;
          p_google_calendar_event_id?: string;
          p_ics_uid?: string;
        };
        Returns: boolean;
      };
      update_patient: {
        Args: {
          p_id: string;
          p_first_name?: string;
          p_last_name?: string;
          p_date_of_birth?: string;
          p_sex?: string;
          p_gender?: string;
          p_address?: string;
          p_phone_number?: string;
          p_emergency_contact_name?: string;
          p_emergency_contact_phone?: string;
          p_preferred_language?: string;
          p_ethnicity?: string;
          p_race?: string;
          p_is_active?: boolean;
        };
        Returns: {
          address_line1: string | null;
          address_line2: string | null;
          branch: string | null;
          city: string | null;
          created_at: string;
          date_of_birth: string;
          email: string | null;
          ethnicity: string | null;
          first_name: string;
          gender: string | null;
          id: string;
          is_active: boolean;
          last_name: string;
          marital_status: string | null;
          middle_name: string | null;
          mobile_phone_number: string | null;
          patient_status_id: number | null;
          phone_number: string | null;
          preferred_contact_method: string | null;
          preferred_language: string | null;
          preferred_name: string | null;
          previous_name: string | null;
          profile_id: string | null;
          race: string | null;
          social_security_number: string | null;
          state: string | null;
          suffix: string | null;
          updated_at: string;
          zip_code: string | null;
        }[];
      };
      update_patient_document: {
        Args: {
          p_document_id: string;
          p_document_name?: string;
          p_document_type?: string;
          p_description?: string;
          p_document_status?: string;
          p_requires_signature?: boolean;
          p_metadata?: Json;
        };
        Returns: boolean;
      };
      upload_patient_document: {
        Args: {
          p_patient_id: string;
          p_document_name: string;
          p_document_type_text: string;
          p_file_storage_path: string;
          p_file_mime_type: string;
          p_file_size: number;
          p_original_filename: string;
          p_description?: string;
          p_requires_signature?: boolean;
          p_document_status_text?: string;
          p_metadata?: Json;
        };
        Returns: string;
      };
      version_patient_document: {
        Args: {
          p_document_id: string;
          p_new_file_storage_path: string;
          p_new_file_mime_type?: string;
          p_new_file_size?: number;
          p_new_original_filename?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      appointment_status:
        | 'scheduled'
        | 'confirmed'
        | 'completed'
        | 'cancelled'
        | 'no_show'
        | 'rescheduled';
      credential_status_enum:
        | 'active'
        | 'expired'
        | 'pending_verification'
        | 'verified'
        | 'rejected'
        | 'revoked';
      credential_type_enum: 'License' | 'Certification' | 'Immunization' | 'Training' | 'Other';
      document_status: 'draft' | 'pending_signature' | 'signed' | 'archived' | 'rejected';
      document_type:
        | 'admission_form'
        | 'consent_form'
        | 'medical_record'
        | 'insurance_card'
        | 'identification'
        | 'advance_directive'
        | 'care_plan'
        | 'assessment'
        | 'progress_note'
        | 'other';
      document_type_enum:
        | 'contract'
        | 'policy'
        | 'onboarding_form'
        | 'id_verification'
        | 'medical_record'
        | 'performance_review'
        | 'other';
      onboarding_status_enum: 'pending' | 'in_progress' | 'completed' | 'deferred';
      onboarding_task_status_enum:
        | 'pending'
        | 'in_progress'
        | 'completed'
        | 'requires_attention'
        | 'skipped';
      user_role:
        | 'admin'
        | 'staff'
        | 'patient'
        | 'family_contact'
        | 'financial_admin'
        | 'clinician'
        | 'assistant'
        | 'hr_admin'
        | 'administrator'
        | 'hha'
        | 'case_manager'
        | 'referral_source'
        | 'unassigned'
        | 'clinical_administrator';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
  ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: [
        'scheduled',
        'confirmed',
        'completed',
        'cancelled',
        'no_show',
        'rescheduled',
      ],
      credential_status_enum: [
        'active',
        'expired',
        'pending_verification',
        'verified',
        'rejected',
        'revoked',
      ],
      credential_type_enum: ['License', 'Certification', 'Immunization', 'Training', 'Other'],
      document_status: ['draft', 'pending_signature', 'signed', 'archived', 'rejected'],
      document_type: [
        'admission_form',
        'consent_form',
        'medical_record',
        'insurance_card',
        'identification',
        'advance_directive',
        'care_plan',
        'assessment',
        'progress_note',
        'other',
      ],
      document_type_enum: [
        'contract',
        'policy',
        'onboarding_form',
        'id_verification',
        'medical_record',
        'performance_review',
        'other',
      ],
      onboarding_status_enum: ['pending', 'in_progress', 'completed', 'deferred'],
      onboarding_task_status_enum: [
        'pending',
        'in_progress',
        'completed',
        'requires_attention',
        'skipped',
      ],
      user_role: [
        'admin',
        'staff',
        'patient',
        'family_contact',
        'financial_admin',
        'clinician',
        'assistant',
        'hr_admin',
        'administrator',
        'hha',
        'case_manager',
        'referral_source',
        'unassigned',
        'clinical_administrator',
      ],
    },
  },
} as const;
