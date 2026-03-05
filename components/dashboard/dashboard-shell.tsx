'use client'

import { useState, Suspense } from 'react'
import Sidebar from './sidebar'
import Header from './header'

interface DashboardShellProps {
  user: {
    name?: string | null
    email?: string | null
  }
  children: React.ReactNode
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#FAFAF8]">
      <Suspense fallback={<div className="hidden lg:block w-60 bg-[#F9F9F6] border-r border-[#E8E8E3]" />}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </Suspense>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header user={user} onMenuToggle={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          }>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
