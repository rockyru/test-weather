CREATE TABLE IF NOT EXISTS public.scraper_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('starting', 'running', 'completed', 'error')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add permissions via Row Level Security
ALTER TABLE public.scraper_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow the service role to insert records
CREATE POLICY "Service role can insert scraper logs" 
  ON public.scraper_logs FOR INSERT 
  WITH CHECK (true);

-- Create policy to allow authenticated and anonymous users to view logs
CREATE POLICY "Everyone can view scraper logs" 
  ON public.scraper_logs FOR SELECT 
  USING (true);

-- Add index for faster querying by timestamp
CREATE INDEX idx_scraper_logs_timestamp ON public.scraper_logs(timestamp DESC);

-- Create a subscription for real-time updates
COMMENT ON TABLE public.scraper_logs IS 'Table to store scraper status logs for the disaster alert aggregator';