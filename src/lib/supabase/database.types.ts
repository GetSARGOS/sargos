// Hand-authored Supabase type stub.
// Covers migrations 001–016.
// After ALL migrations are applied, replace with generated types:
//   npx supabase gen types typescript --project-id <your-project-id> \
//     > src/lib/supabase/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          unit_type: 'sar' | 'fire' | 'ems' | 'law_enforcement' | 'combined' | 'other'
          region: string | null
          state: string | null
          country: string
          contact_email: string | null
          contact_phone: string | null
          logo_url: string | null
          subscription_tier: 'free' | 'volunteer' | 'professional' | 'enterprise'
          subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing'
          stripe_customer_id: string | null
          max_members: number
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          unit_type: 'sar' | 'fire' | 'ems' | 'law_enforcement' | 'combined' | 'other'
          region?: string | null
          state?: string | null
          country?: string
          contact_email?: string | null
          contact_phone?: string | null
          logo_url?: string | null
          subscription_tier?: 'free' | 'volunteer' | 'professional' | 'enterprise'
          subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'
          stripe_customer_id?: string | null
          max_members?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          unit_type?: 'sar' | 'fire' | 'ems' | 'law_enforcement' | 'combined' | 'other'
          region?: string | null
          state?: string | null
          country?: string
          contact_email?: string | null
          contact_phone?: string | null
          logo_url?: string | null
          subscription_tier?: 'free' | 'volunteer' | 'professional' | 'enterprise'
          subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'
          stripe_customer_id?: string | null
          max_members?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'org_admin' | 'member'
          display_name: string
          phone: string | null
          certifications: string[]
          availability: 'available' | 'unavailable' | 'on_call'
          is_active: boolean
          joined_at: string
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: 'org_admin' | 'member'
          display_name: string
          phone?: string | null
          certifications?: string[]
          availability?: 'available' | 'unavailable' | 'on_call'
          is_active?: boolean
          joined_at?: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: 'org_admin' | 'member'
          display_name?: string
          phone?: string | null
          certifications?: string[]
          availability?: 'available' | 'unavailable' | 'on_call'
          is_active?: boolean
          joined_at?: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          organization_id: string | null
          actor_id: string | null
          actor_email: string | null
          action: string
          resource_type: string
          resource_id: string | null
          ip_address: string | null
          user_agent: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          actor_id?: string | null
          actor_email?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
        }
        // Append-only — UPDATE blocked by RLS
        Update: Record<string, unknown>
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          organization_id: string
          name: string
          team_type: 'ground' | 'k9' | 'swift_water' | 'technical_rescue' | 'air' | 'medical' | 'logistics' | 'command' | 'other' | null
          description: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          team_type?: 'ground' | 'k9' | 'swift_water' | 'technical_rescue' | 'air' | 'medical' | 'logistics' | 'command' | 'other' | null
          description?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          team_type?: 'ground' | 'k9' | 'swift_water' | 'technical_rescue' | 'air' | 'medical' | 'logistics' | 'command' | 'other' | null
          description?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          organization_id: string
          member_id: string
          role_in_team: 'lead' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          organization_id: string
          member_id: string
          role_in_team?: 'lead' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          organization_id?: string
          member_id?: string
          role_in_team?: 'lead' | 'member'
          created_at?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: 'org_admin' | 'member'
          token: string
          invited_by: string
          accepted_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          role?: 'org_admin' | 'member'
          token?: string
          invited_by: string
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          accepted_at?: string | null
          expires_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          id: string
          organization_id: string
          name: string
          category: 'vehicle' | 'radio' | 'rope_rigging' | 'medical' | 'shelter' | 'navigation' | 'water_rescue' | 'air' | 'other'
          identifier: string | null
          status: 'available' | 'deployed' | 'out_of_service' | 'requested'
          notes: string | null
          last_inspected_at: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          category: 'vehicle' | 'radio' | 'rope_rigging' | 'medical' | 'shelter' | 'navigation' | 'water_rescue' | 'air' | 'other'
          identifier?: string | null
          status?: 'available' | 'deployed' | 'out_of_service' | 'requested'
          notes?: string | null
          last_inspected_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          category?: 'vehicle' | 'radio' | 'rope_rigging' | 'medical' | 'shelter' | 'navigation' | 'water_rescue' | 'air' | 'other'
          identifier?: string | null
          status?: 'available' | 'deployed' | 'out_of_service' | 'requested'
          notes?: string | null
          last_inspected_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          id: string
          organization_id: string
          name: string
          incident_number: string | null
          incident_type: 'lost_person' | 'overdue_hiker' | 'technical_rescue' | 'swift_water' | 'avalanche' | 'structure_collapse' | 'mutual_aid' | 'training' | 'other'
          status: 'planning' | 'active' | 'suspended' | 'closed'
          location_address: string | null
          location_point: string | null  // PostGIS geometry serialized as WKT or GeoJSON
          lkp_point: string | null
          ipp_point: string | null
          started_at: string | null
          suspended_at: string | null
          closed_at: string | null
          after_action_notes: string | null
          operational_period_hours: number
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          incident_number?: string | null
          incident_type: 'lost_person' | 'overdue_hiker' | 'technical_rescue' | 'swift_water' | 'avalanche' | 'structure_collapse' | 'mutual_aid' | 'training' | 'other'
          status?: 'planning' | 'active' | 'suspended' | 'closed'
          location_address?: string | null
          location_point?: string | null
          lkp_point?: string | null
          ipp_point?: string | null
          started_at?: string | null
          suspended_at?: string | null
          closed_at?: string | null
          after_action_notes?: string | null
          operational_period_hours?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          incident_number?: string | null
          incident_type?: 'lost_person' | 'overdue_hiker' | 'technical_rescue' | 'swift_water' | 'avalanche' | 'structure_collapse' | 'mutual_aid' | 'training' | 'other'
          status?: 'planning' | 'active' | 'suspended' | 'closed'
          location_address?: string | null
          location_point?: string | null
          lkp_point?: string | null
          ipp_point?: string | null
          started_at?: string | null
          suspended_at?: string | null
          closed_at?: string | null
          after_action_notes?: string | null
          operational_period_hours?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      incident_command_structure: {
        Row: {
          id: string
          incident_id: string
          organization_id: string
          member_id: string | null
          ics_role: 'incident_commander' | 'deputy_ic' | 'safety_officer' | 'public_information_officer' | 'liaison_officer' | 'operations_section_chief' | 'planning_section_chief' | 'logistics_section_chief' | 'finance_section_chief' | 'medical_officer' | 'observer'
          assigned_at: string
          relieved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          organization_id: string
          member_id?: string | null
          ics_role: 'incident_commander' | 'deputy_ic' | 'safety_officer' | 'public_information_officer' | 'liaison_officer' | 'operations_section_chief' | 'planning_section_chief' | 'logistics_section_chief' | 'finance_section_chief' | 'medical_officer' | 'observer'
          assigned_at?: string
          relieved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          member_id?: string | null
          ics_role?: 'incident_commander' | 'deputy_ic' | 'safety_officer' | 'public_information_officer' | 'liaison_officer' | 'operations_section_chief' | 'planning_section_chief' | 'logistics_section_chief' | 'finance_section_chief' | 'medical_officer' | 'observer'
          relieved_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      incident_sectors: {
        Row: {
          id: string
          incident_id: string
          organization_id: string
          name: string
          boundary: string  // PostGIS geometry
          status: 'unassigned' | 'assigned' | 'in_progress' | 'completed' | 'suspended'
          color: string | null
          assigned_team_id: string | null
          priority: number | null
          poa: number | null
          pod: number | null
          pos: number | null
          terrain_type: string | null
          notes: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          organization_id: string
          name: string
          boundary: string
          status?: 'unassigned' | 'assigned' | 'in_progress' | 'completed' | 'suspended'
          color?: string | null
          assigned_team_id?: string | null
          priority?: number | null
          poa?: number | null
          pod?: number | null
          pos?: number | null
          terrain_type?: string | null
          notes?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          status?: 'unassigned' | 'assigned' | 'in_progress' | 'completed' | 'suspended'
          color?: string | null
          assigned_team_id?: string | null
          priority?: number | null
          poa?: number | null
          pod?: number | null
          pos?: number | null
          terrain_type?: string | null
          notes?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      incident_personnel: {
        Row: {
          id: string
          incident_id: string
          organization_id: string
          member_id: string | null
          volunteer_name: string | null
          volunteer_phone: string | null
          volunteer_certifications: string[]
          volunteer_vehicle: string | null
          volunteer_medical_notes: string | null
          personnel_type: 'member' | 'volunteer'
          checkin_method: 'manual' | 'qr_scan' | 'app'
          checked_in_at: string
          checked_out_at: string | null
          status: 'available' | 'assigned' | 'in_field' | 'resting' | 'injured' | 'stood_down'
          incident_role: 'incident_commander' | 'deputy_ic' | 'safety_officer' | 'public_information_officer' | 'liaison_officer' | 'operations_section_chief' | 'planning_section_chief' | 'logistics_section_chief' | 'finance_section_chief' | 'medical_officer' | 'field_member' | 'observer' | null
          assigned_sector_id: string | null
          assigned_team_id: string | null
          last_checked_in_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          organization_id: string
          member_id?: string | null
          volunteer_name?: string | null
          volunteer_phone?: string | null
          volunteer_certifications?: string[]
          volunteer_vehicle?: string | null
          volunteer_medical_notes?: string | null
          personnel_type: 'member' | 'volunteer'
          checkin_method: 'manual' | 'qr_scan' | 'app'
          checked_in_at?: string
          checked_out_at?: string | null
          status?: 'available' | 'assigned' | 'in_field' | 'resting' | 'injured' | 'stood_down'
          incident_role?: 'incident_commander' | 'deputy_ic' | 'safety_officer' | 'public_information_officer' | 'liaison_officer' | 'operations_section_chief' | 'planning_section_chief' | 'logistics_section_chief' | 'finance_section_chief' | 'medical_officer' | 'field_member' | 'observer' | null
          assigned_sector_id?: string | null
          assigned_team_id?: string | null
          last_checked_in_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'available' | 'assigned' | 'in_field' | 'resting' | 'injured' | 'stood_down'
          incident_role?: 'incident_commander' | 'deputy_ic' | 'safety_officer' | 'public_information_officer' | 'liaison_officer' | 'operations_section_chief' | 'planning_section_chief' | 'logistics_section_chief' | 'finance_section_chief' | 'medical_officer' | 'field_member' | 'observer' | null
          assigned_sector_id?: string | null
          assigned_team_id?: string | null
          checked_out_at?: string | null
          last_checked_in_at?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      incident_log: {
        Row: {
          id: string
          incident_id: string
          organization_id: string
          entry_type: 'narrative' | 'personnel_checkin' | 'personnel_checkout' | 'personnel_status_change' | 'resource_deployed' | 'resource_returned' | 'sector_assigned' | 'sector_status_change' | 'subject_update' | 'par_initiated' | 'par_completed' | 'role_assigned' | 'incident_status_change' | 'form_exported' | 'flight_path_added' | 'system'
          message: string
          actor_id: string | null
          actor_name: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          organization_id: string
          entry_type: 'narrative' | 'personnel_checkin' | 'personnel_checkout' | 'personnel_status_change' | 'resource_deployed' | 'resource_returned' | 'sector_assigned' | 'sector_status_change' | 'subject_update' | 'par_initiated' | 'par_completed' | 'role_assigned' | 'incident_status_change' | 'form_exported' | 'flight_path_added' | 'system'
          message: string
          actor_id?: string | null
          actor_name?: string | null
          metadata?: Json
          created_at?: string
        }
        // Append-only — UPDATE blocked by RLS
        Update: Record<string, unknown>
        Relationships: []
      }
      incident_qr_tokens: {
        Row: {
          id: string
          incident_id: string
          organization_id: string
          token: string
          is_active: boolean
          scans: number
          created_by: string
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          organization_id: string
          token?: string
          is_active?: boolean
          scans?: number
          created_by: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          scans?: number
          expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      incident_par_events: {
        Row: {
          id: string
          incident_id: string
          organization_id: string
          initiated_by: string
          initiated_at: string
          completed_at: string | null
          total_personnel: number
          confirmed_count: number
          unaccounted_ids: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          organization_id: string
          initiated_by: string
          initiated_at?: string
          completed_at?: string | null
          total_personnel?: number
          confirmed_count?: number
          unaccounted_ids?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          total_personnel?: number
          completed_at?: string | null
          confirmed_count?: number
          unaccounted_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      incident_par_responses: {
        Row: {
          id: string
          par_event_id: string
          incident_id: string
          organization_id: string
          personnel_id: string
          confirmed_safe: boolean
          confirmed_at: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          par_event_id: string
          incident_id: string
          organization_id: string
          personnel_id: string
          confirmed_safe?: boolean
          confirmed_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        // No UPDATE — responses are append-only (unique constraint handles upsert via ON CONFLICT)
        Update: Record<string, unknown>
        Relationships: []
      }
      incident_resources: {
        Row: {
          id: string
          incident_id: string
          organization_id: string
          resource_id: string
          status: 'requested' | 'deployed' | 'returned' | 'out_of_service'
          checked_out_at: string
          checked_out_by: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          incident_id: string
          organization_id: string
          resource_id: string
          status?: 'requested' | 'deployed' | 'returned' | 'out_of_service'
          checked_out_at?: string
          checked_out_by?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'requested' | 'deployed' | 'returned' | 'out_of_service'
          checked_in_at?: string | null
          checked_in_by?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_organization_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      is_org_admin: {
        Args: { org_id: string }
        Returns: boolean
      }
      lookup_qr_token: {
        Args: { p_token: string }
        Returns: {
          incident_id: string
          is_active: boolean
          incident_name: string
          organization_name: string
        }[]
      }
      increment_qr_scans: {
        Args: { p_token: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
