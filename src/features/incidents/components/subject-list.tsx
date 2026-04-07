'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  SUBJECT_TYPES,
  SUBJECT_TYPE_LABELS,
  SUBJECT_GENDERS,
  SUBJECT_GENDER_LABELS,
  FOUND_CONDITIONS,
  FOUND_CONDITION_LABELS,
  type SubjectType,
  type SubjectGender,
  type FoundCondition,
} from '@/features/incidents/schemas'

// Sentinel for "clear this field" in edit dialogs (Radix Select disallows empty-string values)
const CLEAR_VALUE = '__clear__'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SubjectRow {
  id: string
  first_name: string
  last_name: string
  age: number | null
  gender: string | null
  height_cm: number | null
  weight_kg: number | null
  physical_description: string | null
  clothing_description: string | null
  subject_type: string | null
  last_seen_at: string | null
  is_primary: boolean
  found_condition: string | null
  found_at: string | null
  created_at: string
}

interface SubjectListProps {
  incidentId: string
  initialSubjects: SubjectRow[]
  canEdit: boolean
  timezone: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SubjectList({ incidentId, initialSubjects, canEdit, timezone }: SubjectListProps) {
  const [subjects, setSubjects] = useState<SubjectRow[]>(initialSubjects)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editSubject, setEditSubject] = useState<SubjectRow | null>(null)

