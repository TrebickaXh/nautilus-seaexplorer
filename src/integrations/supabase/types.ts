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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      areas: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          location_id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_id: string
          name: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_location_id_fkey1"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          event_type: string
          id: string
          org_id: string
          payload: Json | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string
          event_type: string
          id?: string
          org_id: string
          payload?: Json | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          event_type?: string
          id?: string
          org_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      completions: {
        Row: {
          cosigner_user_id: string | null
          created_at: string
          defer_settings: Json | null
          id: string
          note: string | null
          outcome: Database["public"]["Enums"]["task_outcome"] | null
          outcome_reason: string | null
          photo_url: string | null
          task_instance_id: string
          user_id: string
        }
        Insert: {
          cosigner_user_id?: string | null
          created_at?: string
          defer_settings?: Json | null
          id?: string
          note?: string | null
          outcome?: Database["public"]["Enums"]["task_outcome"] | null
          outcome_reason?: string | null
          photo_url?: string | null
          task_instance_id: string
          user_id: string
        }
        Update: {
          cosigner_user_id?: string | null
          created_at?: string
          defer_settings?: Json | null
          id?: string
          note?: string | null
          outcome?: Database["public"]["Enums"]["task_outcome"] | null
          outcome_reason?: string | null
          photo_url?: string | null
          task_instance_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completions_cosigner_user_id_fkey"
            columns: ["cosigner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completions_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          location_id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_id: string
          name: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          org_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          org_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_sessions: {
        Row: {
          completed_at: string | null
          conversation_history: Json | null
          created_at: string
          generated_config: Json | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          conversation_history?: Json | null
          created_at?: string
          generated_config?: Json | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          conversation_history?: Json | null
          created_at?: string
          generated_config?: Json | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          department: string | null
          display_name: string
          email: string | null
          employee_id: string | null
          id: string
          language_preference: string | null
          last_login: string | null
          nfc_uid: string | null
          notes: string | null
          notification_preferences: Json | null
          org_id: string
          phone: string | null
          pin_hash: string | null
          profile_photo_url: string | null
          shift_type: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          department?: string | null
          display_name: string
          email?: string | null
          employee_id?: string | null
          id: string
          language_preference?: string | null
          last_login?: string | null
          nfc_uid?: string | null
          notes?: string | null
          notification_preferences?: Json | null
          org_id: string
          phone?: string | null
          pin_hash?: string | null
          profile_photo_url?: string | null
          shift_type?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          department?: string | null
          display_name?: string
          email?: string | null
          employee_id?: string | null
          id?: string
          language_preference?: string | null
          last_login?: string | null
          nfc_uid?: string | null
          notes?: string | null
          notification_preferences?: Json | null
          org_id?: string
          phone?: string | null
          pin_hash?: string | null
          profile_photo_url?: string | null
          shift_type?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          archived_at: string | null
          assignee_role: Database["public"]["Enums"]["app_role"] | null
          created_at: string
          cron_expr: string | null
          days_of_week: number[] | null
          department_id: string | null
          id: string
          routine_id: string
          shift_id: string | null
          shift_name: string | null
          type: Database["public"]["Enums"]["schedule_type"]
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          archived_at?: string | null
          assignee_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          cron_expr?: string | null
          days_of_week?: number[] | null
          department_id?: string | null
          id?: string
          routine_id: string
          shift_id?: string | null
          shift_name?: string | null
          type: Database["public"]["Enums"]["schedule_type"]
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          archived_at?: string | null
          assignee_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          cron_expr?: string | null
          days_of_week?: number[] | null
          department_id?: string | null
          id?: string
          routine_id?: string
          shift_id?: string | null
          shift_name?: string | null
          type?: Database["public"]["Enums"]["schedule_type"]
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_template_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "task_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_reports: {
        Row: {
          by_area: Json | null
          by_user: Json | null
          completed_tasks: number | null
          created_at: string
          deferred_tasks: number | null
          department_id: string
          id: string
          kpis: Json | null
          location_id: string
          overdue_tasks: number | null
          report_date: string
          shift_end: string
          shift_id: string
          shift_start: string
          skipped_tasks: number | null
          total_tasks: number | null
        }
        Insert: {
          by_area?: Json | null
          by_user?: Json | null
          completed_tasks?: number | null
          created_at?: string
          deferred_tasks?: number | null
          department_id: string
          id?: string
          kpis?: Json | null
          location_id: string
          overdue_tasks?: number | null
          report_date: string
          shift_end: string
          shift_id: string
          shift_start: string
          skipped_tasks?: number | null
          total_tasks?: number | null
        }
        Update: {
          by_area?: Json | null
          by_user?: Json | null
          completed_tasks?: number | null
          created_at?: string
          deferred_tasks?: number | null
          department_id?: string
          id?: string
          kpis?: Json | null
          location_id?: string
          overdue_tasks?: number | null
          report_date?: string
          shift_end?: string
          shift_id?: string
          shift_start?: string
          skipped_tasks?: number | null
          total_tasks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_reports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_reports_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          archived_at: string | null
          created_at: string
          days_of_week: number[]
          department_id: string | null
          end_time: string
          id: string
          location_id: string
          name: string
          start_time: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          days_of_week?: number[]
          department_id?: string | null
          end_time: string
          id?: string
          location_id: string
          name: string
          start_time: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          days_of_week?: number[]
          department_id?: string | null
          end_time?: string
          id?: string
          location_id?: string
          name?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          acted_by_user_id: string | null
          created_at: string
          id: string
          location_id: string
          org_id: string
          proposed_template_id: string | null
          reason: string
          signal: string
          status: Database["public"]["Enums"]["suggestion_status"]
        }
        Insert: {
          acted_by_user_id?: string | null
          created_at?: string
          id?: string
          location_id: string
          org_id: string
          proposed_template_id?: string | null
          reason: string
          signal: string
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Update: {
          acted_by_user_id?: string | null
          created_at?: string
          id?: string
          location_id?: string
          org_id?: string
          proposed_template_id?: string | null
          reason?: string
          signal?: string
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_acted_by_user_id_fkey"
            columns: ["acted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_proposed_template_id_fkey"
            columns: ["proposed_template_id"]
            isOneToOne: false
            referencedRelation: "task_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      task_instances: {
        Row: {
          area_id: string | null
          assigned_role: Database["public"]["Enums"]["app_role"] | null
          completed_at: string | null
          created_at: string
          created_from:
            | Database["public"]["Enums"]["task_creation_source"]
            | null
          denormalized_data: Json | null
          department_id: string | null
          due_at: string
          id: string
          location_id: string
          routine_id: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          template_id: string
          urgency_score: number | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          area_id?: string | null
          assigned_role?: Database["public"]["Enums"]["app_role"] | null
          completed_at?: string | null
          created_at?: string
          created_from?:
            | Database["public"]["Enums"]["task_creation_source"]
            | null
          denormalized_data?: Json | null
          department_id?: string | null
          due_at: string
          id?: string
          location_id: string
          routine_id?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          template_id: string
          urgency_score?: number | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          area_id?: string | null
          assigned_role?: Database["public"]["Enums"]["app_role"] | null
          completed_at?: string | null
          created_at?: string
          created_from?:
            | Database["public"]["Enums"]["task_creation_source"]
            | null
          denormalized_data?: Json | null
          department_id?: string | null
          due_at?: string
          id?: string
          location_id?: string
          routine_id?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string
          urgency_score?: number | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_instances_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "task_routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      task_routines: {
        Row: {
          active: boolean | null
          archived_at: string | null
          area_ids: string[] | null
          created_at: string
          criticality: number
          department_id: string | null
          description: string | null
          est_minutes: number
          id: string
          location_id: string | null
          org_id: string
          recurrence: Json | null
          required_proof: Database["public"]["Enums"]["proof_type"]
          shift_id: string | null
          steps: Json | null
          title: string
        }
        Insert: {
          active?: boolean | null
          archived_at?: string | null
          area_ids?: string[] | null
          created_at?: string
          criticality?: number
          department_id?: string | null
          description?: string | null
          est_minutes?: number
          id?: string
          location_id?: string | null
          org_id: string
          recurrence?: Json | null
          required_proof?: Database["public"]["Enums"]["proof_type"]
          shift_id?: string | null
          steps?: Json | null
          title: string
        }
        Update: {
          active?: boolean | null
          archived_at?: string | null
          area_ids?: string[] | null
          created_at?: string
          criticality?: number
          department_id?: string | null
          description?: string | null
          est_minutes?: number
          id?: string
          location_id?: string | null
          org_id?: string
          recurrence?: Json | null
          required_proof?: Database["public"]["Enums"]["proof_type"]
          shift_id?: string | null
          steps?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_routines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_routines_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          is_primary: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          is_primary?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          is_primary?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_departments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_shifts: {
        Row: {
          created_at: string
          id: string
          shift_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shift_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shift_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_urgency_score: {
        Args: {
          _criticality: number
          _due_at: string
          _now?: string
          _window_end: string
          _window_start: string
        }
        Returns: number
      }
      get_user_org_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_task_urgency: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_user_last_login: {
        Args: { user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "org_admin" | "location_manager" | "crew"
      proof_type: "none" | "photo" | "note" | "dual"
      recurrence_type: "daily" | "weekly" | "monthly" | "custom_weeks"
      schedule_type: "cron" | "window" | "oneoff"
      suggestion_status: "proposed" | "accepted" | "dismissed"
      task_creation_source: "routine" | "oneoff"
      task_outcome:
        | "completed"
        | "skipped"
        | "deferred"
        | "reassigned"
        | "cancelled"
      task_status: "pending" | "done" | "missed" | "skipped"
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
      app_role: ["org_admin", "location_manager", "crew"],
      proof_type: ["none", "photo", "note", "dual"],
      recurrence_type: ["daily", "weekly", "monthly", "custom_weeks"],
      schedule_type: ["cron", "window", "oneoff"],
      suggestion_status: ["proposed", "accepted", "dismissed"],
      task_creation_source: ["routine", "oneoff"],
      task_outcome: [
        "completed",
        "skipped",
        "deferred",
        "reassigned",
        "cancelled",
      ],
      task_status: ["pending", "done", "missed", "skipped"],
    },
  },
} as const
