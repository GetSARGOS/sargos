'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  CreateIncidentSchema,
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
  type CreateIncidentFormInput,
} from '@/features/incidents/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function CreateIncidentForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<CreateIncidentFormInput>({
    resolver: zodResolver(CreateIncidentSchema),
    defaultValues: {
      name: '',
      incidentType: undefined,
      locationAddress: '',
      startedAt: undefined,
    },
  })

  const serverError = form.formState.errors.root?.message

  function onSubmit(values: CreateIncidentFormInput) {
    startTransition(async () => {
      try {
        const res = await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })

        const json = (await res.json()) as {
          data: { incidentId: string } | null
          error: { code: string; message: string } | null
        }

        if (!res.ok || !json.data) {
          form.setError('root', {
            message: json.error?.message ?? 'Failed to create incident',
          })
          return
        }

        router.push(`/incidents/${json.data.incidentId}`)
      } catch {
        form.setError('root', { message: 'Network error — please try again' })
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {serverError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Incident Details
          </p>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Incident Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Lost hiker — Mt. Hood north slope" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="incidentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Incident Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {INCIDENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {INCIDENT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Location & Time
          </p>

          <FormField
            control={form.control}
            name="locationAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location Address</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Timberline Lodge parking lot" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="startedAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Creating incident…' : 'Create Incident'}
        </Button>
      </form>
    </Form>
  )
}
