'use client'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function CheckInError({ error, reset }: ErrorProps) {
  console.error('[check-in/error]', error.digest ?? error.message)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-6">
          There was a problem loading this check-in page. Please try again or ask the Incident
          Commander for assistance.
        </p>
        <button
          onClick={reset}
          className="h-11 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
