'use client'

import { LogOut, Building2, Cpu, ShoppingBag, FileText, GitCompare, X, Menu } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

const categoryNav = [
  {
    name: 'AI应用公司',
    href: '/dashboard?category=AI_APPLICATION',
    icon: Building2,
    description: 'Microsoft, Google, Meta',
    category: 'AI_APPLICATION',
    isActive: (path: string, cat: string | null) =>
      path === '/dashboard' && (cat === 'AI_APPLICATION' || !cat),
  },
  {
    name: 'AI供应链公司',
    href: '/dashboard?category=AI_SUPPLY_CHAIN',
    icon: Cpu,
    description: 'Nvidia, TSMC, ASML',
    category: 'AI_SUPPLY_CHAIN',
    isActive: (path: string, cat: string | null) =>
      path === '/dashboard' && cat === 'AI_SUPPLY_CHAIN',
  },
  {
    name: '消费品公司',
    href: '/dashboard?category=CONSUMER_GOODS',
    icon: ShoppingBag,
    description: 'Hermès, LV, 茅台',
    category: 'CONSUMER_GOODS',
    isActive: (path: string, cat: string | null) =>
      path === '/dashboard' && cat === 'CONSUMER_GOODS',
  },
]

const toolNav = [
  {
    name: '分析报告',
    href: '/dashboard/reports',
    icon: FileText,
    isActive: (path: string) => path.startsWith('/dashboard/reports'),
  },
  {
    name: '横向对比',
    href: '/dashboard/comparison',
    icon: GitCompare,
    isActive: (path: string) => path.startsWith('/dashboard/comparison'),
  },
]

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentCategory = searchParams.get('category')

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-[#E8E8E3]">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="h-8 w-8 rounded-lg overflow-hidden">
            <Image src="/logo.png" alt="FinSight" width={32} height={32} className="object-cover" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-[#1F2937] leading-tight">FinSight</h1>
            <p className="text-[10px] text-[#9CA3AF] leading-tight">智析财报</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded-lg hover:bg-[#F0F0EB] transition-colors cursor-pointer">
            <X className="h-5 w-5 text-[#6B7280]" />
          </button>
        )}
      </div>

      {/* Category Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">公司分类</p>
        {categoryNav.map((item) => {
          const Icon = item.icon
          const isActive = item.isActive(pathname, currentCategory)
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-[#4B5563] hover:bg-[#F0F0EB] hover:text-[#1F2937]'
              }`}
            >
              <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-[#9CA3AF]'}`} />
              <div className="min-w-0">
                <span className="block truncate">{item.name}</span>
                <span className={`text-[11px] truncate block ${isActive ? 'text-emerald-500' : 'text-[#9CA3AF]'}`}>
                  {item.description}
                </span>
              </div>
            </Link>
          )
        })}

        <div className="my-4 border-t border-[#E8E8E3]" />

        <p className="px-3 mb-2 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">工具</p>
        {toolNav.map((item) => {
          const Icon = item.icon
          const isActive = item.isActive(pathname)
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-[#4B5563] hover:bg-[#F0F0EB] hover:text-[#1F2937]'
              }`}
            >
              <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-[#9CA3AF]'}`} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-[#E8E8E3]">
        <div className="flex items-center gap-2.5 px-2 py-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
            A
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#1F2937] truncate">管理员</p>
            <p className="text-[11px] text-[#9CA3AF] truncate">admin@example.com</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F0F0EB] h-9 cursor-pointer"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
        >
          <LogOut className="mr-2.5 h-4 w-4" />
          <span className="text-sm">退出登录</span>
        </Button>
      </div>
    </div>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg hover:bg-[#F0F0EB] transition-colors cursor-pointer"
      aria-label="打开菜单"
    >
      <Menu className="h-5 w-5 text-[#4B5563]" />
    </button>
  )
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col bg-[#F9F9F6] border-r border-[#E8E8E3] flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/20 animate-fade-in" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-[#F9F9F6] shadow-soft-lg animate-slide-in">
            <SidebarContent onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  )
}
