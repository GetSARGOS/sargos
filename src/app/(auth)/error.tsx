'use client'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 text-center ring-1 ring-foreground/10">
        <p className="font-medium text-destructive">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.digest
            ? `Error ID: ${error.digest}`
            : 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
