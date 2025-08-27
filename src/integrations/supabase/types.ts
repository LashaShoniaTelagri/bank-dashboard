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
      farmers: {
        Row: {
          bank_id: string
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          id_number: string
          name: string
          type: Database["public"]["Enums"]["farmer_type"]
        }
        Insert: {
          bank_id: string
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          id_number: string
          name: string
          type: Database["public"]["Enums"]["farmer_type"]
        }
        Update: {
          bank_id?: string
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          id_number?: string
          name?: string
          type?: Database["public"]["Enums"]["farmer_type"]
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
      profiles: {
        Row: {
          bank_id: string | null
          created_at: string
          role: string
          user_id: string
          invited_by: string | null
          invited_at: string | null
          invitation_accepted_at: string | null
          invitation_status: string | null
        }
        Insert: {
          bank_id?: string | null
          created_at?: string
          role: string
          user_id: string
          invited_by?: string | null
          invited_at?: string | null
          invitation_accepted_at?: string | null
          invitation_status?: string | null
        }
        Update: {
          bank_id?: string | null
          created_at?: string
          role?: string
          user_id?: string
          invited_by?: string | null
          invited_at?: string | null
          invitation_accepted_at?: string | null
          invitation_status?: string | null
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
      get_invitation_details: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          email: string
          role: string
          bank_id: string
          bank_name: string
          invited_by: string
          invited_at: string
          invitation_accepted_at: string
          invitation_status: string
          created_at: string
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
