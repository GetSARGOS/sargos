import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CreateOrganizationSchema } from '@/features/organizations/schemas'
import {
  createOrganization,
  CreateOrganizationError,
} from '@/features/organizations/logic/create-organization'

// POST /api/organizations
// Creates a new organization and sets the authenticated user as its first org_admin.
// This is the entry point for the onboarding flow.
// Requires: authenticated session (no organization membership required yet).
export async function POST(request: NextRequest): Promise<Response> {
  // 1. Verify authentication — getUser() validates the token server-side
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError !== null || user === null) {
    return Response.json(
      { data: null, error: 'Unauthorized', meta: null },
      { status: 401 }
    )
  }

  // 2. Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: 'Invalid request body', meta: null },
      { status: 400 }
    )
  }

  const parsed = CreateOrganizationSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      {
        data: null,
        error: 'Validation failed',
        meta: { issues: parsed.error.issues },
      },
      { status: 400 }
    )
  }

  // 3. Execute business logic via service role (bootstrapping — first org_admin)
  const serviceClient = createServiceClient()
  try {
    const result = await createOrganization(
      serviceClient,
      parsed.data,
      user.id,
      user.email ?? ''
    )
    return Response.json(
      { data: result, error: null, meta: null },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof CreateOrganizationError) {
      if (err.code === 'SLUG_TAKEN') {
        return Response.json(
          { data: null, error: 'This slug is already taken', meta: null },
          { status: 409 }
        )
      }
      // Log error code only — no PII
      console.error('[api/organizations POST] failed:', {
        userId: user.id,
        code: err.code,
      })
    } else {
      console.error('[api/organizations POST] unexpected error:', {
        userId: user.id,
      })
    }

    return Response.json(
      { data: null, error: 'Failed to create organization', meta: null },
      { status: 500 }
    )
  }
}
