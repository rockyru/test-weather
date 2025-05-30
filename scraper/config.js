// Configuration file for the scraper
// This allows us to access environment variables from a parent directory or use defaults
require('dotenv').config({ path: '../.env' });

// Set this to true to use sample alerts instead of scraping
const USE_SAMPLE_ALERTS = true;

module.exports = {
  // Use sample alerts flag to bypass scraping and RLS issues
  useSampleAlerts: USE_SAMPLE_ALERTS,
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL || 'https://lgqfdbygspzkcrvybcwc.supabase.co',
  supabaseKey: process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncWZkYnlnc3B6a2NydnliY3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MzkxMzksImV4cCI6MjA2NDExNTEzOX0.C6avhDS3ZfSbMZdSp40-NhODKeqLb2oee6_y7Y2DMTY',
  scrapingInterval: 15 * 60 * 1000, // 15 minutes in milliseconds
  sources: {
    pagasa: 'https://www.pagasa.dost.gov.ph/',
    phivolcs: 'https://www.phivolcs.dost.gov.ph/'
  }
};
