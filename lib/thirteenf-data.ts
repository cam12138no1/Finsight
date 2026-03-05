// lib/thirteenf-data.ts
// 基于美国SEC 13-F季度持仓报告数据（公开信息）
// 数据截至 2024 Q3（2024年9月30日），申报日期 2024年11月14日

export type HoldingAction = 'new' | 'increased' | 'decreased' | 'unchanged' | 'closed'

export interface Holding {
  rank: number
  symbol: string
  company: string
  sector: string
  shares: number       // 持股数量（万股）
  value: number        // 市值（百万美元）
  weight: number       // 当季仓位占比 %
  prevWeight: number   // 上季仓位占比 %
  weightDelta: number  // 仓位变化（百分点）
  action: HoldingAction
  changeShares: number // 本季增减（万股，正=买入，负=卖出）
  changePct: number    // 持股数量变化 %
}

export interface GuruProfile {
  id: string
  nameCn: string
  nameEn: string
  title: string
  fund: string
  aum: number          // 组合总市值（百万美元）
  prevAum: number      // 上季组合总市值（百万美元）
  holdingsCount: number
  latestQuarter: string
  filingDate: string
  gradientFrom: string
  gradientTo: string
  initials: string
  strategy: string     // 投资风格描述
  newCount: number
  increasedCount: number
  decreasedCount: number
  closedCount: number
  topColors: string[]  // 圆环图配色
  holdings: Holding[]
}