  async function handleAdd(formData: FormData) {
    setError(null)
    const body = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      age: formData.get('age') ? Number(formData.get('age')) : undefined,
      gender: (formData.get('gender') as string) || undefined,
      subjectType: (formData.get('subjectType') as string) || undefined,
      heightCm: formData.get('heightCm') ? Number(formData.get('heightCm')) : undefined,
      weightKg: formData.get('weightKg') ? Number(formData.get('weightKg')) : undefined,
      physicalDescription: (formData.get('physicalDescription') as string) || undefined,
      clothingDescription: (formData.get('clothingDescription') as string) || undefined,
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/subjects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to add subject')
          return
        }
        // Refresh subjects list
        const listRes = await fetch(`/api/incidents/${incidentId}/subjects`)
        const listJson = await listRes.json()
        if (listRes.ok && listJson.data?.subjects) {
          setSubjects(listJson.data.subjects)
        }
        setAddOpen(false)
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  async function handleUpdate(subjectId: string, formData: FormData) {
    setError(null)
    const body: Record<string, unknown> = {}
    const firstName = formData.get('firstName') as string
    const lastName = formData.get('lastName') as string
    if (firstName) body.firstName = firstName
    if (lastName) body.lastName = lastName
    const age = formData.get('age') as string
    body.age = age ? Number(age) : null
    const gender = formData.get('gender') as string
    body.gender = gender && gender !== CLEAR_VALUE ? gender : null
    const subjectType = formData.get('subjectType') as string
    body.subjectType = subjectType && subjectType !== CLEAR_VALUE ? subjectType : null
    const foundCondition = formData.get('foundCondition') as string
    body.foundCondition = foundCondition && foundCondition !== CLEAR_VALUE ? foundCondition : null
    const physicalDescription = formData.get('physicalDescription') as string
    body.physicalDescription = physicalDescription || null
    const clothingDescription = formData.get('clothingDescription') as string
    body.clothingDescription = clothingDescription || null

    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/subjects/${subjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to update subject')
          return
        }
        const listRes = await fetch(`/api/incidents/${incidentId}/subjects`)
        const listJson = await listRes.json()
        if (listRes.ok && listJson.data?.subjects) {
          setSubjects(listJson.data.subjects)
        }
        setEditSubject(null)
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  async function handleDelete(subjectId: string) {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/incidents/${incidentId}/subjects/${subjectId}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const json = await res.json()
          setError(json.error?.message ?? 'Failed to remove subject')
          return
        }
        setSubjects((prev) => prev.filter((s) => s.id !== subjectId))
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  const fmt = new Intl.DateTimeFormat('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: timezone, timeZoneName: 'short',
  })

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Subject Information
        </h3>
        {canEdit && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={isPending}>Add Subject</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Subject</DialogTitle>
                <DialogDescription>Enter information about the search subject.</DialogDescription>
              </DialogHeader>
              <form action={handleAdd} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="add-firstName">First Name *</Label><Input id="add-firstName" name="firstName" required /></div>
                  <div><Label htmlFor="add-lastName">Last Name *</Label><Input id="add-lastName" name="lastName" required /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label htmlFor="add-age">Age</Label><Input id="add-age" name="age" type="number" min={0} max={150} /></div>
                  <div>
                    <Label htmlFor="add-gender">Gender</Label>
                    <Select name="gender">
                      <SelectTrigger id="add-gender" className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECT_GENDERS.map((g) => (
                          <SelectItem key={g} value={g}>{SUBJECT_GENDER_LABELS[g]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="add-subjectType">Type</Label>
                    <Select name="subjectType">
                      <SelectTrigger id="add-subjectType" className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{SUBJECT_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="add-heightCm">Height (cm)</Label><Input id="add-heightCm" name="heightCm" type="number" min={30} max={300} /></div>
                  <div><Label htmlFor="add-weightKg">Weight (kg)</Label><Input id="add-weightKg" name="weightKg" type="number" min={1} max={500} step="0.1" /></div>
                </div>
                <div><Label htmlFor="add-physicalDescription">Physical Description</Label><Textarea id="add-physicalDescription" name="physicalDescription" rows={2} /></div>
                <div><Label htmlFor="add-clothingDescription">Clothing Description</Label><Textarea id="add-clothingDescription" name="clothingDescription" rows={2} /></div>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>Add Subject</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Separator className="my-3" />

      {error && (
        <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subjects added yet.</p>
      ) : (
        <div className="space-y-3">
          {subjects.map((s) => (
            <div key={s.id} className="flex items-start justify-between rounded-lg border px-4 py-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.first_name} {s.last_name}</span>
                  {s.is_primary && <Badge variant="default" className="text-xs">Primary</Badge>}
                  {s.found_condition && (
                    <Badge variant={s.found_condition === 'alive_uninjured' ? 'default' : s.found_condition === 'deceased' ? 'destructive' : 'secondary'} className="text-xs">
                      {FOUND_CONDITION_LABELS[s.found_condition as FoundCondition] ?? s.found_condition}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                  {s.age != null && <span>Age {s.age}</span>}
                  {s.gender && <span>{SUBJECT_GENDER_LABELS[s.gender as SubjectGender] ?? s.gender}</span>}
                  {s.subject_type && <span>{SUBJECT_TYPE_LABELS[s.subject_type as SubjectType] ?? s.subject_type}</span>}
                  {s.last_seen_at && <span>Last seen {fmt.format(new Date(s.last_seen_at))}</span>}
                </div>
                {s.physical_description && <p className="mt-1 text-sm text-muted-foreground">{s.physical_description}</p>}
                {s.clothing_description && <p className="text-sm text-muted-foreground italic">{s.clothing_description}</p>}
              </div>
              {canEdit && (
                <div className="ml-3 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditSubject(s)} disabled={isPending}>Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={isPending}>Remove</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Subject?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove {s.first_name} {s.last_name} from this incident? This can be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="sm:flex-1">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          className="sm:flex-1"
                          onClick={() => handleDelete(s.id)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editSubject !== null} onOpenChange={(open) => { if (!open) setEditSubject(null) }}>
        {editSubject && (
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Subject</DialogTitle>
              <DialogDescription>Update information for {editSubject.first_name} {editSubject.last_name}.</DialogDescription>
            </DialogHeader>
            <form action={(fd) => handleUpdate(editSubject.id, fd)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="edit-firstName">First Name</Label><Input id="edit-firstName" name="firstName" defaultValue={editSubject.first_name} /></div>
                <div><Label htmlFor="edit-lastName">Last Name</Label><Input id="edit-lastName" name="lastName" defaultValue={editSubject.last_name} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label htmlFor="edit-age">Age</Label><Input id="edit-age" name="age" type="number" min={0} max={150} defaultValue={editSubject.age ?? ''} /></div>
                <div>
                  <Label htmlFor="edit-gender">Gender</Label>
                  <Select name="gender" defaultValue={editSubject.gender ?? undefined}>
                    <SelectTrigger id="edit-gender" className="w-full">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CLEAR_VALUE}>— None —</SelectItem>
                      {SUBJECT_GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>{SUBJECT_GENDER_LABELS[g]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-subjectType">Type</Label>
                  <Select name="subjectType" defaultValue={editSubject.subject_type ?? undefined}>
                    <SelectTrigger id="edit-subjectType" className="w-full">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CLEAR_VALUE}>— None —</SelectItem>
                      {SUBJECT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{SUBJECT_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="edit-foundCondition">Found Condition</Label>
                <Select name="foundCondition" defaultValue={editSubject.found_condition ?? undefined}>
                  <SelectTrigger id="edit-foundCondition" className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR_VALUE}>— None —</SelectItem>
                    {FOUND_CONDITIONS.map((fc) => (
                      <SelectItem key={fc} value={fc}>{FOUND_CONDITION_LABELS[fc]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="edit-physicalDescription">Physical Description</Label><Textarea id="edit-physicalDescription" name="physicalDescription" rows={2} defaultValue={editSubject.physical_description ?? ''} /></div>
              <div><Label htmlFor="edit-clothingDescription">Clothing Description</Label><Textarea id="edit-clothingDescription" name="clothingDescription" rows={2} defaultValue={editSubject.clothing_description ?? ''} /></div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
