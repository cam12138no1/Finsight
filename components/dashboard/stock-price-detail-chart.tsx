'use client'

/**
 * StockPriceDetailChart
 *
 * Professional financial chart following Bloomberg/TradingView conventions:
 * - Phase 2 (Data Modeling): full OHLCV ingestion, derived metrics (range, avg vol)
 * - Phase 3 (Insight Generation): trend direction, price vs 14D range, volatility signal
 * - Phase 4 (Reporting): Area + volume histogram, OHLCV crosshair tooltip, key stats row
 *
 * Uses recharts ComposedChart (already in the project) — no new dependencies.
 */

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { StockPriceData } from './stock-price-chart'

interface ChartPoint {
  date: string          // display date  e.g. "02/20"
  fullDate: string      // full ISO date  e.g. "2026-02-20"
  open: number
  high: number
  low: number
  close: number
  volume: number
  volumeM: number       // volume in millions
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtVol(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toString()
}

// ─── Custom OHLCV crosshair tooltip ───────────────────────────────────────────
function OHLCVTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d: ChartPoint = payload[0]?.payload
  if (!d) return null

  const change = d.close - d.open
  const changePct = (change / d.open) * 100
  const isUp = change >= 0

  return (
    <div className="bg-white border border-[#E8E8E3] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.10)] p-3.5 text-xs min-w-[168px]">
      <p className="font-semibold text-[#1F2937] mb-2.5 text-[13px]">{d.fullDate}</p>
      <div className="space-y-1">
        <div className="grid grid-cols-2 gap-x-4">
          <span className="text-[#9CA3AF]">Open</span>
          <span className="font-mono font-semibold text-[#1F2937] text-right">${fmt(d.open)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <span className="text-[#9CA3AF]">High</span>
          <span className="font-mono font-semibold text-emerald-600 text-right">${fmt(d.high)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <span className="text-[#9CA3AF]">Low</span>
          <span className="font-mono font-semibold text-red-500 text-right">${fmt(d.low)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <span className="text-[#9CA3AF]">Close</span>
          <span className={`font-mono font-semibold text-right ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
            ${fmt(d.close)}
          </span>
        </div>
        <div className="border-t border-[#F0F0EB] pt-1 mt-1 grid grid-cols-2 gap-x-4">
          <span className="text-[#9CA3AF]">Change</span>
          <span className={`font-mono font-semibold text-right ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <span className="text-[#9CA3AF]">Volume</span>
          <span className="font-mono text-[#6B7280] text-right">{fmtVol(d.volume)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main chart component ──────────────────────────────────────────────────────
export default function StockPriceDetailChart({ data }: { data: StockPriceData }) {
  const {
    points, firstClose, lastClose, isUp, changePct, priceMin, priceMax,
    avgVolume, gradientId, volGradientId, priceColor, fillColor,
  } = useMemo(() => {
    const prices = data.prices || []
    const first = parseFloat(prices[0]?.close || '0')
    const last = parseFloat(data.current_price || prices[prices.length - 1]?.close || '0')
    const up = last >= first
    const pct = parseFloat(data.price_change_percent || '0')
    const closes = prices.map(p => parseFloat(p.close))
    const lows   = prices.map(p => parseFloat(p.low))
    const highs  = prices.map(p => parseFloat(p.high))
    const min = Math.min(...lows)
    const max = Math.max(...highs)
    const padding = (max - min) * 0.08
    const totalVol = prices.reduce((s, p) => s + (p.volume || 0), 0)
    const avgVol = prices.length > 0 ? totalVol / prices.length : 0

    const color = up ? '#059669' : '#DC2626'
    const fill  = up ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.12)'

    const pts: ChartPoint[] = prices.map(p => {
      const d = new Date(p.date)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return {
        date: `${mm}/${dd}`,
        fullDate: p.date,
        open:   parseFloat(p.open),
        high:   parseFloat(p.high),
        low:    parseFloat(p.low),
        close:  parseFloat(p.close),
        volume: p.volume,
        volumeM: +(p.volume / 1e6).toFixed(2),
      }
    })

    return {
      points: pts,
      firstClose: first,
      lastClose: last,
      isUp: up,
      changePct: pct,
      priceMin: min - padding,
      priceMax: max + padding,
      avgVolume: avgVol,
      gradientId:    `price-grad-${data.ticker}`,
      volGradientId: `vol-grad-${data.ticker}`,
      priceColor: color,
      fillColor: fill,
    }
  }, [data])

  if (!points.length) return null

  const current = parseFloat(data.current_price || '0')
  const high14  = parseFloat(data.high || '0')
  const low14   = parseFloat(data.low  || '0')
  const range   = high14 - low14
  const posInRange = range > 0 ? ((current - low14) / range) * 100 : 50

  const stats = [
    { label: '当前价',  value: `$${fmt(current)}`,     color: isUp ? '#059669' : '#DC2626' },
    { label: '14日高点', value: `$${fmt(high14)}`,      color: '#059669' },
    { label: '14日低点', value: `$${fmt(low14)}`,       color: '#DC2626' },
    { label: '均量',    value: fmtVol(Math.round(avgVolume)), color: '#6B7280' },
  ]

  return (
    <div className="bg-white rounded-xl border border-[#E8E8E3] shadow-sm p-5 mb-6">
      {/* ── Header row ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Activity className="h-4 w-4 text-[#9CA3AF]" />
            <h4 className="text-sm font-semibold text-[#4B5563]">
              过去 14 个交易日股价走势
            </h4>
          </div>
          <p className="text-[11px] text-[#9CA3AF] ml-6">收盘价 · OHLCV · {data.currency}</p>
        </div>
        {/* Large price + change badge */}
        <div className="text-right">
          <div className="text-2xl font-bold text-[#1F2937] font-mono">
            ${fmt(current)}
          </div>
          <div className={`inline-flex items-center gap-1 text-[13px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
            isUp
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : 'text-red-600 bg-red-50 border border-red-200'
          }`}>
            {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* ── Key stats strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-0 mb-4 divide-x divide-[#F0F0EB] bg-[#FAFAF8] rounded-lg border border-[#F0F0EB]">
        {stats.map(s => (
          <div key={s.label} className="px-3 py-2 text-center">
            <p className="text-[10px] text-[#9CA3AF] mb-0.5">{s.label}</p>
            <p className="text-[13px] font-mono font-semibold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Price area chart ─────────────────────────────────────────── */}
      <div className="relative">
        <svg width={0} height={0} className="absolute">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={priceColor} stopOpacity={0.20} />
              <stop offset="100%" stopColor={priceColor} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id={volGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={priceColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={priceColor} stopOpacity={0.10} />
            </linearGradient>
          </defs>
        </svg>

        {/* Price panel */}
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={points} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={priceColor} stopOpacity={0.20} />
                <stop offset="100%" stopColor={priceColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#F0F0EB"
              horizontal={true}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[priceMin, priceMax]}
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              width={48}
            />
            <Tooltip content={<OHLCVTooltip />} cursor={{ stroke: '#D1D5DB', strokeWidth: 1, strokeDasharray: '4 2' }} />
            <Area
              type="monotone"
              dataKey="close"
              name="Close"
              stroke={priceColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: priceColor, strokeWidth: 2, stroke: '#fff' }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Volume panel */}
        <ResponsiveContainer width="100%" height={70}>
          <ComposedChart data={points} margin={{ top: 2, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={volGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={priceColor} stopOpacity={0.40} />
                <stop offset="100%" stopColor={priceColor} stopOpacity={0.10} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="none" />
            <XAxis dataKey="date" hide />
            <YAxis
              tick={{ fontSize: 9, fill: '#C0C0BB' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}M`}
              width={48}
            />
            <Tooltip content={() => null} />
            <Bar
              dataKey="volumeM"
              name="Volume (M)"
              fill={`url(#${volGradientId})`}
              radius={[2, 2, 0, 0]}
              maxBarSize={28}
            />
            {/* Average volume reference line */}
            <ReferenceLine
              y={+(avgVolume / 1e6).toFixed(2)}
              stroke="#D1D5DB"
              strokeDasharray="4 2"
              strokeWidth={1}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Volume label */}
        <p className="text-[10px] text-[#C0C0BB] text-right mt-0.5 pr-8">
          成交量（百万股）— 虚线：{points.length}日均量
        </p>
      </div>

      {/* ── 14D Range bar (Bloomberg-style) ─────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-[#F0F0EB]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-red-500 font-mono font-semibold w-16 text-right">${fmt(low14)}</span>
          <div className="flex-1 relative">
            <div className="h-1.5 bg-[#F0F0EB] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${posInRange}%`,
                  background: `linear-gradient(to right, #DC2626, ${isUp ? '#059669' : '#DC2626'})`,
                }}
              />
            </div>
            {/* Current price tick */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow"
              style={{ left: `calc(${posInRange}% - 5px)`, backgroundColor: priceColor }}
            />
          </div>
          <span className="text-[11px] text-emerald-600 font-mono font-semibold w-16">${fmt(high14)}</span>
        </div>
        <p className="text-center text-[10px] text-[#9CA3AF] mt-1.5">
          14 日价格区间 · 当前价位于区间 {posInRange.toFixed(0)}% 分位
        </p>
      </div>
    </div>
  )
}
