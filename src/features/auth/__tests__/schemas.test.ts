import { describe, it, expect } from 'vitest'
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../schemas'

describe('ForgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects missing email field', () => {
    const result = ForgotPasswordSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('ResetPasswordSchema', () => {
  const validInput = {
    password: 'StrongPass1',
    confirmPassword: 'StrongPass1',
  }

  it('accepts a valid password pair', () => {
    const result = ResetPasswordSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects password shorter than 8 characters', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'Abc1',
      confirmPassword: 'Abc1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without uppercase letter', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'lowercase1',
      confirmPassword: 'lowercase1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without a number', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'NoNumberHere',
      confirmPassword: 'NoNumberHere',
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched passwords', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'StrongPass1',
      confirmPassword: 'DifferentPass2',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('confirmPassword')
    }
  })

  it('rejects empty password', () => {
    const result = ResetPasswordSchema.safeParse({
      password: '',
      confirmPassword: '',
    })
    expect(result.success).toBe(false)
  })
})
