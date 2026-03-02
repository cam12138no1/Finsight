-- Schema for storing financial data fetched daily from colleague's API
-- This table stores quarterly/annual financial metrics for tracked companies

CREATE TABLE IF NOT EXISTS fetched_financials (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  fiscal_quarter INTEGER NOT NULL,
  period VARCHAR(20) NOT NULL,

  -- Core financial metrics
  revenue VARCHAR(50),
  revenue_yoy VARCHAR(50),
  net_income VARCHAR(50),
  net_income_yoy VARCHAR(50),
  eps VARCHAR(50),
  eps_yoy VARCHAR(50),
  operating_margin VARCHAR(50),
  gross_margin VARCHAR(50),

  -- Raw report data
  report_text TEXT,
  report_url VARCHAR(500),
  filing_date VARCHAR(50),

  -- AI analysis result (JSONB, generated after fetching)
  analysis_result JSONB,
  analyzed_at TIMESTAMP,

  -- Metadata
  fetched_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(symbol, fiscal_year, fiscal_quarter)
);

CREATE INDEX IF NOT EXISTS idx_fetched_financials_symbol ON fetched_financials(symbol);
CREATE INDEX IF NOT EXISTS idx_fetched_financials_category ON fetched_financials(category);
CREATE INDEX IF NOT EXISTS idx_fetched_financials_period ON fetched_financials(fiscal_year DESC, fiscal_quarter DESC);
CREATE INDEX IF NOT EXISTS idx_fetched_financials_fetched ON fetched_financials(fetched_at DESC);

-- Table to track cron job execution history
CREATE TABLE IF NOT EXISTS cron_job_log (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  companies_checked INTEGER DEFAULT 0,
  new_reports_found INTEGER DEFAULT 0,
  errors TEXT,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_cron_job_log_name ON cron_job_log(job_name, started_at DESC);
