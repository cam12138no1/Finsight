'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import Image from 'next/image'

export default function SignInPage() {
  const t = useTranslations()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast({
          title: t('common.error'),
          description: t('auth.invalidCredentials'),
          variant: 'destructive',
        })
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('auth.invalidCredentials'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] p-4">
      <Card className="w-full max-w-sm border-[#E8E8E3] shadow-soft-md">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-center mb-3">
            <div className="h-12 w-12 rounded-xl overflow-hidden shadow-soft">
              <Image src="/logo.png" alt="FinSight" width={48} height={48} className="object-cover" />
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold text-center text-[#1F2937]">
            FinSight AI
          </CardTitle>
          <CardDescription className="text-center text-[#9CA3AF] text-sm">
            智析财报 · AI驱动的企业财报分析平台
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-[#4B5563]">
                {t('auth.email')}
              </label>
              <Input
                id="email"
                type="email"
                placeholder="analyst@fund.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-10 border-[#E8E8E3] focus:border-emerald-400 focus:ring-emerald-400/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[#4B5563]">
                {t('auth.password')}
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-10 border-[#E8E8E3] focus:border-emerald-400 focus:ring-emerald-400/20"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors duration-200"
              disabled={isLoading}
            >
              {isLoading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
          <div className="mt-5 pt-4 border-t border-[#E8E8E3] text-center">
            <p className="text-[11px] text-[#9CA3AF] mb-1">演示账号</p>
            <p className="font-mono text-xs text-[#6B7280]">
              admin@example.com / admin123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
