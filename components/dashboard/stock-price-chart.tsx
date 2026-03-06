'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface StockPriceData {
  ticker: string
  currency: string
  price_change_percent: string
  current_price: string
  high: string
  low: string
  prices: Array<{
    date: string
    open: string
    high: string
    low: string
    close: string
    volume: number
  }>
  last_updated: string
}

// Pure SVG sparkline — no recharts dependency, lightweight for card embedding
export function StockPriceChart({ data }: { data: StockPriceData }) {
  const { points, minY, maxY, changePct, isPositive, currentPrice } = useMemo(() => {
    const prices = data.prices.map(p => parseFloat(p.close))
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const pct = parseFloat(data.price_change_percent)
    return {
      points: prices,
      minY: min,
      maxY: max,
      changePct: pct,
      isPositive: pct >= 0,
      currentPrice: parseFloat(data.current_price),
    }
  }, [data])

  // SVG dimensions
  const width = 120
  const height = 40
  const padding = 2

  // Build path
  const range = maxY - minY || 1
  const xStep = (width - padding * 2) / Math.max(points.length - 1, 1)
  const pathPoints = points.map((p, i) => ({
    x: padding + i * xStep,
    y: padding + (1 - (p - minY) / range) * (height - padding * 2),
  }))

  const linePath = pathPoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ')

  // Gradient fill area path
  const areaPath = `${linePath} L${pathPoints[pathPoints.length - 1].x.toFixed(1)},${height} L${pathPoints[0].x.toFixed(1)},${height} Z`

  const strokeColor = isPositive ? '#059669' : '#DC2626'
  const fillColor = isPositive ? 'rgba(5,150,105,0.10)' : 'rgba(220,38,38,0.10)'
  const gradientId = `grad-${data.ticker}`

  return (
    <div className="flex items-center gap-3">
      {/* Mini chart */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.15} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current price dot */}
        {pathPoints.length > 0 && (
          <circle
            cx={pathPoints[pathPoints.length - 1].x}
            cy={pathPoints[pathPoints.length - 1].y}
            r={2}
            fill={strokeColor}
          />
        )}
      </svg>

      {/* Price info */}
      <div className="text-right min-w-[70px]">
        <div className="text-sm font-semibold text-[#1F2937]">
          ${currentPrice.toFixed(2)}
        </div>
        <div className={`text-[11px] font-medium flex items-center justify-end gap-0.5 ${
          isPositive ? 'text-emerald-600' : 'text-red-500'
        }`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? '+' : ''}{changePct.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}

// Loading skeleton
export function StockPriceChartSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="w-[120px] h-[40px] bg-[#F0F0EB] rounded" />
      <div className="text-right min-w-[70px]">
        <div className="h-4 w-14 bg-[#F0F0EB] rounded mb-1 ml-auto" />
        <div className="h-3 w-12 bg-[#F0F0EB] rounded ml-auto" />
      </div>
    </div>
  )
}
