import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number, decimals: number = 2): string {
  if (Math.abs(num) >= 1e9) {
    return `$${(num / 1e9).toFixed(decimals)}B`
  } else if (Math.abs(num) >= 1e6) {
    return `$${(num / 1e6).toFixed(decimals)}M`
  } else if (Math.abs(num) >= 1e3) {
    return `$${(num / 1e3).toFixed(decimals)}K`
  }
  return `$${num.toFixed(decimals)}`
}

export function formatPercentage(num: number, decimals: number = 2): string {
  return `${(num * 100).toFixed(decimals)}%`
}

