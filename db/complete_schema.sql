-- Complete SQL schema for Disaster Alert Aggregator PH
-- This script will create all necessary tables and permissions

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (be careful with this in production!)
DROP TABLE IF EXISTS disaster_alerts;

-- Create disaster_alerts table with all fields including severity
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

-- Create policy to allow service role to select data
CREATE POLICY "Allow service role to select" ON disaster_alerts
  FOR SELECT
  TO service_role
  USING (true);

-- Create policy to allow service role to update data
CREATE POLICY "Allow service role to update" ON disaster_alerts
  FOR UPDATE
  TO service_role
  USING (true);

-- Index for faster querying by category and region
CREATE INDEX idx_disaster_alerts_category ON disaster_alerts(category);
CREATE INDEX idx_disaster_alerts_region ON disaster_alerts(region);
CREATE INDEX idx_disaster_alerts_published_at ON disaster_alerts(published_at DESC);
CREATE INDEX idx_disaster_alerts_severity ON disaster_alerts(severity);

-- Index to help prevent duplicates
CREATE UNIQUE INDEX idx_disaster_alerts_title_source_published_at 
  ON disaster_alerts(title, source, published_at);

-- Grant explicit permissions to roles
GRANT SELECT ON disaster_alerts TO anon;
GRANT SELECT, INSERT, UPDATE ON disaster_alerts TO service_role;

-- Insert sample data for testing
INSERT INTO disaster_alerts (
  source, 
  title, 
  description, 
  category, 
  region, 
  published_at,
  link,
  severity
) VALUES 
(
  'PAGASA',
  'Weather Advisory: Cloudy skies in Zamboanga Peninsula',
  'Cloudy skies with scattered rains and thunderstorms are expected due to the trough of a low-pressure area. This weather condition may lead to possible flash floods or landslides in areas prone to these hazards.',
  'weather',
  'Zamboanga Peninsula',
  now(),
  'https://www.pagasa.dost.gov.ph/weather',
  'low'
),
(
  'PHIVOLCS',
  'Volcano Advisory: Kanlaon Volcano Alert Level 3',
  'Alert Level 3 (Increased Tendency Towards Hazardous Eruption) is maintained over Kanlaon Volcano. The public is reminded to remain vigilant and avoid entry into the 4-kilometer radius Permanent Danger Zone.',
  'volcano',
  'Western Visayas',
  now(),
  'https://www.phivolcs.dost.gov.ph/volcano-bulletin',
  'high'
),
(
  'PHIVOLCS',
  'Volcano Status: Taal Volcano Alert Level 1',
  'Alert Level 1 (Low-Level Unrest) is maintained over Taal Volcano. The public is advised to avoid entry into the Taal Volcano Island as it remains a Permanent Danger Zone.',
  'volcano',
  'CALABARZON',
  now(),
  'https://www.phivolcs.dost.gov.ph/volcano-bulletin',
  'low'
),
(
  'PHIVOLCS',
  'Volcano Status: Mayon Volcano Alert Level 1',
  'Alert Level 1 (Low-Level Unrest) is maintained over Mayon Volcano. The public is advised to avoid entry into the 6-kilometer radius Permanent Danger Zone.',
  'volcano',
  'Bicol Region',
  now(),
  'https://www.phivolcs.dost.gov.ph/volcano-bulletin',
  'low'
),
(
  'PAGASA',
  'Rainfall Advisory',
  'Light to moderate rainshowers with possible occasional heavy rains are expected over Metro Manila and nearby provinces in the next 2 hours.',
  'rainfall',
  'Metro Manila',
  now(),
  'https://www.pagasa.dost.gov.ph/weather',
  'medium'
);
