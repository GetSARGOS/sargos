import { redirect } from 'next/navigation'

// The root path has no content. Unauthenticated users are redirected to /login
// by the proxy before reaching here. Authenticated users landing on / go to /dashboard.

export default function RootPage() {
  redirect('/dashboard')
}
