'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { GURU_PROFILES, type GuruProfile } from '@/lib/thirteenf-data'
import { TrendingUp, TrendingDown, Users, FileText, Calendar, ChevronRight } from 'lucide-react'

// SVG 圆环图：仿截图风格，中间放大师真实头像
function DonutChart({ guru }: { guru: GuruProfile }) {
  const [imgError, setImgError] = useState(false)
  const size = 100
  const strokeWidth = 13
  const center = size / 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const innerRadius = radius - strokeWidth / 2 - 2

  const top5 = guru.holdings.slice(0, 5)
  const top5Total = top5.reduce((sum, h) => sum + h.weight, 0)
  const otherWeight = Math.max(0, 100 - top5Total)
  const segments = [
    ...top5.map((h, i) => ({ weight: h.weight, color: guru.topColors[i] })),
    ...(otherWeight > 0.5 ? [{ weight: otherWeight, color: '#E5E7EB' }] : []),
  ]

  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0)

  let cumulativeDash = 0
  const circles = segments.map((seg, i) => {
    const dashLength = (seg.weight / totalWeight) * circumference * 0.97
    const offset = circumference - cumulativeDash + circumference * 0.25
    cumulativeDash += (seg.weight / totalWeight) * circumference * 0.97 + circumference * 0.005
    return (
      <circle
        key={i}
        cx={center} cy={center} r={radius}
        fill="none"
        stroke={seg.color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dashLength} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    )
  })

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#F0F0EB" strokeWidth={strokeWidth} />
        {circles}
      </svg>
      {/* Center avatar - real photo */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ margin: strokeWidth + 2 }}
      >
        {guru.avatarUrl && !imgError ? (
          <div className="w-full h-full rounded-full overflow-hidden border-2 border-white shadow-sm">
            <Image
              src={guru.avatarUrl}
              alt={guru.nameEn}
              width={70}
              height={70}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div
            className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xl"
            style={{ background: `linear-gradient(135deg, ${guru.gradientFrom}, ${guru.gradientTo})` }}
          >
            {guru.initials}
          </div>
        )}
      </div>
    </div>
  )
}

function GuruCard({ guru }: { guru: GuruProfile }) {
  const aumChange = guru.aum - guru.prevAum
  const aumChangePct = ((aumChange / guru.prevAum) * 100).toFixed(1)
  const isPositive = aumChange >= 0

  return (
    <Link href={`/dashboard/13f/${guru.id}`}>
      <div className="bg-white rounded-2xl border border-[#E8E8E3] hover:border-emerald-300 hover:shadow-[0_4px_20px_rgba(16,185,129,0.12)] transition-all duration-200 p-5 cursor-pointer group">
        {/* Top row: info + donut */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-[17px] font-semibold text-[#1F2937] truncate">{guru.nameCn}</h3>
            </div>
            <p className="text-[12px] text-[#9CA3AF] mb-3 truncate">{guru.fund}</p>

            {/* AUM Change */}
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{aumChangePct}%
              </span>
              <span className="text-[12px] text-[#9CA3AF]">季度规模变化</span>
            </div>
            <p className="text-[12px] text-[#6B7280] mt-0.5">
              总规模 ${(guru.aum / 1000).toFixed(1)}B
            </p>
          </div>

          <DonutChart guru={guru} />
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-[#F0F0EB]" />

        {/* Top holdings */}
        <div className="space-y-1.5">
          {guru.holdings.slice(0, 3).map((h, i) => (
            <div key={h.symbol} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: guru.topColors[i] }}
                />
                <span className="text-[13px] font-medium text-[#374151]">{h.symbol}</span>
                <span className="text-[11px] text-[#9CA3AF] truncate max-w-[80px]">{h.company.split(' ')[0]}</span>
              </div>
              <span className="text-[13px] font-semibold text-[#374151]">{h.weight.toFixed(2)}%</span>
            </div>
          ))}
        </div>

        {/* Footer: activity summary */}
        <div className="mt-3.5 pt-3 border-t border-[#F0F0EB] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] text-[#6B7280]">新建仓 {guru.newCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-[11px] text-[#6B7280]">加仓 {guru.increasedCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-[11px] text-[#6B7280]">减仓 {guru.decreasedCount}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[#D1D5DB] group-hover:text-emerald-500 transition-colors" />
        </div>
      </div>
    </Link>
  )
}

export default function ThirteenFPage() {
  return (
    <div className="min-h-full bg-[#FAFAF8]">
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-[#E8E8E3] px-4 lg:px-8 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Users className="h-5 w-5 text-emerald-600" />
                <h1 className="text-xl font-semibold text-[#1F2937]">13-F 名人持仓</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  SEC 公开数据
                </span>
              </div>
              <p className="text-[13px] text-[#6B7280]">
                机构投资者每季度向 SEC 申报的持仓明细（Form 13-F），透视顶级基金操作动向
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-[#9CA3AF]">
              <Calendar className="h-3.5 w-3.5" />
              <span>截至 2024 Q3 · 申报日 2024-11-14</span>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#F0F0EB]">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-[#9CA3AF]" />
              <span className="text-[12px] text-[#6B7280]">追踪 <span className="font-semibold text-[#1F2937]">{GURU_PROFILES.length}</span> 位大师</span>
            </div>
            <div className="text-[12px] text-[#6B7280]">
              组合总规模 <span className="font-semibold text-[#1F2937]">
                ${(GURU_PROFILES.reduce((s, g) => s + g.aum, 0) / 1000).toFixed(0)}B
              </span>
            </div>
            <div className="text-[12px] text-[#6B7280]">
              本季新建仓 <span className="font-semibold text-emerald-600">
                {GURU_PROFILES.reduce((s, g) => s + g.newCount, 0)}
              </span> 笔
            </div>
            <div className="text-[12px] text-[#6B7280]">
              本季清仓 <span className="font-semibold text-red-500">
                {GURU_PROFILES.reduce((s, g) => s + g.closedCount, 0)}
              </span> 笔
            </div>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GURU_PROFILES.map((guru) => (
            <GuruCard key={guru.id} guru={guru} />
          ))}
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-center text-[11px] text-[#9CA3AF] leading-relaxed">
          数据来源：美国 SEC EDGAR 公开披露文件（Form 13-F）。持仓信息存在约 45 天的申报延迟，不构成投资建议。
        </p>
      </div>
    </div>
  )
}
