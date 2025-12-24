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
      admin_impersonation_actions: {
        Row: {
          action_description: string | null
          action_type: string
          api_endpoint: string | null
          duration_ms: number | null
          id: string
          ip_address: unknown
          page_url: string | null
          performed_at: string
          request_data: Json | null
          response_status: number | null
          session_id: string
          user_agent: string | null
        }
        Insert: {
          action_description?: string | null
          action_type: string
          api_endpoint?: string | null
          duration_ms?: number | null
          id?: string
          ip_address?: unknown
          page_url?: string | null
          performed_at?: string
          request_data?: Json | null
          response_status?: number | null
          session_id: string
          user_agent?: string | null
        }
        Update: {
          action_description?: string | null
          action_type?: string
          api_endpoint?: string | null
          duration_ms?: number | null
          id?: string
          ip_address?: unknown
          page_url?: string | null
          performed_at?: string
          request_data?: Json | null
          response_status?: number | null
          session_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_impersonation_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "admin_impersonation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_impersonation_sessions: {
        Row: {
          admin_email: string
          admin_role: string
          admin_user_id: string
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          reason: string | null
          started_at: string
          target_email: string
          target_role: string
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          admin_email: string
          admin_role: string
          admin_user_id: string
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          reason?: string | null
          started_at?: string
          target_email: string
          target_role: string
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          admin_email?: string
          admin_role?: string
          admin_user_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          reason?: string | null
          started_at?: string
          target_email?: string
          target_role?: string
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          completion_tokens: number | null
          content: string
          created_at: string | null
          error_message: string | null
          error_occurred: boolean | null
          feedback_comment: string | null
          feedback_rating: string | null
          feedback_timestamp: string | null
          feedback_user_id: string | null
          id: string
          metadata: Json | null
          model_version: string | null
          prompt_tokens: number | null
          response_time_ms: number | null
          role: string
          sender_role: string | null
          session_id: string
          total_tokens: number | null
        }
        Insert: {
          completion_tokens?: number | null
          content: string
          created_at?: string | null
          error_message?: string | null
          error_occurred?: boolean | null
          feedback_comment?: string | null
          feedback_rating?: string | null
          feedback_timestamp?: string | null
          feedback_user_id?: string | null
          id?: string
          metadata?: Json | null
          model_version?: string | null
          prompt_tokens?: number | null
          response_time_ms?: number | null
          role?: string
          sender_role?: string | null
          session_id: string
          total_tokens?: number | null
        }
        Update: {
          completion_tokens?: number | null
          content?: string
          created_at?: string | null
          error_message?: string | null
          error_occurred?: boolean | null
          feedback_comment?: string | null
          feedback_rating?: string | null
          feedback_timestamp?: string | null
          feedback_user_id?: string | null
          id?: string
          metadata?: Json | null
          model_version?: string | null
          prompt_tokens?: number | null
          response_time_ms?: number | null
          role?: string
          sender_role?: string | null
          session_id?: string
          total_tokens?: number | null
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
          context: Json | null
          created_at: string | null
          farmer_id: string | null
          id: string
          is_active: boolean | null
          phase: number | null
          session_name: string | null
          specialist_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          context?: Json | null
          created_at?: string | null
          farmer_id?: string | null
          id?: string
          is_active?: boolean | null
          phase?: number | null
          session_name?: string | null
          specialist_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          context?: Json | null
          created_at?: string | null
          farmer_id?: string | null
          id?: string
          is_active?: boolean | null
          phase?: number | null
          session_name?: string | null
          specialist_id?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      ai_feedback_analytics: {
        Row: {
          api_cost_usd: number | null
          completion_tokens: number | null
          created_at: string | null
          crop_type: string | null
          device_type: string | null
          error_message: string | null
          error_occurred: boolean | null
          farmer_id: string | null
          feedback_comment: string | null
          feedback_tags: string[] | null
          has_images: boolean | null
          has_structured_data: boolean | null
          id: string
          message_id: string
          model_version: string | null
          phase: number | null
          prompt_tokens: number | null
          query_length: number | null
          query_text: string | null
          query_type: string | null
          rating: string | null
          response_length: number | null
          response_text: string | null
          response_time_ms: number | null
          session_ended_after: boolean | null
          session_id: string
          specialist_id: string | null
          total_tokens: number | null
          user_agent: string | null
          user_followed_up: boolean | null
        }
        Insert: {
          api_cost_usd?: number | null
          completion_tokens?: number | null
          created_at?: string | null
          crop_type?: string | null
          device_type?: string | null
          error_message?: string | null
          error_occurred?: boolean | null
          farmer_id?: string | null
          feedback_comment?: string | null
          feedback_tags?: string[] | null
          has_images?: boolean | null
          has_structured_data?: boolean | null
          id?: string
          message_id: string
          model_version?: string | null
          phase?: number | null
          prompt_tokens?: number | null
          query_length?: number | null
          query_text?: string | null
          query_type?: string | null
          rating?: string | null
          response_length?: number | null
          response_text?: string | null
          response_time_ms?: number | null
          session_ended_after?: boolean | null
          session_id: string
          specialist_id?: string | null
          total_tokens?: number | null
          user_agent?: string | null
          user_followed_up?: boolean | null
        }
        Update: {
          api_cost_usd?: number | null
          completion_tokens?: number | null
          created_at?: string | null
          crop_type?: string | null
          device_type?: string | null
          error_message?: string | null
          error_occurred?: boolean | null
          farmer_id?: string | null
          feedback_comment?: string | null
          feedback_tags?: string[] | null
          has_images?: boolean | null
          has_structured_data?: boolean | null
          id?: string
          message_id?: string
          model_version?: string | null
          phase?: number | null
          prompt_tokens?: number | null
          query_length?: number | null
          query_text?: string | null
          query_type?: string | null
          rating?: string | null
          response_length?: number | null
          response_text?: string | null
          response_time_ms?: number | null
          session_ended_after?: boolean | null
          session_id?: string
          specialist_id?: string | null
          total_tokens?: number | null
          user_agent?: string | null
          user_followed_up?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_analytics_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_analytics_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "ai_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_analytics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_sessions: {
        Row: {
          created_at: string | null
          farmer_id: string
          id: string
          notes: string | null
          phase: number
          results: Json | null
          session_name: string
          specialist_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          farmer_id: string
          id?: string
          notes?: string | null
          phase: number
          results?: Json | null
          session_name: string
          specialist_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          farmer_id?: string
          id?: string
          notes?: string | null
          phase?: number
          results?: Json | null
          session_name?: string
          specialist_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_sessions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
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
      chart_templates: {
        Row: {
          annotation: string | null
          bottom_description: string | null
          chart_data: Json
          chart_type: string
          created_at: string
          created_by: string | null
          display_order: number | null
          farmer_id: string | null
          id: string
          is_active: boolean
          name: string
          phase_number: number | null
          updated_at: string
        }
        Insert: {
          annotation?: string | null
          bottom_description?: string | null
          chart_data: Json
          chart_type: string
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          farmer_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          phase_number?: number | null
          updated_at?: string
        }
        Update: {
          annotation?: string | null
          bottom_description?: string | null
          chart_data?: Json
          chart_type?: string
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          farmer_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phase_number?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_templates_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          message_type: string
          metadata: Json | null
          sender_id: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          sender_id: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          sender_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analysis_sessions"
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
          ai_description: string | null
          ai_description_generated_at: string | null
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
          iframe_urls: Json | null
          metadata: Json | null
          phase: number
          tags: string[] | null
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          ai_description?: string | null
          ai_description_generated_at?: string | null
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
          iframe_urls?: Json | null
          metadata?: Json | null
          phase: number
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          ai_description?: string | null
          ai_description_generated_at?: string | null
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
          iframe_urls?: Json | null
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
      farmer_orchard_maps: {
        Row: {
          created_at: string
          display_order: number | null
          farmer_id: string
          file_path: string
          file_size_bytes: number
          file_type: string
          id: string
          is_active: boolean
          mime_type: string
          name: string
          notes: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          farmer_id: string
          file_path: string
          file_size_bytes: number
          file_type: string
          id?: string
          is_active?: boolean
          mime_type: string
          name: string
          notes?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          farmer_id?: string
          file_path?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          is_active?: boolean
          mime_type?: string
          name?: string
          notes?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_orchard_maps_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_phases: {
        Row: {
          created_at: string
          created_by: string | null
          farmer_id: string
          id: string
          iframe_urls: Json | null
          issue_date: string | null
          notes: string | null
          one_pager_summary: string | null
          phase_number: number
          score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          farmer_id: string
          id?: string
          iframe_urls?: Json | null
          issue_date?: string | null
          notes?: string | null
          one_pager_summary?: string | null
          phase_number: number
          score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          farmer_id?: string
          id?: string
          iframe_urls?: Json | null
          issue_date?: string | null
          notes?: string | null
          one_pager_summary?: string | null
          phase_number?: number
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_phases_farmer_id_fkey"
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
          equipment_list: string | null
          farmer_location: string | null
          full_name: string | null
          has_reservoir: boolean | null
          id: string
          id_number: string
          irrigation_sectors_count: number | null
          irrigation_type: string | null
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
          equipment_list?: string | null
          farmer_location?: string | null
          full_name?: string | null
          has_reservoir?: boolean | null
          id?: string
          id_number: string
          irrigation_sectors_count?: number | null
          irrigation_type?: string | null
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
          equipment_list?: string | null
          farmer_location?: string | null
          full_name?: string | null
          has_reservoir?: boolean | null
          id?: string
          id_number?: string
          irrigation_sectors_count?: number | null
          irrigation_type?: string | null
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
      monitored_issues: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      phase_monitored_data: {
        Row: {
          created_at: string
          description: string | null
          farmer_id: string
          id: string
          issue_id: string
          notes: string | null
          phase_number: number
          show_iframes: boolean | null
          status: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          farmer_id: string
          id?: string
          issue_id: string
          notes?: string | null
          phase_number: number
          show_iframes?: boolean | null
          status?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          farmer_id?: string
          id?: string
          issue_id?: string
          notes?: string | null
          phase_number?: number
          show_iframes?: boolean | null
          status?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "phase_monitored_data_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_monitored_data_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "monitored_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_used_data_maps: {
        Row: {
          annotation: string | null
          created_at: string
          created_by: string | null
          display_order: number | null
          farmer_id: string
          file_mime: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id: string
          phase_number: number
        }
        Insert: {
          annotation?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          farmer_id: string
          file_mime: string
          file_name: string
          file_path: string
          file_size_bytes: number
          id?: string
          phase_number: number
        }
        Update: {
          annotation?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          farmer_id?: string
          file_mime?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          id?: string
          phase_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "phase_used_data_maps_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
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
          assigned_by: string | null
          bank_id: string
          created_at: string | null
          f100_doc_url: string | null
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
          assigned_by?: string | null
          bank_id: string
          created_at?: string | null
          f100_doc_url?: string | null
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
          assigned_by?: string | null
          bank_id?: string
          created_at?: string | null
          f100_doc_url?: string | null
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
          user_role: string | null
        }
        Insert: {
          attempts?: number | null
          code_hash: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          user_role?: string | null
        }
        Update: {
          attempts?: number | null
          code_hash?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          user_role?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ai_quality_metrics: {
        Row: {
          avg_completion_tokens: number | null
          avg_prompt_tokens: number | null
          avg_response_length: number | null
          avg_response_time_ms: number | null
          crop_type: string | null
          date: string | null
          dislikes: number | null
          error_count: number | null
          likes: number | null
          model_version: string | null
          phase: number | null
          query_type: string | null
          satisfaction_rate: number | null
          total_cost_usd: number | null
          total_responses: number | null
        }
        Relationships: []
      }
      specialist_dashboard_data: {
        Row: {
          analysis_count: number | null
          analysis_sessions_count: number | null
          assigned_at: string | null
          assignment_id: string | null
          assignment_status: string | null
          audio_count: number | null
          bank_name: string | null
          climate_count: number | null
          data_uploads_count: number | null
          document_count: number | null
          farmer_id: string | null
          farmer_id_number: string | null
          farmer_name: string | null
          last_analysis_at: string | null
          maps_count: number | null
          notes: string | null
          phase: number | null
          photo_count: number | null
          text_count: number | null
          video_count: number | null
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
      admin_update_assignment_f100_url: {
        Args: { p_assignment_id: string; p_f100_doc_url: string }
        Returns: undefined
      }
      cleanup_expired_2fa_codes: { Args: never; Returns: undefined }
      cleanup_expired_trusted_devices: { Args: never; Returns: undefined }
      decrypt_api_key: { Args: { encrypted_key: string }; Returns: string }
      delete_specialist_assignment: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      encrypt_api_key: { Args: { api_key: string }; Returns: string }
      end_user_impersonation: {
        Args: { p_admin_user_id: string; p_session_id?: string }
        Returns: boolean
      }
      get_active_impersonation: {
        Args: never
        Returns: {
          reason: string
          session_id: string
          started_at: string
          target_email: string
          target_role: string
          target_user_id: string
        }[]
      }
      get_impersonation_history: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          action_count: number
          admin_email: string
          duration_seconds: number
          ended_at: string
          reason: string
          session_id: string
          started_at: string
          target_email: string
          target_role: string
        }[]
      }
      get_invitation_details: {
        Args: never
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
          f100_doc_url: string
          farmer_crop: string
          farmer_id: string
          farmer_id_number: string
          farmer_name: string
          last_activity: string
          phase: number
          status: string
        }[]
      }
      get_users_for_impersonation: {
        Args: never
        Returns: {
          bank_id: string
          bank_name: string
          created_at: string
          email: string
          role: string
          user_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
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
          bank_logo_url: string
          bank_name: string
          created_at: string
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
      log_impersonation_action: {
        Args: {
          p_action_description?: string
          p_action_type: string
          p_api_endpoint?: string
          p_duration_ms?: number
          p_page_url?: string
          p_request_data?: Json
          p_response_status?: number
          p_session_id: string
        }
        Returns: string
      }
      record_ai_feedback: {
        Args: {
          p_feedback_comment?: string
          p_feedback_tags?: string[]
          p_message_id: string
          p_rating: string
        }
        Returns: string
      }
      refresh_ai_quality_metrics: { Args: never; Returns: undefined }
      start_user_impersonation: {
        Args: {
          p_admin_user_id: string
          p_ip_address?: string
          p_reason?: string
          p_target_user_id: string
          p_user_agent?: string
        }
        Returns: string
      }
      sync_invitation_statuses: { Args: never; Returns: undefined }
    }
    Enums: {
      data_type:
        | "photo"
        | "analysis"
        | "maps"
        | "text"
        | "document"
        | "video"
        | "audio"
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
      data_type: [
        "photo",
        "analysis",
        "maps",
        "text",
        "document",
        "video",
        "audio",
        "climate",
      ],
      farmer_type: ["person", "company"],
    },
  },
} as const
