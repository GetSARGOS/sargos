import { z } from 'zod'

// Slug must be lowercase alphanumeric with hyphens — no leading/trailing hyphens.
// Used as a URL-safe org identifier e.g. "king-county-sar"
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const CreateOrganizationSchema = z.object({
  // Organization fields
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be 50 characters or fewer')
    .trim()
    .regex(SLUG_REGEX, 'Slug must be lowercase letters, numbers, and hyphens only'),
  unit_type: z.enum(['sar', 'fire', 'ems', 'law_enforcement', 'combined', 'other']),
  region: z.string().max(100).trim().optional(),
  state: z.string().max(100).trim().optional(),
  country: z.string().length(2).default('US'),
  contact_email: z.string().email('Invalid email address').optional(),
  contact_phone: z.string().max(20).trim().optional(),

  // First org_admin fields
  admin_display_name: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100)
    .trim(),
  admin_phone: z.string().max(20).trim().optional(),
})

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>
