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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          organization_id: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_command_structure: {
        Row: {
          assigned_at: string
          created_at: string
          ics_role: string
          id: string
          incident_id: string
          member_id: string | null
          organization_id: string
          relieved_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          ics_role: string
          id?: string
          incident_id: string
          member_id?: string | null
          organization_id: string
          relieved_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          ics_role?: string
          id?: string
          incident_id?: string
          member_id?: string | null
          organization_id?: string
          relieved_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_command_structure_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_command_structure_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_command_structure_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_log: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          entry_type: string
          id: string
          incident_id: string
          message: string
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entry_type: string
          id?: string
          incident_id: string
          message: string
          metadata?: Json | null
          organization_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entry_type?: string
          id?: string
          incident_id?: string
          message?: string
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_log_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_par_events: {
        Row: {
          completed_at: string | null
          confirmed_count: number
          created_at: string
          id: string
          incident_id: string
          initiated_at: string
          initiated_by: string
          organization_id: string
          total_personnel: number
          unaccounted_ids: string[]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          confirmed_count?: number
          created_at?: string
          id?: string
          incident_id: string
          initiated_at?: string
          initiated_by: string
          organization_id: string
          total_personnel?: number
          unaccounted_ids?: string[]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          confirmed_count?: number
          created_at?: string
          id?: string
          incident_id?: string
          initiated_at?: string
          initiated_by?: string
          organization_id?: string
          total_personnel?: number
          unaccounted_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_par_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_par_events_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_par_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_par_responses: {
        Row: {
          confirmed_at: string
          confirmed_safe: boolean
          created_at: string
          id: string
          incident_id: string
          notes: string | null
          organization_id: string
          par_event_id: string
          personnel_id: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string
          confirmed_safe?: boolean
          created_at?: string
          id?: string
          incident_id: string
          notes?: string | null
          organization_id: string
          par_event_id: string
          personnel_id: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string
          confirmed_safe?: boolean
          created_at?: string
          id?: string
          incident_id?: string
          notes?: string | null
          organization_id?: string
          par_event_id?: string
          personnel_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_par_responses_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_par_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_par_responses_par_event_id_fkey"
            columns: ["par_event_id"]
            isOneToOne: false
            referencedRelation: "incident_par_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_par_responses_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "incident_personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_personnel: {
        Row: {
          assigned_sector_id: string | null
          assigned_team_id: string | null
          checked_in_at: string
          checked_out_at: string | null
          checkin_method: string
          created_at: string
          id: string
          incident_id: string
          incident_role: string | null
          last_checked_in_at: string | null
          member_id: string | null
          notes: string | null
          organization_id: string
          personnel_type: string
          status: string
          updated_at: string
          volunteer_certifications: string[] | null
          volunteer_medical_notes: string | null
          volunteer_name: string | null
          volunteer_phone: string | null
          volunteer_vehicle: string | null
        }
        Insert: {
          assigned_sector_id?: string | null
          assigned_team_id?: string | null
          checked_in_at?: string
          checked_out_at?: string | null
          checkin_method: string
          created_at?: string
          id?: string
          incident_id: string
          incident_role?: string | null
          last_checked_in_at?: string | null
          member_id?: string | null
          notes?: string | null
          organization_id: string
          personnel_type: string
          status?: string
          updated_at?: string
          volunteer_certifications?: string[] | null
          volunteer_medical_notes?: string | null
          volunteer_name?: string | null
          volunteer_phone?: string | null
          volunteer_vehicle?: string | null
        }
        Update: {
          assigned_sector_id?: string | null
          assigned_team_id?: string | null
          checked_in_at?: string
          checked_out_at?: string | null
          checkin_method?: string
          created_at?: string
          id?: string
          incident_id?: string
          incident_role?: string | null
          last_checked_in_at?: string | null
          member_id?: string | null
          notes?: string | null
          organization_id?: string
          personnel_type?: string
          status?: string
          updated_at?: string
          volunteer_certifications?: string[] | null
          volunteer_medical_notes?: string | null
          volunteer_name?: string | null
          volunteer_phone?: string | null
          volunteer_vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_personnel_assigned_sector_id_fkey"
            columns: ["assigned_sector_id"]
            isOneToOne: false
            referencedRelation: "incident_sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_personnel_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_personnel_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_personnel_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_personnel_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_qr_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          incident_id: string
          is_active: boolean
          organization_id: string
          scans: number
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          incident_id: string
          is_active?: boolean
          organization_id: string
          scans?: number
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          incident_id?: string
          is_active?: boolean
          organization_id?: string
          scans?: number
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_qr_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_qr_tokens_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_qr_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_resources: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          checked_out_at: string
          checked_out_by: string | null
          created_at: string
          id: string
          incident_id: string
          notes: string | null
          organization_id: string
          resource_id: string
          status: string
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string
          checked_out_by?: string | null
          created_at?: string
          id?: string
          incident_id: string
          notes?: string | null
          organization_id: string
          resource_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string
          checked_out_by?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          notes?: string | null
          organization_id?: string
          resource_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_resources_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_resources_checked_out_by_fkey"
            columns: ["checked_out_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_resources_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_sectors: {
        Row: {
          assigned_team_id: string | null
          boundary: unknown
          color: string | null
          completed_at: string | null
          created_at: string
          id: string
          incident_id: string
          name: string
          notes: string | null
          organization_id: string
          poa: number | null
          pod: number | null
          pos: number | null
          priority: number | null
          status: string
          terrain_type: string | null
          updated_at: string
        }
        Insert: {
          assigned_team_id?: string | null
          boundary: unknown
          color?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          incident_id: string
          name: string
          notes?: string | null
          organization_id: string
          poa?: number | null
          pod?: number | null
          pos?: number | null
          priority?: number | null
          status?: string
          terrain_type?: string | null
          updated_at?: string
        }
        Update: {
          assigned_team_id?: string | null
          boundary?: unknown
          color?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          poa?: number | null
          pod?: number | null
          pos?: number | null
          priority?: number | null
          status?: string
          terrain_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_sectors_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_sectors_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_sectors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          after_action_notes: string | null
          closed_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          incident_number: string | null
          incident_type: string
          ipp_point: unknown
          lkp_point: unknown
          location_address: string | null
          location_point: unknown
          name: string
          operational_period_hours: number
          organization_id: string
          started_at: string | null
          status: string
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          after_action_notes?: string | null
          closed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          incident_number?: string | null
          incident_type: string
          ipp_point?: unknown
          lkp_point?: unknown
          location_address?: string | null
          location_point?: unknown
          name: string
          operational_period_hours?: number
          organization_id: string
          started_at?: string | null
          status?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          after_action_notes?: string | null
          closed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          incident_number?: string | null
          incident_type?: string
          ipp_point?: unknown
          lkp_point?: unknown
          location_address?: string | null
          location_point?: unknown
          name?: string
          operational_period_hours?: number
          organization_id?: string
          started_at?: string | null
          status?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          availability: string
          certifications: string[] | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          is_active: boolean
          joined_at: string
          organization_id: string
          phone: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: string
          certifications?: string[] | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          joined_at?: string
          organization_id: string
          phone?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: string
          certifications?: string[] | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          organization_id?: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          country: string
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          max_members: number
          name: string
          region: string | null
          slug: string
          state: string | null
          stripe_customer_id: string | null
          subscription_status: string
          subscription_tier: string
          unit_type: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          max_members?: number
          name: string
          region?: string | null
          slug: string
          state?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          unit_type: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          max_members?: number
          name?: string
          region?: string | null
          slug?: string
          state?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          unit_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          id: string
          identifier: string | null
          last_inspected_at: string | null
          name: string
          notes: string | null
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          identifier?: string | null
          last_inspected_at?: string | null
          name: string
          notes?: string | null
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          identifier?: string | null
          last_inspected_at?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          member_id: string
          organization_id: string
          role_in_team: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          organization_id: string
          role_in_team?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          organization_id?: string
          role_in_team?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          team_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          team_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          team_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_organization_ids: { Args: never; Returns: string[] }
      increment_qr_scans: { Args: { p_token: string }; Returns: undefined }
      is_org_admin: { Args: { org_id: string }; Returns: boolean }
      lookup_qr_token: {
        Args: { p_token: string }
        Returns: {
          incident_id: string
          incident_name: string
          is_active: boolean
          organization_name: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
