export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_datetime: string;
          created_at: string;
          created_by: string | null;
          duration_minutes: number | null;
          id: string;
          location: string | null;
          notes: string | null;
          patient_id: string;
          practitioner_name: string | null;
          service_type: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          appointment_datetime: string;
          created_at?: string;
          created_by?: string | null;
          duration_minutes?: number | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          patient_id: string;
          practitioner_name?: string | null;
          service_type?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          appointment_datetime?: string;
          created_at?: string;
          created_by?: string | null;
          duration_minutes?: number | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          patient_id?: string;
          practitioner_name?: string | null;
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
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          details: Json;
          id: string;
          ip_address: string | null;
          resource_id: string | null;
          resource_type: string;
          success: boolean;
          timestamp: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          details?: Json;
          id?: string;
          ip_address?: string | null;
          resource_id?: string | null;
          resource_type: string;
          success?: boolean;
          timestamp?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          ip_address?: string | null;
          resource_id?: string | null;
          resource_type?: string;
          success?: boolean;
          timestamp?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      languages: {
        Row: {
          id: number;
          is_active: boolean;
          iso_code_639_1: string | null;
          name: string;
        };
        Insert: {
          id?: number;
          is_active?: boolean;
          iso_code_639_1?: string | null;
          name: string;
        };
        Update: {
          id?: number;
          is_active?: boolean;
          iso_code_639_1?: string | null;
          name?: string;
        };
        Relationships: [];
      };
      patient_documents: {
        Row: {
          created_at: string;
          description: string | null;
          document_name: string;
          document_type: string | null;
          file_mime_type: string | null;
          file_storage_path: string;
          id: string;
          patient_id: string;
          updated_at: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          document_name: string;
          document_type?: string | null;
          file_mime_type?: string | null;
          file_storage_path: string;
          id?: string;
          patient_id: string;
          updated_at?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          document_name?: string;
          document_type?: string | null;
          file_mime_type?: string | null;
          file_storage_path?: string;
          id?: string;
          patient_id?: string;
          updated_at?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'patient_documents_patient_id_fkey';
            columns: ['patient_id'];
            isOneToOne: false;
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patient_documents_uploaded_by_fkey';
            columns: ['uploaded_by'];
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
          relationship: string;
          relationship_type: string | null;
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
          relationship: string;
          relationship_type?: string | null;
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
          relationship?: string;
          relationship_type?: string | null;
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
      patient_genders: {
        Row: {
          code: string | null;
          display_order: number | null;
          id: number;
          is_active: boolean;
          name: string;
        };
        Insert: {
          code?: string | null;
          display_order?: number | null;
          id?: number;
          is_active?: boolean;
          name: string;
        };
        Update: {
          code?: string | null;
          display_order?: number | null;
          id?: number;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      patient_notes: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          note_text: string;
          patient_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note_text: string;
          patient_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note_text?: string;
          patient_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patient_notes_patient_id_fkey';
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
          description: string | null;
          id: number;
          is_active: boolean;
          name: string;
        };
        Insert: {
          description?: string | null;
          id?: number;
          is_active?: boolean;
          name: string;
        };
        Update: {
          description?: string | null;
          id?: number;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      patients: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          country: string;
          created_at: string;
          created_by: string | null;
          date_of_birth: string;
          deceased_date: string | null;
          ehr_patient_id: string | null;
          email: string | null;
          emergency_contact_email: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relationship: string | null;
          first_name: string;
          gender_id: number | null;
          id: string;
          is_active: boolean;
          last_name: string;
          medical_record_number: string | null;
          middle_name: string | null;
          notes: string | null;
          patient_status_id: number;
          phone_number: string | null;
          phone_number_type: string | null;
          preferred_language_id: number | null;
          preferred_name: string | null;
          profile_id: string | null;
          state_province: string | null;
          updated_at: string;
          updated_by: string | null;
          zip_postal_code: string | null;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          date_of_birth: string;
          deceased_date?: string | null;
          ehr_patient_id?: string | null;
          email?: string | null;
          emergency_contact_email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relationship?: string | null;
          first_name: string;
          gender_id?: number | null;
          id?: string;
          is_active?: boolean;
          last_name: string;
          medical_record_number?: string | null;
          middle_name?: string | null;
          notes?: string | null;
          patient_status_id?: number;
          phone_number?: string | null;
          phone_number_type?: string | null;
          preferred_language_id?: number | null;
          preferred_name?: string | null;
          profile_id?: string | null;
          state_province?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          zip_postal_code?: string | null;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          date_of_birth?: string;
          deceased_date?: string | null;
          ehr_patient_id?: string | null;
          email?: string | null;
          emergency_contact_email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relationship?: string | null;
          first_name?: string;
          gender_id?: number | null;
          id?: string;
          is_active?: boolean;
          last_name?: string;
          medical_record_number?: string | null;
          middle_name?: string | null;
          notes?: string | null;
          patient_status_id?: number;
          phone_number?: string | null;
          phone_number_type?: string | null;
          preferred_language_id?: number | null;
          preferred_name?: string | null;
          profile_id?: string | null;
          state_province?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          zip_postal_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'patients_gender_id_fkey';
            columns: ['gender_id'];
            isOneToOne: false;
            referencedRelation: 'patient_genders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patients_patient_status_id_fkey';
            columns: ['patient_status_id'];
            isOneToOne: false;
            referencedRelation: 'patient_statuses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patients_preferred_language_id_fkey';
            columns: ['preferred_language_id'];
            isOneToOne: false;
            referencedRelation: 'languages';
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
      policy_chunks: {
        Row: {
          chunk_index: number;
          chunk_text: string;
          created_at: string;
          document_id: string;
          embedding: string | null;
          fts: unknown | null;
          id: string;
          metadata: Json | null;
        };
        Insert: {
          chunk_index: number;
          chunk_text: string;
          created_at?: string;
          document_id: string;
          embedding?: string | null;
          fts?: unknown | null;
          id?: string;
          metadata?: Json | null;
        };
        Update: {
          chunk_index?: number;
          chunk_text?: string;
          created_at?: string;
          document_id?: string;
          embedding?: string | null;
          fts?: unknown | null;
          id?: string;
          metadata?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'policy_chunks_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'policy_documents';
            referencedColumns: ['id'];
          }
        ];
      };
      policy_documents: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          effective_date: string | null;
          file_name: string;
          file_path: string;
          file_size: number;
          file_type: string;
          id: string;
          review_date: string | null;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string;
          version: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          effective_date?: string | null;
          file_name: string;
          file_path: string;
          file_size: number;
          file_type: string;
          id?: string;
          review_date?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by: string;
          version?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          effective_date?: string | null;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          file_type?: string;
          id?: string;
          review_date?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          version?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          first_name: string | null;
          id: string;
          last_name: string | null;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        Insert: {
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Update: {
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          role?: Database['public']['Enums']['user_role'];
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
      user_permissions: {
        Row: {
          created_at: string;
          id: string;
          permission_type: string;
          resource_id: string | null;
          resource_type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          permission_type: string;
          resource_id?: string | null;
          resource_type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          permission_type?: string;
          resource_id?: string | null;
          resource_type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
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
          ehr_patient_id: string;
          medical_record_number: string;
          first_name: string;
          middle_name: string;
          last_name: string;
          preferred_name: string;
          date_of_birth: string;
          gender_id: number;
          email: string;
          phone_number: string;
          phone_number_type: string;
          address_line1: string;
          address_line2: string;
          city: string;
          state_province: string;
          zip_postal_code: string;
          country: string;
          emergency_contact_name: string;
          emergency_contact_phone: string;
          emergency_contact_email: string;
          emergency_contact_relationship: string;
          patient_status_id: number;
          is_active: boolean;
          deceased_date: string;
          preferred_language_id: number;
          notes: string;
          created_at: string;
          updated_at: string;
          created_by: string;
          updated_by: string;
        }[];
      };
      create_family_member_profile: {
        Args: {
          p_first_name: string;
          p_last_name: string;
          p_email?: string | null;
          p_phone?: string | null;
        };
        Returns: string; // UUID as string
      };
      fts_policy_chunks: {
        Args: { query_text: string; match_count?: number };
        Returns: {
          id: string;
          document_id: string;
          chunk_index: number;
          chunk_text: string;
          rank: number;
          document_title: string;
          document_status: string;
        }[];
      };
      get_available_functions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          schema: string;
          name: string;
          result_data_type: string;
          argument_data_types: string;
          type: string;
          security: string;
        }[];
      };
      get_family_links_for_patient: {
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
        }[];
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
        }[];
      };
      get_my_profile: {
        Args: Record<PropertyKey, never>;
        Returns: {
          first_name: string | null;
          id: string;
          last_name: string | null;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        }[];
      };
      get_patient_by_id: {
        Args: { p_patient_id: string };
        Returns: Json;
      };
      invite_patient_portal_access: {
        Args: {
          p_patient_id: string;
          p_email: string;
          p_role: string;
          p_expiry_days?: number;
        };
        Returns: string; // UUID is returned as string
      };
      match_policy_chunks: {
        Args: {
          query_embedding: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: string;
          document_id: string;
          chunk_index: number;
          chunk_text: string;
          similarity: number;
          document_title: string;
          document_status: string;
          metadata: Json;
        }[];
      };
      pg_query: {
        Args: { sql_query: string };
        Returns: Json;
      };
    };
    Enums: {
      user_role:
        | 'financial_admin'
        | 'clinician'
        | 'assistant'
        | 'hr_admin'
        | 'administrator'
        | 'hha'
        | 'patient'
        | 'family_contact'
        | 'case_manager'
        | 'referral_source'
        | 'unassigned';
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
  public: {
    Enums: {
      user_role: [
        'financial_admin',
        'clinician',
        'assistant',
        'hr_admin',
        'administrator',
        'hha',
        'patient',
        'family_contact',
        'case_manager',
        'referral_source',
        'unassigned',
      ],
    },
  },
} as const;
