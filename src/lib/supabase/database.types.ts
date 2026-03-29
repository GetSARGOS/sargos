// Hand-authored Supabase type stub.
// Covers migrations 001–006 (organizations, organization_members, audit_log).
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
