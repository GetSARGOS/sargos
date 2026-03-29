'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  CreateOrganizationSchema,
  type CreateOrganizationFormInput,
} from '@/features/organizations/schemas'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Converts an org name to a URL-safe slug
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

const UNIT_TYPE_OPTIONS = [
  { value: 'sar', label: 'Search & Rescue' },
  { value: 'fire', label: 'Fire' },
  { value: 'ems', label: 'EMS' },
  { value: 'law_enforcement', label: 'Law Enforcement' },
  { value: 'combined', label: 'Combined' },
  { value: 'other', label: 'Other' },
] as const

export function CreateOrgForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  // Track whether the user has manually edited the slug
  const slugEdited = useRef(false)

  const form = useForm<CreateOrganizationFormInput>({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: {
      name: '',
      slug: '',
      unit_type: 'sar',
      region: '',
      state: '',
      country: 'US',
      contact_email: '',
      contact_phone: '',
      admin_display_name: '',
      admin_phone: '',
    },
  })

  // Auto-generate slug from org name unless the user has manually edited it
  const nameValue = form.watch('name')
  useEffect(() => {
    if (!slugEdited.current) {
      form.setValue('slug', nameToSlug(nameValue), { shouldValidate: false })
    }
  }, [nameValue, form])

  function onSubmit(data: CreateOrganizationFormInput) {
    setServerError(null)
    startTransition(async () => {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.status === 201) {
        router.push('/dashboard')
        return
      }

      const body = (await response.json()) as { error?: { message?: string } }
      if (response.status === 409) {
        form.setError('slug', {
          message: 'This URL handle is already taken. Please choose another.',
        })
        return
      }

      setServerError(
        body.error?.message ?? 'Something went wrong. Please try again.'
      )
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {serverError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}

        {/* Organization details */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Organization
          </h2>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="King County Search & Rescue"
                    autoComplete="organization"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL handle</FormLabel>
                <FormControl>
                  <Input
                    placeholder="king-county-sar"
                    {...field}
                    onChange={(e) => {
                      slugEdited.current = true
                      field.onChange(e)
                    }}
                  />
                </FormControl>
                <FormDescription>
                  sargos.app/<span className="font-mono">{field.value || '…'}</span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="unit_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {UNIT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region / County</FormLabel>
                  <FormControl>
                    <Input placeholder="King County" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input placeholder="WA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="contact_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact email (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="info@kcsar.org"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Admin profile */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your profile
          </h2>

          <FormField
            control={form.control}
            name="admin_display_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your name as it appears to teammates"
                    autoComplete="name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="admin_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="+1 (206) 555-0100"
                    autoComplete="tel"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isPending}>
          {isPending ? 'Creating organization…' : 'Create organization'}
        </Button>
      </form>
    </Form>
  )
}
