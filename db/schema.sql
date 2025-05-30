-- Create disaster_alerts table
CREATE TABLE disaster_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('typhoon', 'earthquake', 'flood', 'volcano', 'rainfall', 'landslide', 'weather')),
  region TEXT,
  published_at TIMESTAMP,
  link TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  created_at TIMESTAMP DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE disaster_alerts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous select access
CREATE POLICY "Allow anonymous select" ON disaster_alerts
  FOR SELECT
  TO anon
  USING (true);

-- Create policy to allow service role to insert data
CREATE POLICY "Allow service role to insert" ON disaster_alerts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Index for faster querying by category and region
CREATE INDEX idx_disaster_alerts_category ON disaster_alerts(category);
CREATE INDEX idx_disaster_alerts_region ON disaster_alerts(region);
CREATE INDEX idx_disaster_alerts_published_at ON disaster_alerts(published_at DESC);

-- Index to help prevent duplicates
CREATE UNIQUE INDEX idx_disaster_alerts_title_source_published_at 
  ON disaster_alerts(title, source, published_at);