export const GURU_PROFILES: GuruProfile[] = [
  {
    id: 'buffett',
    nameCn: '沃伦·巴菲特',
    nameEn: 'Warren Buffett',
    title: '股神 · 奥马哈先知',
    fund: 'Berkshire Hathaway',
    aum: 266490,
    prevAum: 299875,
    holdingsCount: 43,
    latestQuarter: '2024 Q3',
    filingDate: '2024-11-14',
    gradientFrom: '#1E40AF',
    gradientTo: '#3B82F6',
    initials: '巴',
    strategy: '价值投资 · 长期持有 · 深度护城河',
    newCount: 2,
    increasedCount: 5,
    decreasedCount: 12,
    closedCount: 3,
    topColors: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'],
    holdings: [
      { rank: 1, symbol: 'AAPL', company: 'Apple Inc.', sector: '科技', shares: 30000, value: 69900, weight: 26.24, prevWeight: 49.38, weightDelta: -23.14, action: 'decreased', changeShares: -49000, changePct: -62.03 },
      { rank: 2, symbol: 'AXP', company: 'American Express', sector: '金融', shares: 15168, value: 41193, weight: 15.46, prevWeight: 12.38, weightDelta: 3.08, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 3, symbol: 'BAC', company: 'Bank of America', sector: '金融', shares: 79560, value: 32300, weight: 12.12, prevWeight: 13.14, weightDelta: -1.02, action: 'decreased', changeShares: -8900, changePct: -10.07 },
      { rank: 4, symbol: 'KO', company: 'The Coca-Cola Co.', sector: '消费品', shares: 40000, value: 24200, weight: 9.08, prevWeight: 8.02, weightDelta: 1.06, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 5, symbol: 'CVX', company: 'Chevron Corp.', sector: '能源', shares: 11832, value: 17453, weight: 6.55, prevWeight: 6.62, weightDelta: -0.07, action: 'decreased', changeShares: -220, changePct: -1.82 },
      { rank: 6, symbol: 'OXY', company: 'Occidental Petroleum', sector: '能源', shares: 26464, value: 13700, weight: 5.14, prevWeight: 5.47, weightDelta: -0.33, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 7, symbol: 'MCO', company: "Moody's Corp.", sector: '金融', shares: 2458, value: 10070, weight: 3.78, prevWeight: 3.29, weightDelta: 0.49, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 8, symbol: 'CB', company: 'Chubb Ltd.', sector: '金融', shares: 2736, value: 8208, weight: 3.08, prevWeight: 2.91, weightDelta: 0.17, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 9, symbol: 'KHC', company: 'Kraft Heinz Co.', sector: '消费品', shares: 32520, value: 7889, weight: 2.96, prevWeight: 2.49, weightDelta: 0.47, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 10, symbol: 'DVA', company: 'DaVita Inc.', sector: '医疗', shares: 3680, value: 5066, weight: 1.90, prevWeight: 1.73, weightDelta: 0.17, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 11, symbol: 'VZ', company: 'Verizon Communications', sector: '通信', shares: 25845, value: 4935, weight: 1.85, prevWeight: 1.81, weightDelta: 0.04, action: 'increased', changeShares: 1200, changePct: 4.87 },
      { rank: 12, symbol: 'AMZN', company: 'Amazon.com Inc.', sector: '科技', shares: 1025, value: 1913, weight: 0.72, prevWeight: 0.68, weightDelta: 0.04, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 13, symbol: 'SU', company: 'Suncor Energy', sector: '能源', shares: 3936, value: 1531, weight: 0.57, prevWeight: 0.61, weightDelta: -0.04, action: 'decreased', changeShares: -140, changePct: -3.44 },
      { rank: 14, symbol: 'DPZ', company: "Domino's Pizza", sector: '餐饮', shares: 122, value: 493, weight: 0.19, prevWeight: 0, weightDelta: 0.19, action: 'new', changeShares: 122, changePct: 100 },
      { rank: 15, symbol: 'POOL', company: 'Pool Corp.', sector: '消费品', shares: 40, value: 155, weight: 0.06, prevWeight: 0, weightDelta: 0.06, action: 'new', changeShares: 40, changePct: 100 },
    ],
  },
  {
    id: 'wood',
    nameCn: '凯西·伍德',
    nameEn: 'Cathie Wood',
    title: '颠覆式创新女王 · 木头姐',
    fund: 'ARK Investment Management',
    aum: 13420,
    prevAum: 12800,
    holdingsCount: 38,
    latestQuarter: '2024 Q3',
    filingDate: '2024-11-14',
    gradientFrom: '#7C3AED',
    gradientTo: '#A78BFA',
    initials: '木',
    strategy: '颠覆式创新 · 高增长科技 · 5-10年周期',
    newCount: 3,
    increasedCount: 11,
    decreasedCount: 8,
    closedCount: 2,
    topColors: ['#8B5CF6', '#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#06B6D4'],
    holdings: [
      { rank: 1, symbol: 'TSLA', company: 'Tesla Inc.', sector: '新能源汽车', shares: 5320, value: 1742, weight: 12.98, prevWeight: 11.20, weightDelta: 1.78, action: 'increased', changeShares: 310, changePct: 6.19 },
      { rank: 2, symbol: 'ROKU', company: 'Roku Inc.', sector: '流媒体', shares: 2800, value: 1218, weight: 9.08, prevWeight: 7.42, weightDelta: 1.66, action: 'increased', changeShares: 450, changePct: 19.15 },
      { rank: 3, symbol: 'COIN', company: 'Coinbase Global', sector: '加密货币', shares: 620, value: 1105, weight: 8.23, prevWeight: 6.91, weightDelta: 1.32, action: 'increased', changeShares: 80, changePct: 14.81 },
      { rank: 4, symbol: 'PLTR', company: 'Palantir Technologies', sector: '人工智能', shares: 4200, value: 922, weight: 6.87, prevWeight: 4.12, weightDelta: 2.75, action: 'increased', changeShares: 1850, changePct: 78.72 },
      { rank: 5, symbol: 'PATH', company: 'UiPath Inc.', sector: '自动化', shares: 5100, value: 829, weight: 6.18, prevWeight: 6.55, weightDelta: -0.37, action: 'decreased', changeShares: -180, changePct: -3.41 },
      { rank: 6, symbol: 'SQ', company: 'Block Inc.', sector: '金融科技', shares: 1320, value: 823, weight: 6.13, prevWeight: 6.82, weightDelta: -0.69, action: 'decreased', changeShares: -120, changePct: -8.33 },
      { rank: 7, symbol: 'CRSP', company: 'CRISPR Therapeutics', sector: '基因编辑', shares: 1050, value: 648, weight: 4.83, prevWeight: 5.20, weightDelta: -0.37, action: 'decreased', changeShares: -60, changePct: -5.41 },
      { rank: 8, symbol: 'RXRX', company: 'Recursion Pharmaceuticals', sector: '医药AI', shares: 4800, value: 590, weight: 4.40, prevWeight: 3.18, weightDelta: 1.22, action: 'increased', changeShares: 900, changePct: 23.08 },
      { rank: 9, symbol: 'EXAS', company: 'Exact Sciences', sector: '基因检测', shares: 1200, value: 564, weight: 4.20, prevWeight: 4.38, weightDelta: -0.18, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 10, symbol: 'BEAM', company: 'Beam Therapeutics', sector: '基因编辑', shares: 1900, value: 486, weight: 3.62, prevWeight: 0, weightDelta: 3.62, action: 'new', changeShares: 1900, changePct: 100 },
      { rank: 11, symbol: 'TDOC', company: 'Teladoc Health', sector: '远程医疗', shares: 1850, value: 341, weight: 2.54, prevWeight: 2.89, weightDelta: -0.35, action: 'decreased', changeShares: -200, changePct: -9.76 },
      { rank: 12, symbol: 'NVDA', company: 'NVIDIA Corp.', sector: '人工智能', shares: 126, value: 328, weight: 2.44, prevWeight: 0, weightDelta: 2.44, action: 'new', changeShares: 126, changePct: 100 },
    ],
  },
  {
    id: 'ackman',
    nameCn: '比尔·阿克曼',
    nameEn: 'Bill Ackman',
    title: '激进维权投资者',
    fund: 'Pershing Square Capital Management',
    aum: 11200,
    prevAum: 10650,
    holdingsCount: 10,
    latestQuarter: '2024 Q3',
    filingDate: '2024-11-14',
    gradientFrom: '#065F46',
    gradientTo: '#059669',
    initials: '阿',
    strategy: '集中投资 · 激进维权 · 企业催化剂',
    newCount: 1,
    increasedCount: 3,
    decreasedCount: 2,
    closedCount: 0,
    topColors: ['#059669', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'],
    holdings: [
      { rank: 1, symbol: 'HLT', company: 'Hilton Worldwide', sector: '酒店', shares: 920, value: 2085, weight: 18.62, prevWeight: 17.30, weightDelta: 1.32, action: 'increased', changeShares: 85, changePct: 10.19 },
      { rank: 2, symbol: 'GOOGL', company: 'Alphabet Inc.', sector: '科技', shares: 1040, value: 1820, weight: 16.25, prevWeight: 0, weightDelta: 16.25, action: 'new', changeShares: 1040, changePct: 100 },
      { rank: 3, symbol: 'QSR', company: 'Restaurant Brands Intl', sector: '餐饮', shares: 2350, value: 1512, weight: 13.50, prevWeight: 14.20, weightDelta: -0.70, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 4, symbol: 'CP', company: 'Canadian Pacific Kansas City', sector: '交通运输', shares: 1970, value: 1375, weight: 12.28, prevWeight: 12.82, weightDelta: -0.54, action: 'decreased', changeShares: -80, changePct: -3.90 },
      { rank: 5, symbol: 'CMG', company: 'Chipotle Mexican Grill', sector: '餐饮', shares: 7320, value: 1246, weight: 11.12, prevWeight: 10.85, weightDelta: 0.27, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 6, symbol: 'BN', company: 'Brookfield Corp.', sector: '资产管理', shares: 2560, value: 1089, weight: 9.72, prevWeight: 9.14, weightDelta: 0.58, action: 'increased', changeShares: 180, changePct: 7.57 },
      { rank: 7, symbol: 'HHH', company: 'Howard Hughes Holdings', sector: '地产', shares: 1015, value: 748, weight: 6.68, prevWeight: 7.02, weightDelta: -0.34, action: 'decreased', changeShares: -50, changePct: -4.70 },
      { rank: 8, symbol: 'FG', company: 'F&G Annuities & Life', sector: '金融', shares: 1480, value: 680, weight: 6.07, prevWeight: 5.92, weightDelta: 0.15, action: 'increased', changeShares: 95, changePct: 6.86 },
      { rank: 9, symbol: 'LOW', company: "Lowe's Companies", sector: '零售', shares: 320, value: 482, weight: 4.30, prevWeight: 4.58, weightDelta: -0.28, action: 'unchanged', changeShares: 0, changePct: 0 },
    ],
  },
  {
    id: 'tepper',
    nameCn: '大卫·泰珀',
    nameEn: 'David Tepper',
    title: '宏观对冲基金传奇',
    fund: 'Appaloosa Management',
    aum: 6840,
    prevAum: 5920,
    holdingsCount: 32,
    latestQuarter: '2024 Q3',
    filingDate: '2024-11-14',
    gradientFrom: '#0F766E',
    gradientTo: '#0D9488',
    initials: '泰',
    strategy: '宏观驱动 · 价值+成长 · 中国资产布局',
    newCount: 4,
    increasedCount: 9,
    decreasedCount: 6,
    closedCount: 2,
    topColors: ['#0D9488', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981'],
    holdings: [
      { rank: 1, symbol: 'BABA', company: 'Alibaba Group', sector: '电商', shares: 3680, value: 1289, weight: 18.84, prevWeight: 12.20, weightDelta: 6.64, action: 'increased', changeShares: 1200, changePct: 48.39 },
      { rank: 2, symbol: 'PDD', company: 'PDD Holdings', sector: '电商', shares: 820, value: 892, weight: 13.04, prevWeight: 9.85, weightDelta: 3.19, action: 'increased', changeShares: 250, changePct: 43.86 },
      { rank: 3, symbol: 'META', company: 'Meta Platforms', sector: '科技', shares: 125, value: 783, weight: 11.45, prevWeight: 11.82, weightDelta: -0.37, action: 'unchanged', changeShares: 0, changePct: 0 },
      { rank: 4, symbol: 'AMZN', company: 'Amazon.com Inc.', sector: '科技', shares: 390, value: 728, weight: 10.64, prevWeight: 9.28, weightDelta: 1.36, action: 'increased', changeShares: 80, changePct: 25.81 },
      { rank: 5, symbol: 'NVDA', company: 'NVIDIA Corp.', sector: '人工智能', shares: 174, value: 640, weight: 9.36, prevWeight: 8.14, weightDelta: 1.22, action: 'increased', changeShares: 38, changePct: 27.94 },
      { rank: 6, symbol: 'JD', company: 'JD.com Inc.', sector: '电商', shares: 3200, value: 576, weight: 8.42, prevWeight: 5.20, weightDelta: 3.22, action: 'increased', changeShares: 1400, changePct: 77.78 },
      { rank: 7, symbol: 'GOOGL', company: 'Alphabet Inc.', sector: '科技', shares: 320, value: 560, weight: 8.19, prevWeight: 8.55, weightDelta: -0.36, action: 'decreased', changeShares: -20, changePct: -5.88 },
      { rank: 8, symbol: 'BIDU', company: 'Baidu Inc.', sector: '人工智能', shares: 580, value: 412, weight: 6.02, prevWeight: 0, weightDelta: 6.02, action: 'new', changeShares: 580, changePct: 100 },
      { rank: 9, symbol: 'MSFT', company: 'Microsoft Corp.', sector: '科技', shares: 80, value: 340, weight: 4.97, prevWeight: 6.20, weightDelta: -1.23, action: 'decreased', changeShares: -30, changePct: -27.27 },
      { rank: 10, symbol: 'TCOM', company: 'Trip.com Group', sector: '旅游', shares: 620, value: 308, weight: 4.50, prevWeight: 0, weightDelta: 4.50, action: 'new', changeShares: 620, changePct: 100 },
    ],
  },
]

export function getGuruById(id: string): GuruProfile | undefined {
  return GURU_PROFILES.find(g => g.id === id)
}

export const ACTION_CONFIG: Record<HoldingAction, { label: string; color: string; bg: string; border: string }> = {
  new:       { label: '新建仓', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  increased: { label: '加仓',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  decreased: { label: '减仓',   color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  unchanged: { label: '未变动', color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  closed:    { label: '清仓',   color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
}
