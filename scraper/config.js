// Configuration file for the scraper
// This allows us to access environment variables from a parent directory or use defaults
require('dotenv').config({ path: '../.env' });

// Set this to true to use sample alerts instead of scraping
const USE_SAMPLE_ALERTS = true;

module.exports = {
  // Use sample alerts flag to bypass scraping and RLS issues
  useSampleAlerts: USE_SAMPLE_ALERTS,
  supabaseUrl: process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || 'https://evslaslqmaimiaxrapbr.supabase.co',
  supabaseKey: process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2c2xhc2xxbWFpbWlheHJhcGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMDY4MDAsImV4cCI6MjA2ODY4MjgwMH0.EhtYWyJRFltCwP0F7Nj392E0dWF1k4-CO5k8HEZoSOw', // Load from environment variables
  scrapingInterval: 15 * 60 * 1000, // 15 minutes in milliseconds
  openweathermapApiKey: process.env.OPENWEATHERMAP_API_KEY || '7c89da4d070339aa6821d774b6b0df1a',
  sources: {
    pagasa: 'https://www.pagasa.dost.gov.ph/', // For PAGASA specific bulletins (typhoons, floods)
    phivolcs: 'https://www.phivolcs.dost.gov.ph/', // For PHIVOLCS specific bulletins (volcanoes)
    usgsApi: 'https://earthquake.usgs.gov/fdsnws/event/1/query', // USGS Earthquake API
    openWeatherMapApi: 'https://api.openweathermap.org/data/2.5/' // Base URL for OpenWeatherMap
  }
};
