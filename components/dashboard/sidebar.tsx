'use client'

import { LogOut, LayoutGrid, Building2, Cpu, ShoppingBag } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export default function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentCategory = searchParams.get('category')

  const navigation = [
    {
      name: 'AI应用公司',
      href: '/dashboard?category=AI_APPLICATION',
      icon: Building2,
      description: 'Microsoft, Google, Meta 等',
      category: 'AI_APPLICATION',
      isActive: (path: string, cat: string | null) =>
        path === '/dashboard' && (cat === 'AI_APPLICATION' || !cat),
    },
    {
      name: 'AI供应链公司',
      href: '/dashboard?category=AI_SUPPLY_CHAIN',
      icon: Cpu,
      description: 'Nvidia, TSMC, ASML 等',
      category: 'AI_SUPPLY_CHAIN',
      isActive: (path: string, cat: string | null) =>
        path === '/dashboard' && cat === 'AI_SUPPLY_CHAIN',
    },
    {
      name: '消费品公司',
      href: '/dashboard?category=CONSUMER_GOODS',
      icon: ShoppingBag,
      description: 'Hermès, 茅台, LV 等',
      category: 'CONSUMER_GOODS',
      isActive: (path: string, cat: string | null) =>
        path === '/dashboard' && cat === 'CONSUMER_GOODS',
    },
  ]

  return (
    <div className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {/* Logo */}
      <div className="h-20 flex items-center px-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl overflow-hidden shadow-lg shadow-blue-500/30">
            <Image
              src="/logo.png"
              alt="智析财报"
              width={40}
              height={40}
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              FinSight
            </h1>
            <p className="text-xs text-slate-400">智析财报 · AI分析平台</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = item.isActive(pathname, currentCategory)

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-4 text-sm font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <div className="flex-1">
                <span className="block">{item.name}</span>
                <span className={`text-xs ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                  {item.description}
                </span>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-2 mb-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-medium">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">管理员</p>
            <p className="text-xs text-slate-400 truncate">admin@example.com</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-700/50"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
        >
          <LogOut className="mr-3 h-5 w-5 text-slate-400" />
          退出登录
        </Button>
      </div>
    </div>
  )
}
