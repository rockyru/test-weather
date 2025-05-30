// Special configuration file for the scraper with service role key
// This allows the scraper to have the necessary permissions to insert data
require('dotenv').config({ path: '../.env' });

module.exports = {
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL || 'https://lgqfdbygspzkcrvybcwc.supabase.co',
  
  // For the scraper, use the service role key instead of anon key
  // You'll need to replace this with your actual service role key from Supabase dashboard
  supabaseServiceKey: 'YOUR_SERVICE_ROLE_KEY_HERE', // Replace with your actual service role key
  
  scrapingInterval: 15 * 60 * 1000, // 15 minutes in milliseconds
  sources: {
    pagasa: 'https://www.pagasa.dost.gov.ph/',
    phivolcs: 'https://www.phivolcs.dost.gov.ph/'
  }
};
