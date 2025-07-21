// Special configuration file for the scraper with service role key
// This allows the scraper to have the necessary permissions to insert data
require('dotenv').config({ path: '../.env' });

module.exports = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || 'your-supabase-url', // Must be set in environment variables
  
  // For the scraper, use the service role key instead of anon key
  // This will be provided through environment variables when running in GitHub Actions
  supabaseKey: process.env.SUPABASE_KEY || 'your-service-role-key', // Must be set in environment variables
  
  scrapingInterval: 15 * 60 * 1000, // 15 minutes in milliseconds
  useSampleAlerts: false, // Actually scrape websites instead of using sample data
  openweathermapApiKey: process.env.OPENWEATHERMAP_API_KEY, // Must be set in environment variables
  sources: {
    pagasa: 'https://www.pagasa.dost.gov.ph/', // For PAGASA specific bulletins (typhoons, floods)
    phivolcs: 'https://www.phivolcs.dost.gov.ph/', // For PHIVOLCS specific bulletins (volcanoes)
    usgsApi: 'https://earthquake.usgs.gov/fdsnws/event/1/query', // USGS Earthquake API
    openWeatherMapApi: 'https://api.openweathermap.org/data/2.5/' // Base URL for OpenWeatherMap
  }
};
