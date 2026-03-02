import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import CompanyDetailClient from '@/components/dashboard/company-detail-client'

interface Props {
  params: { symbol: string }
}

export default async function CompanyDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  return <CompanyDetailClient symbol={decodeURIComponent(params.symbol)} />
}
