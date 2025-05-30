// Special configuration file for the scraper with service role key
// This allows the scraper to have the necessary permissions to insert data
require('dotenv').config({ path: '../.env' });

module.exports = {
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL || 'https://lgqfdbygspzkcrvybcwc.supabase.co',
  
  // For the scraper, use the service role key instead of anon key
  // This will be provided through environment variables when running in GitHub Actions
  supabaseKey: process.env.SUPABASE_KEY || 'YOUR_SERVICE_ROLE_KEY_HERE', // Will be replaced by the GitHub Actions secret
  
  scrapingInterval: 15 * 60 * 1000, // 15 minutes in milliseconds
  sources: {
    pagasa: 'https://www.pagasa.dost.gov.ph/',
    phivolcs: 'https://www.phivolcs.dost.gov.ph/'
  }
};
