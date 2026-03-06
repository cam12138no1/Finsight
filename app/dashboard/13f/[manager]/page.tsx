'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter, redirect } from 'next/navigation'

// 13-F 仅在 preview / development 可访问，production 环境重定向到首页
if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
  redirect('/dashboard')
}
import Image from 'next/image'
import { getGuruById, ACTION_CONFIG, type HoldingAction, type Holding } from '@/lib/thirteenf-data'
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, ExternalLink,
  BarChart2, Users, Calendar, ChevronUp, ChevronDown, ChevronsUpDown,
  AlertCircle, Plus, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

type SortKey = 'rank' | 'weight' | 'weightDelta' | 'value' | 'changePct'
type SortDir = 'asc' | 'desc'
type FilterTab = 'all' | HoldingAction

function ActionBadge({ action }: { action: HoldingAction }) {
  const cfg = ACTION_CONFIG[action]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  )
}

function ChangeIndicator({ value, pct, suffix = '' }: { value: number; pct?: boolean; suffix?: string }) {
  if (value === 0) return <span className="text-[#9CA3AF] text-[13px]">—</span>
  const isPos = value > 0
  const Icon = isPos ? ArrowUpRight : ArrowDownRight
  return (
    <div className={`flex items-center gap-0.5 ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="text-[13px] font-medium">
        {isPos ? '+' : ''}{pct ? value.toFixed(2) + '%' : value.toLocaleString()}{suffix}
      </span>
    </div>
  )
}

function SortHeader({
  label, sortKey, currentKey, dir, onSort
}: {
  label: string; sortKey: SortKey; currentKey: SortKey; dir: SortDir; onSort: (k: SortKey) => void
}) {
  const isActive = sortKey === currentKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-left text-[11px] font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors group"
    >
      {label}
      {isActive
        ? (dir === 'asc' ? <ChevronUp className="h-3 w-3 text-emerald-600" /> : <ChevronDown className="h-3 w-3 text-emerald-600" />)
        : <ChevronsUpDown className="h-3 w-3 text-[#D1D5DB] group-hover:text-[#9CA3AF]" />
      }
    </button>
  )
}

// Horizontal bar representing portfolio weight
function WeightBar({ weight, maxWeight, color }: { weight: number; maxWeight: number; color: string }) {
  const pct = Math.min((weight / maxWeight) * 100, 100)
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-[#F0F0EB] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[13px] font-semibold text-[#1F2937] w-[46px] text-right">{weight.toFixed(2)}%</span>
    </div>
  )
}

export default function GuruDetailPage() {
  const params = useParams()
  const router = useRouter()
  const managerId = params.manager as string
  const guru = getGuruById(managerId)

  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  if (!guru) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
        <AlertCircle className="h-10 w-10 text-[#D1D5DB]" />
        <p className="text-[#6B7280]">找不到该大师的持仓数据</p>
        <button onClick={() => router.back()} className="text-emerald-600 hover:underline text-sm">返回列表</button>
      </div>
    )
  }

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filteredHoldings = useMemo(() => {
    let list = filterTab === 'all' ? guru.holdings : guru.holdings.filter(h => h.action === filterTab)
    return [...list].sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'rank': return (a.rank - b.rank) * mult
        case 'weight': return (a.weight - b.weight) * mult
        case 'weightDelta': return (a.weightDelta - b.weightDelta) * mult
        case 'value': return (a.value - b.value) * mult
        case 'changePct': return (a.changePct - b.changePct) * mult
        default: return 0
      }
    })
  }, [guru.holdings, filterTab, sortKey, sortDir])

  const aumChange = guru.aum - guru.prevAum
  const aumChangePct = ((aumChange / guru.prevAum) * 100).toFixed(1)
  const isAumPos = aumChange >= 0
  const maxWeight = Math.max(...guru.holdings.map(h => h.weight))

  // Top 3 moves this quarter by absolute weight delta
  const topMoves = useMemo(() =>
    [...guru.holdings]
      .filter(h => h.action !== 'unchanged')
      .sort((a, b) => Math.abs(b.weightDelta) - Math.abs(a.weightDelta))
      .slice(0, 3)
  , [guru.holdings])

  const tabs: Array<{ key: FilterTab; label: string; count: number; color: string }> = [
    { key: 'all', label: '全部持仓', count: guru.holdings.length, color: '#6B7280' },
    { key: 'new', label: '新建仓', count: guru.newCount, color: '#059669' },
    { key: 'increased', label: '加仓', count: guru.increasedCount, color: '#2563EB' },
    { key: 'decreased', label: '减仓', count: guru.decreasedCount, color: '#DC2626' },
    { key: 'closed', label: '清仓', count: guru.closedCount, color: '#991B1B' },
  ]

  return (
    <div className="min-h-full bg-[#FAFAF8]">
      {/* ── Hero Header ── */}
      <div className="bg-white border-b border-[#E8E8E3]">
        <div className="max-w-5xl mx-auto px-4 lg:px-8">
          {/* Back + breadcrumb */}
          <div className="flex items-center gap-2 pt-4 pb-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-emerald-600 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>13-F 名人持仓</span>
            </button>
            <span className="text-[#D1D5DB]">/</span>
            <span className="text-[13px] text-[#1F2937] font-medium">{guru.nameCn}</span>
          </div>

          {/* Manager identity */}
          <div className="flex items-start gap-4 py-5">
            {/* Avatar - real photo */}
            {guru.avatarUrl ? (
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-soft border border-[#E8E8E3]">
                <Image
                  src={guru.avatarUrl}
                  alt={guru.nameEn}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-soft"
                style={{ background: `linear-gradient(135deg, ${guru.gradientFrom}, ${guru.gradientTo})` }}
              >
                {guru.initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-[#1F2937]">{guru.nameCn}</h1>
              <p className="text-[13px] text-[#6B7280] mt-0.5">{guru.nameEn} · {guru.title}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-[12px] text-[#9CA3AF]">{guru.fund}</span>
                <span className="w-px h-3 bg-[#E5E7EB]" />
                <div className="flex items-center gap-1 text-[12px] text-[#9CA3AF]">
                  <Calendar className="h-3 w-3" />
                  {guru.latestQuarter} · 申报日 {guru.filingDate}
                </div>
                <span className="w-px h-3 bg-[#E5E7EB]" />
                <span className="text-[12px] text-[#9CA3AF]">策略：{guru.strategy}</span>
              </div>
            </div>
          </div>

          {/* Key metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-t border-[#F0F0EB] divide-x divide-[#F0F0EB]">
            <div className="px-4 py-3 first:pl-0">
              <p className="text-[11px] text-[#9CA3AF] mb-1">组合总规模</p>
              <p className="text-xl font-bold text-[#1F2937]">${(guru.aum / 1000).toFixed(1)}B</p>
              <div className={`flex items-center gap-1 mt-0.5 text-[11px] ${isAumPos ? 'text-emerald-600' : 'text-red-500'}`}>
                {isAumPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isAumPos ? '+' : ''}{aumChangePct}% vs 上季
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] text-[#9CA3AF] mb-1">持仓数量</p>
              <p className="text-xl font-bold text-[#1F2937]">{guru.holdingsCount} 只</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">展示前 {guru.holdings.length} 大重仓</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] text-[#9CA3AF] mb-1">本季新建仓</p>
              <p className="text-xl font-bold text-emerald-600">{guru.newCount} 笔</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">清仓 {guru.closedCount} 笔</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] text-[#9CA3AF] mb-1">前10集中度</p>
              <p className="text-xl font-bold text-[#1F2937]">
                {guru.holdings.slice(0, 10).reduce((s, h) => s + h.weight, 0).toFixed(1)}%
              </p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">前5仓 {guru.holdings.slice(0, 5).reduce((s, h) => s + h.weight, 0).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-5 space-y-5">

        {/* ── Quarter Activity Highlights ── */}
        {topMoves.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E8E8E3] p-5">
            <h2 className="text-[13px] font-semibold text-[#1F2937] mb-4 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-emerald-600" />
              本季重大操作（按仓位变化幅度）
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topMoves.map((h) => {
                const cfg = ACTION_CONFIG[h.action]
                const isPos = h.weightDelta >= 0
                return (
                  <div
                    key={h.symbol}
                    className="rounded-xl border p-4"
                    style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[15px] font-bold" style={{ color: cfg.color }}>{h.symbol}</p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">{h.company}</p>
                      </div>
                      <ActionBadge action={h.action} />
                    </div>
                    <div className="space-y-1 mt-3">
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[#6B7280]">当前仓位</span>
                        <span className="font-semibold text-[#1F2937]">{h.weight.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[#6B7280]">仓位变化</span>
                        <span className={`font-semibold ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
                          {isPos ? '+' : ''}{h.weightDelta.toFixed(2)}pp
                        </span>
                      </div>
                      {h.changeShares !== 0 && (
                        <div className="flex justify-between text-[12px]">
                          <span className="text-[#6B7280]">{h.changeShares > 0 ? '买入' : '卖出'}</span>
                          <span className="font-semibold text-[#1F2937]">
                            {Math.abs(h.changeShares).toLocaleString()} 万股
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Holdings Table ── */}
        <div className="bg-white rounded-2xl border border-[#E8E8E3] overflow-hidden">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-4 border-b border-[#F0F0EB] overflow-x-auto">
            <span className="text-[12px] text-[#9CA3AF] mr-2 flex-shrink-0">筛选：</span>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  filterTab === tab.key
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-[#6B7280] hover:bg-[#F0F0EB] border border-transparent'
                }`}
              >
                {tab.label}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    filterTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F0F0EB] text-[#9CA3AF]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-[#F0F0EB] bg-[#FAFAF8]">
                  <th className="px-4 py-3 text-left w-10">
                    <SortHeader label="#" sortKey="rank" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">股票</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">
                    <span className="text-[11px] font-medium text-[#6B7280]">行业</span>
                  </th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">
                    <SortHeader label="市值($M)" sortKey="value" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="仓位占比" sortKey="weight" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader label="仓位变化" sortKey="weightDelta" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-center hidden sm:table-cell">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F9F9F6]">
                {filteredHoldings.map((h, idx) => {
                  const isNew = h.action === 'new'
                  return (
                    <tr
                      key={h.symbol}
                      className={`hover:bg-[#FAFAF8] transition-colors ${isNew ? 'bg-emerald-50/30' : ''}`}
                    >
                      <td className="px-4 py-3.5">
                        <span className="text-[12px] text-[#9CA3AF] font-medium">{h.rank}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[14px] font-semibold text-[#1F2937]">{h.symbol}</span>
                            {isNew && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">NEW</span>}
                          </div>
                          <p className="text-[11px] text-[#9CA3AF] truncate max-w-[140px]">{h.company}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-[12px] text-[#6B7280] bg-[#F9F9F6] px-2 py-0.5 rounded-md">{h.sector}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                        <span className="text-[13px] text-[#374151]">
                          ${h.value >= 1000 ? `${(h.value / 1000).toFixed(1)}B` : `${h.value}M`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <WeightBar
                          weight={h.weight}
                          maxWeight={maxWeight}
                          color={guru.topColors[Math.min(idx, guru.topColors.length - 1)]}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ChangeIndicator value={h.weightDelta} pct />
                      </td>
                      <td className="px-4 py-3.5 text-center hidden sm:table-cell">
                        <ActionBadge action={h.action} />
                      </td>
                    </tr>
                  )
                })}
                {filteredHoldings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#9CA3AF]">
                      该分类下暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="px-4 py-3 border-t border-[#F0F0EB] bg-[#FAFAF8] flex items-center justify-between">
            <span className="text-[12px] text-[#9CA3AF]">
              显示 {filteredHoldings.length} / {guru.holdings.length} 条记录
            </span>
            <a
              href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=13F&dateb=&owner=include&count=10`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] text-emerald-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              查看 SEC 原始申报
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-[11px] text-[#9CA3AF] leading-relaxed pb-4">
          数据来源：美国 SEC EDGAR 公开披露（Form 13-F），持仓披露存在约 45 天延迟。以上内容仅供信息参考，不构成任何投资建议。
        </p>
      </div>
    </div>
  )
}
