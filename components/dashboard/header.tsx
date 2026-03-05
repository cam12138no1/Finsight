'use client'

import { useTranslations } from 'next-intl'
import { Bell, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileMenuButton } from './sidebar'

interface HeaderProps {
  user: {
    name?: string | null
    email?: string | null
  }
  onMenuToggle?: () => void
}

export default function Header({ user, onMenuToggle }: HeaderProps) {
  const t = useTranslations()

  return (
    <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-[#E8E8E3] flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        {onMenuToggle && <MobileMenuButton onClick={onMenuToggle} />}
        <h2 className="text-sm lg:text-base font-medium text-[#1F2937]">
          {t('dashboard.welcomeBack')}, <span className="font-semibold">{user.name || '用户'}</span>
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F0F0EB] cursor-pointer">
          <Bell className="h-[18px] w-[18px]" />
        </Button>

        <div className="hidden sm:flex items-center gap-2.5 pl-3 ml-1 border-l border-[#E8E8E3]">
          <div className="text-right">
            <p className="text-sm font-medium text-[#1F2937]">{user.name}</p>
            <p className="text-[11px] text-[#9CA3AF]">{user.email}</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>
    </header>
  )
}
