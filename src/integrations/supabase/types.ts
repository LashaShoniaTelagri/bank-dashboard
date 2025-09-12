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
  public: {
    Tables: {
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
      farmer_documents: {
        Row: {
          bank_id: string
          created_at: string
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
      farmers: {
        Row: {
          area: number | null
          bank_id: string
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
          ltd_name: string | null
          mobile: string | null
          name: string
          reservoir_amount: number | null
          reservoir_capacity: number | null
          type: Database["public"]["Enums"]["farmer_type"]
          variety: string | null
          variety_cultivation_area: number | null
          variety_cultivation_year: number | null
          water_source: string | null
          // New fields
          service_cost_tariff: string | null
          service_cost_total_eur: number | null
          service_cost_breakdown: Json | null
          service_cost_selections: Json | null
          location_name: string | null
          location_lat: number | null
          location_lng: number | null
          cadastral_codes: string[] | null
          bank_comment: string | null
          other_comment: string | null
          registration_date: string | null
        }
        Insert: {
          area?: number | null
          bank_id: string
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
          ltd_name?: string | null
          mobile?: string | null
          name: string
          reservoir_amount?: number | null
          reservoir_capacity?: number | null
          type: Database["public"]["Enums"]["farmer_type"]
          variety?: string | null
          variety_cultivation_area?: number | null
          variety_cultivation_year?: number | null
          water_source?: string | null
          // New fields
          service_cost_tariff?: string | null
          service_cost_total_eur?: number | null
          service_cost_breakdown?: Json | null
          service_cost_selections?: Json | null
          location_name?: string | null
          location_lat?: number | null
          location_lng?: number | null
          cadastral_codes?: string[] | null
          bank_comment?: string | null
          other_comment?: string | null
          registration_date?: string | null
        }
        Update: {
          area?: number | null
          bank_id?: string
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
          ltd_name?: string | null
          mobile?: string | null
          name?: string
          reservoir_amount?: number | null
          reservoir_capacity?: number | null
          type?: Database["public"]["Enums"]["farmer_type"]
          variety?: string | null
          variety_cultivation_area?: number | null
          variety_cultivation_year?: number | null
          water_source?: string | null
          // New fields
          service_cost_tariff?: string | null
          service_cost_total_eur?: number | null
          service_cost_breakdown?: Json | null
          service_cost_selections?: Json | null
          location_name?: string | null
          location_lat?: number | null
          location_lng?: number | null
          cadastral_codes?: string[] | null
          bank_comment?: string | null
          other_comment?: string | null
          registration_date?: string | null
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
      farmer_loans: {
        Row: {
          id: string
          farmer_id: string
          bank_id: string
          amount: number
          currency: string
          start_date: string
          end_date: string
          issuance_date: string
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          farmer_id: string
          bank_id?: string
          amount: number
          currency: 'GEL' | 'USD' | 'EUR'
          start_date: string
          end_date: string
          issuance_date: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          farmer_id?: string
          bank_id?: string
          amount?: number
          currency?: 'GEL' | 'USD' | 'EUR'
          start_date?: string
          end_date?: string
          issuance_date?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_loans_bank_id_fkey"
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
      check_existing_invitation: {
        Args: { target_bank_id: string; user_email: string }
        Returns: {
          invitation_exists: boolean
          invited_date: string
          status: string
        }[]
      }
      cleanup_expired_2fa_codes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_trusted_devices: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_invitation_details: {
        Args: Record<PropertyKey, never>
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
      sync_invitation_statuses: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
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
  public: {
    Enums: {
      farmer_type: ["person", "company"],
    },
  },
} as const
