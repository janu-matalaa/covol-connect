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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          body: string
          created_at: string
          id: string
          read_by: Json
          sender_id: string
          thread_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          body: string
          created_at?: string
          id?: string
          read_by?: Json
          sender_id: string
          thread_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          read_by?: Json
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "admin_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_chat_threads: {
        Row: {
          created_at: string
          id: string
          organizer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organizer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organizer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_code: string
          event_id: string
          id: string
          issued_at: string
          organizer_id: string
          revoked: boolean
          revoked_at: string | null
          revoked_reason: string | null
          service_hours: number
          volunteer_id: string
        }
        Insert: {
          certificate_code?: string
          event_id: string
          id?: string
          issued_at?: string
          organizer_id: string
          revoked?: boolean
          revoked_at?: string | null
          revoked_reason?: string | null
          service_hours?: number
          volunteer_id: string
        }
        Update: {
          certificate_code?: string
          event_id?: string
          id?: string
          issued_at?: string
          organizer_id?: string
          revoked?: boolean
          revoked_at?: string | null
          revoked_reason?: string | null
          service_hours?: number
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          college: string | null
          department: string | null
          email: string | null
          event_id: string
          full_name: string | null
          id: string
          phone: string | null
          registered_at: string
          status: Database["public"]["Enums"]["registration_status"]
          student_id: string | null
          volunteer_id: string
          year_of_study: string | null
        }
        Insert: {
          college?: string | null
          department?: string | null
          email?: string | null
          event_id: string
          full_name?: string | null
          id?: string
          phone?: string | null
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          student_id?: string | null
          volunteer_id: string
          year_of_study?: string | null
        }
        Update: {
          college?: string | null
          department?: string | null
          email?: string | null
          event_id?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          student_id?: string | null
          volunteer_id?: string
          year_of_study?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number
          category: string | null
          created_at: string
          description: string | null
          end_at: string
          id: string
          instructions: string | null
          location: string | null
          organizer_id: string
          registration_deadline: string | null
          required_items: string | null
          service_hours: number
          start_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          category?: string | null
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          instructions?: string | null
          location?: string | null
          organizer_id: string
          registration_deadline?: string | null
          required_items?: string | null
          service_hours?: number
          start_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          category?: string | null
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          instructions?: string | null
          location?: string | null
          organizer_id?: string
          registration_deadline?: string | null
          required_items?: string | null
          service_hours?: number
          start_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          is_announcement: boolean
          read_by: Json
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          is_announcement?: boolean
          read_by?: Json
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          is_announcement?: boolean
          read_by?: Json
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          description: string
          event_id: string | null
          event_name: string | null
          id: string
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          event_id?: string | null
          event_name?: string | null
          id?: string
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          event_id?: string | null
          event_name?: string | null
          id?: string
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          department: string | null
          email: string | null
          faculty_advisor: string | null
          full_name: string | null
          id: string
          institution: string | null
          organization_name: string | null
          organizer_status:
            | Database["public"]["Enums"]["organizer_status"]
            | null
          phone: string | null
          purpose: string | null
          student_id: string | null
          suspended: boolean
          updated_at: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          faculty_advisor?: string | null
          full_name?: string | null
          id: string
          institution?: string | null
          organization_name?: string | null
          organizer_status?:
            | Database["public"]["Enums"]["organizer_status"]
            | null
          phone?: string | null
          purpose?: string | null
          student_id?: string | null
          suspended?: boolean
          updated_at?: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          faculty_advisor?: string | null
          full_name?: string | null
          id?: string
          institution?: string | null
          organization_name?: string | null
          organizer_status?:
            | Database["public"]["Enums"]["organizer_status"]
            | null
          phone?: string | null
          purpose?: string | null
          student_id?: string | null
          suspended?: boolean
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_organizer: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "volunteer" | "organizer" | "admin"
      event_status: "draft" | "published" | "cancelled" | "archived"
      notification_type:
        | "registration_success"
        | "new_event"
        | "event_reminder"
        | "attendance_verified"
        | "certificate_ready"
        | "event_updated"
        | "event_cancelled"
        | "new_registration"
        | "registration_cancelled"
        | "event_full"
        | "attendance_submitted"
        | "certificate_generated"
        | "organizer_announcement"
        | "new_message"
        | "admin_new_organizer"
        | "admin_new_event"
        | "admin_new_certificate"
        | "admin_chat_message"
        | "organizer_approved"
        | "organizer_rejected"
        | "organizer_more_info"
        | "organizer_suspended"
        | "account_suspended"
      organizer_status:
        | "pending"
        | "approved"
        | "rejected"
        | "suspended"
        | "more_info"
      registration_status: "registered" | "cancelled" | "attended"
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
      app_role: ["volunteer", "organizer", "admin"],
      event_status: ["draft", "published", "cancelled", "archived"],
      notification_type: [
        "registration_success",
        "new_event",
        "event_reminder",
        "attendance_verified",
        "certificate_ready",
        "event_updated",
        "event_cancelled",
        "new_registration",
        "registration_cancelled",
        "event_full",
        "attendance_submitted",
        "certificate_generated",
        "organizer_announcement",
        "new_message",
        "admin_new_organizer",
        "admin_new_event",
        "admin_new_certificate",
        "admin_chat_message",
        "organizer_approved",
        "organizer_rejected",
        "organizer_more_info",
        "organizer_suspended",
        "account_suspended",
      ],
      organizer_status: [
        "pending",
        "approved",
        "rejected",
        "suspended",
        "more_info",
      ],
      registration_status: ["registered", "cancelled", "attended"],
    },
  },
} as const
