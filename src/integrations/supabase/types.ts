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
          new_due_at: string | null
          note: string | null
          outcome: Database["public"]["Enums"]["task_outcome"] | null
          outcome_reason: string | null
          photo_url: string | null
          reassigned_shift_id: string | null
          task_instance_id: string
          user_id: string
        }
        Insert: {
          cosigner_user_id?: string | null
          created_at?: string
          defer_settings?: Json | null
          id?: string
          new_due_at?: string | null
          note?: string | null
          outcome?: Database["public"]["Enums"]["task_outcome"] | null
          outcome_reason?: string | null
          photo_url?: string | null
          reassigned_shift_id?: string | null
          task_instance_id: string
          user_id: string
        }
        Update: {
          cosigner_user_id?: string | null
          created_at?: string
          defer_settings?: Json | null
          id?: string
          new_due_at?: string | null
          note?: string | null
          outcome?: Database["public"]["Enums"]["task_outcome"] | null
          outcome_reason?: string | null
          photo_url?: string | null
          reassigned_shift_id?: string | null
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
            foreignKeyName: "completions_cosigner_user_id_fkey"
            columns: ["cosigner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completions_reassigned_shift_id_fkey"
            columns: ["reassigned_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
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
          {
            foreignKeyName: "completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
          manager_user_id: string | null
          name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_id: string
          manager_user_id?: string | null
          name: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_id?: string
          manager_user_id?: string | null
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
      labor_rules: {
        Row: {
          created_at: string
          id: string
          jurisdiction: string
          max_hours_day: number
          max_hours_week: number
          meal_break: Json | null
          min_rest_hours: number
          minors_rules: Json | null
          org_id: string
          union_rules: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          jurisdiction?: string
          max_hours_day?: number
          max_hours_week?: number
          meal_break?: Json | null
          min_rest_hours?: number
          minors_rules?: Json | null
          org_id: string
          union_rules?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          jurisdiction?: string
          max_hours_day?: number
          max_hours_week?: number
          meal_break?: Json | null
          min_rest_hours?: number
          minors_rules?: Json | null
          org_id?: string
          union_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "labor_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          archived_at: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          org_id: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          org_id: string
        }
        Update: {
          address?: string | null
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
      open_shift_pool: {
        Row: {
          bonus_cents: number | null
          created_at: string
          expires_at: string | null
          id: string
          post_reason: string | null
          posted_by_employee_id: string | null
          shift_id: string
        }
        Insert: {
          bonus_cents?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          post_reason?: string | null
          posted_by_employee_id?: string | null
          shift_id: string
        }
        Update: {
          bonus_cents?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          post_reason?: string | null
          posted_by_employee_id?: string | null
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_shift_pool_posted_by_employee_id_fkey"
            columns: ["posted_by_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_shift_pool_posted_by_employee_id_fkey"
            columns: ["posted_by_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_shift_pool_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: true
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          settings: Json
          timezone: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          settings?: Json
          timezone?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          timezone?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          archived_at: string | null
          base_rate_cents: number | null
          created_at: string
          id: string
          min_age: number | null
          name: string
          org_id: string
          required_skills: string[] | null
        }
        Insert: {
          archived_at?: string | null
          base_rate_cents?: number | null
          created_at?: string
          id?: string
          min_age?: number | null
          name: string
          org_id: string
          required_skills?: string[] | null
        }
        Update: {
          archived_at?: string | null
          base_rate_cents?: number | null
          created_at?: string
          id?: string
          min_age?: number | null
          name?: string
          org_id?: string
          required_skills?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          availability_rules: Json | null
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
          overtime_rule_id: string | null
          pay_rate_cents: number | null
          phone: string | null
          pin_attempts: number | null
          pin_hash: string | null
          pin_locked_until: string | null
          position_id: string | null
          profile_photo_url: string | null
          seniority_rank: number | null
          shift_type: string | null
          skills: string[] | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          availability_rules?: Json | null
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
          overtime_rule_id?: string | null
          pay_rate_cents?: number | null
          phone?: string | null
          pin_attempts?: number | null
          pin_hash?: string | null
          pin_locked_until?: string | null
          position_id?: string | null
          profile_photo_url?: string | null
          seniority_rank?: number | null
          shift_type?: string | null
          skills?: string[] | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          availability_rules?: Json | null
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
          overtime_rule_id?: string | null
          pay_rate_cents?: number | null
          phone?: string | null
          pin_attempts?: number | null
          pin_hash?: string | null
          pin_locked_until?: string | null
          position_id?: string | null
          profile_photo_url?: string | null
          seniority_rank?: number | null
          shift_type?: string | null
          skills?: string[] | null
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
          {
            foreignKeyName: "profiles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          shift_id: string
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          shift_id: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          shift_id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
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
      shift_claims: {
        Row: {
          claimant_employee_id: string
          created_at: string
          id: string
          priority_score: number | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          rules_result: Json | null
          shift_id: string
          status: Database["public"]["Enums"]["claim_status"]
        }
        Insert: {
          claimant_employee_id: string
          created_at?: string
          id?: string
          priority_score?: number | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          rules_result?: Json | null
          shift_id: string
          status?: Database["public"]["Enums"]["claim_status"]
        }
        Update: {
          claimant_employee_id?: string
          created_at?: string
          id?: string
          priority_score?: number | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          rules_result?: Json | null
          shift_id?: string
          status?: Database["public"]["Enums"]["claim_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shift_claims_claimant_employee_id_fkey"
            columns: ["claimant_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_claims_claimant_employee_id_fkey"
            columns: ["claimant_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_claims_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_claims_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_claims_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_reports: {
        Row: {
          by_area: Json | null
          by_area_v2: Json | null
          by_user: Json | null
          by_user_v2: Json | null
          completed_tasks: number | null
          created_at: string
          deferred_tasks: number | null
          department_id: string
          generated_at: string | null
          id: string
          kpis: Json | null
          kpis_v2: Json | null
          location_id: string
          overdue_tasks: number | null
          report_date: string
          service_date_v2: string | null
          shift_end: string
          shift_id: string
          shift_start: string
          skipped_tasks: number | null
          total_tasks: number | null
          totals_v2: Json | null
          window_end_v2: string | null
          window_start_v2: string | null
        }
        Insert: {
          by_area?: Json | null
          by_area_v2?: Json | null
          by_user?: Json | null
          by_user_v2?: Json | null
          completed_tasks?: number | null
          created_at?: string
          deferred_tasks?: number | null
          department_id: string
          generated_at?: string | null
          id?: string
          kpis?: Json | null
          kpis_v2?: Json | null
          location_id: string
          overdue_tasks?: number | null
          report_date: string
          service_date_v2?: string | null
          shift_end: string
          shift_id: string
          shift_start: string
          skipped_tasks?: number | null
          total_tasks?: number | null
          totals_v2?: Json | null
          window_end_v2?: string | null
          window_start_v2?: string | null
        }
        Update: {
          by_area?: Json | null
          by_area_v2?: Json | null
          by_user?: Json | null
          by_user_v2?: Json | null
          completed_tasks?: number | null
          created_at?: string
          deferred_tasks?: number | null
          department_id?: string
          generated_at?: string | null
          id?: string
          kpis?: Json | null
          kpis_v2?: Json | null
          location_id?: string
          overdue_tasks?: number | null
          report_date?: string
          service_date_v2?: string | null
          shift_end?: string
          shift_id?: string
          shift_start?: string
          skipped_tasks?: number | null
          total_tasks?: number | null
          totals_v2?: Json | null
          window_end_v2?: string | null
          window_start_v2?: string | null
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
          created_by: string | null
          days_of_week: number[]
          department_id: string | null
          end_at: string | null
          end_time: string
          id: string
          location_id: string
          name: string
          notes: string | null
          required_skills: string[] | null
          start_at: string | null
          start_time: string
          status: Database["public"]["Enums"]["shift_status"] | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          department_id?: string | null
          end_at?: string | null
          end_time: string
          id?: string
          location_id: string
          name: string
          notes?: string | null
          required_skills?: string[] | null
          start_at?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"] | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          department_id?: string | null
          end_at?: string | null
          end_time?: string
          id?: string
          location_id?: string
          name?: string
          notes?: string | null
          required_skills?: string[] | null
          start_at?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"] | null
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
            foreignKeyName: "suggestions_acted_by_user_id_fkey"
            columns: ["acted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
      swap_requests: {
        Row: {
          created_at: string
          from_assignment_id: string
          id: string
          manager_id: string | null
          reason: string | null
          rules_result: Json | null
          status: Database["public"]["Enums"]["swap_status"]
          to_employee_id: string | null
          type: Database["public"]["Enums"]["swap_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_assignment_id: string
          id?: string
          manager_id?: string | null
          reason?: string | null
          rules_result?: Json | null
          status?: Database["public"]["Enums"]["swap_status"]
          to_employee_id?: string | null
          type?: Database["public"]["Enums"]["swap_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_assignment_id?: string
          id?: string
          manager_id?: string | null
          reason?: string | null
          rules_result?: Json | null
          status?: Database["public"]["Enums"]["swap_status"]
          to_employee_id?: string | null
          type?: Database["public"]["Enums"]["swap_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swap_requests_from_assignment_id_fkey"
            columns: ["from_assignment_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
          created_from_v2: string | null
          denormalized_data: Json | null
          department_id: string | null
          due_at: string
          id: string
          location_id: string
          required_proof: Database["public"]["Enums"]["proof_type"] | null
          routine_id: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["task_status"]
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
          created_from_v2?: string | null
          denormalized_data?: Json | null
          department_id?: string | null
          due_at: string
          id?: string
          location_id: string
          required_proof?: Database["public"]["Enums"]["proof_type"] | null
          routine_id?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
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
          created_from_v2?: string | null
          denormalized_data?: Json | null
          department_id?: string | null
          due_at?: string
          id?: string
          location_id?: string
          required_proof?: Database["public"]["Enums"]["proof_type"] | null
          routine_id?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
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
          is_deprecated: boolean | null
          location_id: string | null
          org_id: string
          recurrence: Json | null
          recurrence_v2: Json | null
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
          is_deprecated?: boolean | null
          location_id?: string | null
          org_id: string
          recurrence?: Json | null
          recurrence_v2?: Json | null
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
          is_deprecated?: boolean | null
          location_id?: string | null
          org_id?: string
          recurrence?: Json | null
          recurrence_v2?: Json | null
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
      time_off_requests: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          status: string
          type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          status?: string
          type: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
          {
            foreignKeyName: "user_departments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
          {
            foreignKeyName: "user_shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_safe: {
        Row: {
          active: boolean | null
          created_at: string | null
          department: string | null
          display_name: string | null
          email: string | null
          employee_id: string | null
          id: string | null
          language_preference: string | null
          last_login: string | null
          nfc_uid: string | null
          notes: string | null
          notification_preferences: Json | null
          org_id: string | null
          phone: string | null
          profile_photo_url: string | null
          shift_type: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          employee_id?: string | null
          id?: string | null
          language_preference?: string | null
          last_login?: string | null
          nfc_uid?: string | null
          notes?: string | null
          notification_preferences?: Json | null
          org_id?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          shift_type?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          employee_id?: string | null
          id?: string | null
          language_preference?: string | null
          last_login?: string | null
          nfc_uid?: string | null
          notes?: string | null
          notification_preferences?: Json | null
          org_id?: string | null
          phone?: string | null
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
      check_password_strength: {
        Args: { password: string }
        Returns: boolean
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
      validate_pin_format: {
        Args: { pin_text: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "org_admin" | "location_manager" | "crew"
      assignment_status:
        | "assigned"
        | "posted"
        | "dropped"
        | "swap_pending"
        | "approved"
        | "declined"
      claim_status:
        | "waiting"
        | "manager_review"
        | "accepted"
        | "rejected"
        | "auto_approved"
      proof_type: "none" | "photo" | "note" | "dual"
      recurrence_type: "daily" | "weekly" | "monthly" | "custom_weeks"
      schedule_type: "cron" | "window" | "oneoff"
      shift_status:
        | "draft"
        | "scheduled"
        | "open"
        | "pending_swap"
        | "approved"
        | "canceled"
      suggestion_status: "proposed" | "accepted" | "dismissed"
      swap_status: "pending" | "approved" | "rejected" | "canceled"
      swap_type: "direct" | "market"
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
      assignment_status: [
        "assigned",
        "posted",
        "dropped",
        "swap_pending",
        "approved",
        "declined",
      ],
      claim_status: [
        "waiting",
        "manager_review",
        "accepted",
        "rejected",
        "auto_approved",
      ],
      proof_type: ["none", "photo", "note", "dual"],
      recurrence_type: ["daily", "weekly", "monthly", "custom_weeks"],
      schedule_type: ["cron", "window", "oneoff"],
      shift_status: [
        "draft",
        "scheduled",
        "open",
        "pending_swap",
        "approved",
        "canceled",
      ],
      suggestion_status: ["proposed", "accepted", "dismissed"],
      swap_status: ["pending", "approved", "rejected", "canceled"],
      swap_type: ["direct", "market"],
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
