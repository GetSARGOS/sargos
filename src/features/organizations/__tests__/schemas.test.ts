import { describe, it, expect } from 'vitest'
import { CreateOrganizationSchema } from '@/features/organizations/schemas'

const VALID_INPUT = {
  name: 'King County SAR',
  slug: 'king-county-sar',
  unit_type: 'sar' as const,
  admin_display_name: 'Jane Smith',
}

describe('CreateOrganizationSchema', () => {
  describe('valid inputs', () => {
    it('accepts a minimal valid payload', () => {
      const result = CreateOrganizationSchema.safeParse(VALID_INPUT)
      expect(result.success).toBe(true)
    })

    it('accepts a fully populated payload', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        region: 'Pacific Northwest',
        state: 'WA',
        country: 'US',
        contact_email: 'sar@kingcounty.gov',
        contact_phone: '+12065551234',
        admin_phone: '+12065554321',
      })
      expect(result.success).toBe(true)
    })

    it('defaults country to US when omitted', () => {
      const result = CreateOrganizationSchema.safeParse(VALID_INPUT)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.country).toBe('US')
      }
    })

    it('trims whitespace from name and slug', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        name: '  King County SAR  ',
        slug: '  king-county-sar  ',
        admin_display_name: '  Jane Smith  ',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('King County SAR')
        expect(result.data.slug).toBe('king-county-sar')
        expect(result.data.admin_display_name).toBe('Jane Smith')
      }
    })

    it('accepts all valid unit_type values', () => {
      const types = ['sar', 'fire', 'ems', 'law_enforcement', 'combined', 'other'] as const
      for (const unit_type of types) {
        const result = CreateOrganizationSchema.safeParse({ ...VALID_INPUT, unit_type })
        expect(result.success, `unit_type "${unit_type}" should be valid`).toBe(true)
      }
    })
  })

  describe('invalid inputs', () => {
    it('rejects missing name', () => {
      const { name: _name, ...rest } = VALID_INPUT
      const result = CreateOrganizationSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects name shorter than 2 characters', () => {
      const result = CreateOrganizationSchema.safeParse({ ...VALID_INPUT, name: 'A' })
      expect(result.success).toBe(false)
    })

    it('rejects missing slug', () => {
      const { slug: _slug, ...rest } = VALID_INPUT
      const result = CreateOrganizationSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects slug with uppercase letters', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        slug: 'King-County-SAR',
      })
      expect(result.success).toBe(false)
    })

    it('rejects slug with spaces', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        slug: 'king county sar',
      })
      expect(result.success).toBe(false)
    })

    it('rejects slug with leading hyphens', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        slug: '-king-county-sar',
      })
      expect(result.success).toBe(false)
    })

    it('rejects slug with trailing hyphens', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        slug: 'king-county-sar-',
      })
      expect(result.success).toBe(false)
    })

    it('rejects slug longer than 50 characters', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        slug: 'a'.repeat(51),
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid unit_type', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        unit_type: 'helicopter',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing admin_display_name', () => {
      const { admin_display_name: _dn, ...rest } = VALID_INPUT
      const result = CreateOrganizationSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects admin_display_name shorter than 2 characters', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        admin_display_name: 'J',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid contact_email', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        contact_email: 'not-an-email',
      })
      expect(result.success).toBe(false)
    })

    it('rejects country code longer than 2 characters', () => {
      const result = CreateOrganizationSchema.safeParse({
        ...VALID_INPUT,
        country: 'USA',
      })
      expect(result.success).toBe(false)
    })
  })
})
