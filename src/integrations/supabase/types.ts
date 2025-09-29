export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_chat_context_files: {
        Row: {
          created_at: string
          data_upload_id: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          data_upload_id: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          data_upload_id?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_context_files_data_upload_id_fkey"
            columns: ["data_upload_id"]
            isOneToOne: false
            referencedRelation: "farmer_data_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_context_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          sender_role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sender_role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sender_role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          assignment_id: string | null
          created_at: string
          farmer_id: string
          id: string
          phase: number
          specialist_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          farmer_id: string
          id?: string
          phase: number
          specialist_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          farmer_id?: string
          id?: string
          phase?: number
          specialist_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_sessions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "specialist_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_sessions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "specialist_dashboard_data"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "ai_chat_sessions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_attachments: {
        Row: {
          created_at: string | null
          data_upload_id: string
          id: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          data_upload_id: string
          id?: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          data_upload_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_attachments_data_upload_id_fkey"
            columns: ["data_upload_id"]
            isOneToOne: false
            referencedRelation: "farmer_data_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_sessions: {
        Row: {
          analysis_prompt: string
          bank_id: string
          context_data: Json | null
          created_at: string | null
          farmer_id: string
          id: string
          llm_model: string | null
          llm_response: string | null
          llm_usage: Json | null
          phase: number
          session_name: string
          specialist_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          analysis_prompt: string
          bank_id: string
          context_data?: Json | null
          created_at?: string | null
          farmer_id: string
          id?: string
          llm_model?: string | null
          llm_response?: string | null
          llm_usage?: Json | null
          phase: number
          session_name: string
          specialist_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          analysis_prompt?: string
          bank_id?: string
          context_data?: Json | null
          created_at?: string | null
          farmer_id?: string
          id?: string
          llm_model?: string | null
          llm_response?: string | null
          llm_usage?: Json | null
          phase?: number
          session_name?: string
          specialist_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_sessions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_sessions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachments: Json | null
          bank_id: string
          created_at: string | null
          farmer_id: string
          id: string
          is_read: boolean | null
          message: string
          sender_id: string
          sender_role: string
          session_id: string | null
        }
        Insert: {
          attachments?: Json | null
          bank_id: string
          created_at?: string | null
          farmer_id: string
          id?: string
          is_read?: boolean | null
          message: string
          sender_id: string
          sender_role: string
          session_id?: string | null
        }
        Update: {
          attachments?: Json | null
          bank_id?: string
          created_at?: string | null
          farmer_id?: string
          id?: string
          is_read?: boolean | null
          message?: string
          sender_id?: string
          sender_role?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      f100: {
        Row: {
          bank_id: string
          created_at: string
          farmer_id: string
          file_mime: string | null
          file_path: string
          file_size_bytes: number | null
          id: string
          issue_date: string
          phase: number
          score: number
        }
        Insert: {
          bank_id: string
          created_at?: string
          farmer_id: string
          file_mime?: string | null
          file_path: string
          file_size_bytes?: number | null
          id?: string
          issue_date: string
          phase: number
          score: number
        }
        Update: {
          bank_id?: string
          created_at?: string
          farmer_id?: string
          file_mime?: string | null
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          issue_date?: string
          phase?: number
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "f100_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "f100_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_data_uploads: {
        Row: {
          bank_id: string
          created_at: string | null
          data_type: Database["public"]["Enums"]["data_type"]
          description: string | null
          farmer_id: string
          file_mime: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id: string
          metadata: Json | null
          phase: number
          tags: string[] | null
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          bank_id: string
          created_at?: string | null
          data_type: Database["public"]["Enums"]["data_type"]
          description?: string | null
          farmer_id: string
          file_mime: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id?: string
          metadata?: Json | null
          phase: number
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          bank_id?: string
          created_at?: string | null
          data_type?: Database["public"]["Enums"]["data_type"]
          description?: string | null
          farmer_id?: string
          file_mime?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          id?: string
          metadata?: Json | null
          phase?: number
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_data_uploads_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_data_uploads_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_documents: {
        Row: {
          bank_id: string
          created_at: string
          created_by: string | null
          document_type: string
          farmer_id: string
          file_mime: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id: string
          uploaded_at: string
        }
        Insert: {
          bank_id: string
          created_at?: string
          created_by?: string | null
          document_type: string
          farmer_id: string
          file_mime: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id?: string
          uploaded_at?: string
        }
        Update: {
          bank_id?: string
          created_at?: string
          created_by?: string | null
          document_type?: string
          farmer_id?: string
          file_mime?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_documents_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_documents_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_loans: {
        Row: {
          amount: number
          bank_id: string
          created_at: string
          created_by: string | null
          currency: string
          end_date: string
          farmer_id: string
          id: string
          issuance_date: string
          start_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          end_date: string
          farmer_id: string
          id?: string
          issuance_date: string
          start_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string
          farmer_id?: string
          id?: string
          issuance_date?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_loans_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      farmers: {
        Row: {
          area: number | null
          bank_comment: string | null
          bank_id: string
          cadastral_codes: string[] | null
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          crop: string | null
          crop_types: string[] | null
          equipment_list: string | null
          farm_size: number | null
          farmer_location: string | null
          full_name: string | null
          has_reservoir: boolean | null
          id: string
          id_number: string
          irrigation_sectors_count: number | null
          irrigation_type: string | null
          last_harvest_date: string | null
          last_year_harvest_amount: number | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          ltd_name: string | null
          mobile: string | null
          name: string
          other_comment: string | null
          registration_date: string | null
          reservoir_amount: number | null
          reservoir_capacity: number | null
          seasonal_income: number | null
          service_cost_breakdown: Json | null
          service_cost_selections: Json | null
          service_cost_tariff: string | null
          service_cost_total_eur: number | null
          type: Database["public"]["Enums"]["farmer_type"]
          variety: string | null
          variety_cultivation_area: number | null
          variety_cultivation_year: number | null
          water_source: string | null
        }
        Insert: {
          area?: number | null
          bank_comment?: string | null
          bank_id: string
          cadastral_codes?: string[] | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          crop?: string | null
          crop_types?: string[] | null
          equipment_list?: string | null
          farm_size?: number | null
          farmer_location?: string | null
          full_name?: string | null
          has_reservoir?: boolean | null
          id?: string
          id_number: string
          irrigation_sectors_count?: number | null
          irrigation_type?: string | null
          last_harvest_date?: string | null
          last_year_harvest_amount?: number | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          ltd_name?: string | null
          mobile?: string | null
          name: string
          other_comment?: string | null
          registration_date?: string | null
          reservoir_amount?: number | null
          reservoir_capacity?: number | null
          seasonal_income?: number | null
          service_cost_breakdown?: Json | null
          service_cost_selections?: Json | null
          service_cost_tariff?: string | null
          service_cost_total_eur?: number | null
          type?: Database["public"]["Enums"]["farmer_type"]
          variety?: string | null
          variety_cultivation_area?: number | null
          variety_cultivation_year?: number | null
          water_source?: string | null
        }
        Update: {
          area?: number | null
          bank_comment?: string | null
          bank_id?: string
          cadastral_codes?: string[] | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          crop?: string | null
          crop_types?: string[] | null
          equipment_list?: string | null
          farm_size?: number | null
          farmer_location?: string | null
          full_name?: string | null
          has_reservoir?: boolean | null
          id?: string
          id_number?: string
          irrigation_sectors_count?: number | null
          irrigation_type?: string | null
          last_harvest_date?: string | null
          last_year_harvest_amount?: number | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          ltd_name?: string | null
          mobile?: string | null
          name?: string
          other_comment?: string | null
          registration_date?: string | null
          reservoir_amount?: number | null
          reservoir_capacity?: number | null
          seasonal_income?: number | null
          service_cost_breakdown?: Json | null
          service_cost_selections?: Json | null
          service_cost_tariff?: string | null
          service_cost_total_eur?: number | null
          type?: Database["public"]["Enums"]["farmer_type"]
          variety?: string | null
          variety_cultivation_area?: number | null
          variety_cultivation_year?: number | null
          water_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmers_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_api_keys: {
        Row: {
          created_at: string | null
          encrypted_key: string
          id: string
          is_active: boolean | null
          key_name: string
          last_used_at: string | null
          provider: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_key: string
          id?: string
          is_active?: boolean | null
          key_name: string
          last_used_at?: string | null
          provider: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string
          id?: string
          is_active?: boolean | null
          key_name?: string
          last_used_at?: string | null
          provider?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      pending_invitations: {
        Row: {
          accepted_at: string | null
          bank_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          bank_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          bank_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invitations_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bank_id: string | null
          created_at: string
          invitation_accepted_at: string | null
          invitation_status: string | null
          invited_at: string | null
          invited_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          bank_id?: string | null
          created_at?: string
          invitation_accepted_at?: string | null
          invitation_status?: string | null
          invited_at?: string | null
          invited_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          bank_id?: string | null
          created_at?: string
          invitation_accepted_at?: string | null
          invitation_status?: string | null
          invited_at?: string | null
          invited_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          bank_id: string
          completed_at: string | null
          created_at: string | null
          farmer_id: string
          id: string
          notes: string | null
          phase: number
          specialist_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          bank_id: string
          completed_at?: string | null
          created_at?: string | null
          farmer_id: string
          id?: string
          notes?: string | null
          phase: number
          specialist_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          bank_id?: string
          completed_at?: string | null
          created_at?: string | null
          farmer_id?: string
          id?: string
          notes?: string | null
          phase?: number
          specialist_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "specialist_assignments_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_assignments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_devices: {
        Row: {
          created_at: string
          device_fingerprint: string
          device_info: Json
          expires_at: string
          id: string
          last_used_at: string | null
          user_email: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          device_info?: Json
          expires_at: string
          id?: string
          last_used_at?: string | null
          user_email: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          device_info?: Json
          expires_at?: string
          id?: string
          last_used_at?: string | null
          user_email?: string
        }
        Relationships: []
      }
      two_factor_codes: {
        Row: {
          attempts: number | null
          code_hash: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          attempts?: number | null
          code_hash: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          attempts?: number | null
          code_hash?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      specialist_dashboard_data: {
        Row: {
          analysis_count: number | null
          analysis_sessions_count: number | null
          assigned_at: string | null
          assignment_id: string | null
          assignment_status: string | null
          bank_name: string | null
          data_uploads_count: number | null
          farmer_id: string | null
          farmer_id_number: string | null
          farmer_name: string | null
          last_analysis_at: string | null
          maps_count: number | null
          notes: string | null
          phase: number | null
          photo_count: number | null
          text_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "specialist_assignments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_latest_f100: {
        Row: {
          bank_id: string | null
          created_at: string | null
          farmer_id: string | null
          file_path: string | null
          id: string | null
          issue_date: string | null
          phase: number | null
          score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "f100_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "f100_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recent_invitations: {
        Row: {
          bank_id: string | null
          bank_name: string | null
          created_at: string | null
          email: string | null
          invitation_accepted_at: string | null
          invitation_status: string | null
          invited_at: string | null
          invited_by: string | null
          role: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_trusted_device: {
        Args: {
          p_device_fingerprint: string
          p_device_info?: Json
          p_user_email: string
        }
        Returns: string
      }
      admin_insert_farmer_data_upload: {
        Args: {
          p_bank_id: string
          p_data_type: string
          p_description?: string
          p_farmer_id: string
          p_file_mime: string
          p_file_name: string
          p_file_path: string
          p_file_size: number
          p_metadata?: Json
          p_phase?: number
          p_tags?: string[]
        }
        Returns: string
      }
      cleanup_expired_2fa_codes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_trusted_devices: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      decrypt_api_key: {
        Args: { encrypted_key: string }
        Returns: string
      }
      delete_specialist_assignment: {
        Args: { p_assignment_id: string }
        Returns: boolean
      }
      encrypt_api_key: {
        Args: { api_key: string }
        Returns: string
      }
      get_invitation_details: {
        Args: Record<PropertyKey, never> | { invitation_token: string }
        Returns: {
          bank_id: string
          bank_name: string
          created_at: string
          email: string
          invitation_accepted_at: string
          invitation_status: string
          invited_at: string
          invited_by: string
          role: string
          user_id: string
        }[]
      }
      get_specialist_assignments: {
        Args: { p_specialist_id?: string }
        Returns: {
          analysis_sessions_count: number
          assigned_at: string
          assignment_id: string
          bank_name: string
          data_uploads_count: number
          farmer_id: string
          farmer_id_number: string
          farmer_name: string
          farmer_crop?: string
          last_activity: string
          phase: number
          status: string
          f100_doc_url?: string
        }[]
      }
      admin_update_assignment_f100_url: {
        Args: { p_assignment_id: string; p_f100_doc_url: string }
        Returns: undefined
      }
      is_device_trusted: {
        Args: { p_device_fingerprint: string; p_user_email: string }
        Returns: boolean
      }
      list_farmers_with_latest_f100: {
        Args: {
          filter_bank_id?: string
          from_date?: string
          search?: string
          to_date?: string
        }
        Returns: {
          bank_id: string
          farmer_id: string
          id_number: string
          latest: Json
          name: string
        }[]
      }
      list_specialists: {
        Args: { p_bank_id?: string }
        Returns: {
          bank_id: string
          email: string
          user_id: string
        }[]
      }
      sync_invitation_statuses: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      analysis_phase:
        | "initial_assessment"
        | "crop_analysis"
        | "soil_analysis"
        | "irrigation_analysis"
        | "harvest_analysis"
        | "financial_analysis"
        | "compliance_review"
        | "final_report"
      analysis_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "requires_review"
        | "cancelled"
      data_type:
        | "photo"
        | "analysis"
        | "geospatial"
        | "text"
        | "document"
        | "video"
        | "audio"
        | "maps"
        | "climate"
      farmer_type: "person" | "company"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      analysis_phase: [
        "initial_assessment",
        "crop_analysis",
        "soil_analysis",
        "irrigation_analysis",
        "harvest_analysis",
        "financial_analysis",
        "compliance_review",
        "final_report",
      ],
      analysis_status: [
        "pending",
        "in_progress",
        "completed",
        "requires_review",
        "cancelled",
      ],
      data_type: [
        "photo",
        "analysis",
        "geospatial",
        "text",
        "document",
        "video",
        "audio",
        "maps",
        "climate",
      ],
      farmer_type: ["person", "company"],
    },
  },
} as const
