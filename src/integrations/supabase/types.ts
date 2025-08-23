export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      banks: {
        Row: {
          id: string
          name: string
          logo_url: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string
          created_at?: string
        }
        Relationships: []
      }
      farmers: {
        Row: {
          id: string
          bank_id: string
          type: "person" | "company"
          name: string
          id_number: string
          contact_phone: string | null
          contact_email: string | null
          contact_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          bank_id: string
          type: "person" | "company"
          name: string
          id_number: string
          contact_phone?: string | null
          contact_email?: string | null
          contact_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          bank_id?: string
          type?: "person" | "company"
          name?: string
          id_number?: string
          contact_phone?: string | null
          contact_email?: string | null
          contact_address?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmers_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          }
        ]
      }
      f100: {
        Row: {
          id: string
          farmer_id: string
          bank_id: string
          phase: number
          issue_date: string
          score: number
          file_path: string
          file_mime: string | null
          file_size_bytes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          farmer_id: string
          bank_id: string
          phase: number
          issue_date: string
          score: number
          file_path: string
          file_mime?: string | null
          file_size_bytes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          farmer_id?: string
          bank_id?: string
          phase?: number
          issue_date?: string
          score?: number
          file_path?: string
          file_mime?: string | null
          file_size_bytes?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "f100_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "f100_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          user_id: string
          role: "admin" | "bank_viewer"
          bank_id: string | null
          created_at: string
          invited_by: string | null
          invited_at: string | null
          invitation_accepted_at: string | null
          invitation_status: "pending" | "accepted" | "expired" | "cancelled" | null
        }
        Insert: {
          user_id: string
          role: "admin" | "bank_viewer"
          bank_id?: string | null
          created_at?: string
          invited_by?: string | null
          invited_at?: string | null
          invitation_accepted_at?: string | null
          invitation_status?: "pending" | "accepted" | "expired" | "cancelled" | null
        }
        Update: {
          user_id?: string
          role?: "admin" | "bank_viewer"
          bank_id?: string | null
          created_at?: string
          invited_by?: string | null
          invited_at?: string | null
          invitation_accepted_at?: string | null
          invitation_status?: "pending" | "accepted" | "expired" | "cancelled" | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          }
        ]
      }
      two_factor_codes: {
        Row: {
          id: string
          user_id: string
          code: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          code: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          code?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          id: string
          user_id: string
          device_fingerprint: string
          device_info: Json
          expires_at: string
          last_used_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_fingerprint: string
          device_info: Json
          expires_at: string
          last_used_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_fingerprint?: string
          device_info?: Json
          expires_at?: string
          last_used_at?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_latest_f100: {
        Row: {
          id: string
          farmer_id: string
          bank_id: string
          phase: number
          issue_date: string
          score: number
          file_path: string
          created_at: string
        }
        Relationships: []
      }
      v_recent_invitations: {
        Row: {
          user_id: string
          role: string
          bank_id: string | null
          bank_name: string | null
          invited_by: string | null
          invited_at: string | null
          invitation_accepted_at: string | null
          invitation_status: string | null
          created_at: string
          email: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      list_farmers_with_latest_f100: {
        Args: {
          search?: string
          from_date?: string
          to_date?: string
          filter_bank_id?: string
        }
        Returns: {
          farmer_id: string
          bank_id: string
          name: string
          id_number: string
          latest: Json
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
      promote_user_to_admin: {
        Args: {
          user_email: string
        }
        Returns: string
      }
      setup_dev_admin: {
        Args: {
          admin_email: string
        }
        Returns: string
      }
      sync_invitation_statuses: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      is_device_trusted: {
        Args: {
          p_user_email: string
          p_device_fingerprint: string
        }
        Returns: boolean
      }
      add_trusted_device: {
        Args: {
          device_fingerprint: string
          device_info: Json
        }
        Returns: string
      }
      cleanup_expired_trusted_devices: {
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
