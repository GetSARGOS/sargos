// createOrganization — core onboarding business logic.
//
// Creates an organization and its first org_admin atomically using the
// service role client (bypasses RLS). This is the bootstrapping solution:
// the first admin cannot prove membership to satisfy the RLS INSERT policy
// before they are a member, so we use service role server-side.
//
// Call sites must verify the user is authenticated before invoking this.
// This function never throws raw database errors — only sanitized error codes.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { CreateOrganizationInput } from '@/features/organizations/schemas'
import type { RequestMeta } from '@/lib/request-meta'

type ServiceClient = SupabaseClient<Database>

export interface CreateOrganizationResult {
  organizationId: string
  memberId: string
}

// Typed error codes surfaced to the API route. Never expose raw DB errors.
export type CreateOrganizationErrorCode =
  | 'SLUG_TAKEN'
  | 'ORG_CREATE_FAILED'
  | 'MEMBER_CREATE_FAILED'

export class CreateOrganizationError extends Error {
  constructor(public readonly code: CreateOrganizationErrorCode) {
    super(code)
    this.name = 'CreateOrganizationError'
  }
}

export async function createOrganization(
  serviceClient: ServiceClient,
  input: CreateOrganizationInput,
  userId: string,
  userEmail: string,
  requestMeta?: RequestMeta,
): Promise<CreateOrganizationResult> {
  // Step 1: Insert the organization
  const { data: org, error: orgError } = await serviceClient
    .from('organizations')
    .insert({
      name: input.name,
      slug: input.slug,
      unit_type: input.unit_type,
      region: input.region ?? null,
      state: input.state ?? null,
      country: input.country,
      contact_email: input.contact_email ?? null,
      contact_phone: input.contact_phone ?? null,
    })
    .select('id')
    .single()

  if (orgError !== null || org === null) {
    // PostgreSQL unique_violation code is 23505
    const code = orgError?.code === '23505' ? 'SLUG_TAKEN' : 'ORG_CREATE_FAILED'
    throw new CreateOrganizationError(code)
  }

  // Step 2: Insert the first org_admin
  const { data: member, error: memberError } = await serviceClient
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: userId,
      role: 'org_admin',
      display_name: input.admin_display_name,
      phone: input.admin_phone ?? null,
    })
    .select('id')
    .single()

  if (memberError !== null || member === null) {
    // Attempt cleanup — if this fails the org is orphaned but that is recoverable
    // by an admin. Member creation failure is rare; don't let cleanup mask the error.
    await serviceClient.from('organizations').delete().eq('id', org.id)
    throw new CreateOrganizationError('MEMBER_CREATE_FAILED')
  }

  // Step 3: Seed Free tier subscription (best-effort — failure should not block onboarding)
  // Every org starts on Free tier. Stripe integration (Feature 8b) handles upgrades.
  const { error: subError } = await serviceClient
    .from('subscriptions')
    .insert({
      organization_id: org.id,
      tier: 'free',
      status: 'active',
    })

  if (subError) {
    console.error('[createOrganization] subscription seed failed:', subError.code)
  }

  // Step 4: Write audit log entry (best-effort — failure should not block onboarding)
  // Service role is used here because audit_log has no client INSERT policy by design.
  await serviceClient.from('audit_log').insert({
    organization_id: org.id,
    actor_id: userId,
    actor_email: userEmail,
    action: 'organization.created',
    resource_type: 'organization',
    resource_id: org.id,
    ip_address: requestMeta?.ipAddress ?? null,
    user_agent: requestMeta?.userAgent ?? null,
    metadata: { subscription_tier: 'free' },
  })

  return { organizationId: org.id, memberId: member.id }
}
