import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Sidebar from '@/components/dashboard/sidebar'
import Header from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Suspense fallback={<div className="w-64 bg-slate-900" />}>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={session.user!} />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent" /></div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
