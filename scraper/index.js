const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const config = require('./config');

// Supabase configuration
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

console.log(`Scraper initialized with Supabase URL: ${config.supabaseUrl}`);
console.log(`Scraper will run every ${config.scrapingInterval / (60 * 1000)} minutes`);

// Function to scrape PAGASA website
async function scrapePAGASA() {
  try {
    console.log('Scraping PAGASA...');
    const response = await axios.get(config.sources.pagasa);
    const $ = cheerio.load(response.data);
    const alerts = [];

    // Extract typhoon warnings
    $('.typhoon-bulletin').each((i, el) => {
      const title = $(el).find('h3').text().trim();
      const description = $(el).find('.bulletin-content').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      alerts.push({
        source: 'PAGASA',
        title,
        description,
        category: 'typhoon',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.pagasa.dost.gov.ph/').href : null,
      });
    });

    // Extract flood bulletins
    $('.flood-bulletin').each((i, el) => {
      const title = $(el).find('h3').text().trim();
      const description = $(el).find('.bulletin-content').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      alerts.push({
        source: 'PAGASA',
        title,
        description,
        category: 'flood',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.pagasa.dost.gov.ph/').href : null,
      });
    });

    // Extract rainfall advisories
    $('.rainfall-advisory').each((i, el) => {
      const title = $(el).find('h3').text().trim();
      const description = $(el).find('.advisory-content').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      alerts.push({
        source: 'PAGASA',
        title,
        description,
        category: determineCategory(title, description),
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.pagasa.dost.gov.ph/').href : null,
      });
    });

    return alerts;
  } catch (error) {
    console.error('Error scraping PAGASA:', error);
    return [];
  }
}

// Function to scrape PHIVOLCS website
async function scrapePHIVOLCS() {
  try {
    console.log('Scraping PHIVOLCS...');
    const response = await axios.get(config.sources.phivolcs);
    const $ = cheerio.load(response.data);
    const alerts = [];

    // Extract earthquake bulletins
    $('.earthquake-bulletin').each((i, el) => {
      const title = $(el).find('h3').text().trim();
      const description = $(el).find('.bulletin-content').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      alerts.push({
        source: 'PHIVOLCS',
        title,
        description,
        category: 'earthquake',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.phivolcs.dost.gov.ph/').href : null,
      });
    });

    // Extract volcano updates
    $('.volcano-advisory').each((i, el) => {
      const title = $(el).find('h3').text().trim();
      const description = $(el).find('.advisory-content').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      alerts.push({
        source: 'PHIVOLCS',
        title,
        description,
        category: 'volcano',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.phivolcs.dost.gov.ph/').href : null,
      });
    });

    return alerts;
  } catch (error) {
    console.error('Error scraping PHIVOLCS:', error);
    return [];
  }
}

// Helper function to extract region from text
function extractRegionFromText(text) {
  // This is a simple extraction and would need to be improved for production
  const regionPatterns = [
    { pattern: /Region\s+([IVX]+)/i, group: 1 },
    { pattern: /Metro\s+Manila/i, replacement: 'Metro Manila' },
    { pattern: /CALABARZON/i, replacement: 'CALABARZON' },
    { pattern: /MIMAROPA/i, replacement: 'MIMAROPA' },
    { pattern: /CAR/i, replacement: 'Cordillera Administrative Region' },
    { pattern: /Ilocos/i, replacement: 'Ilocos Region' },
    { pattern: /Cagayan/i, replacement: 'Cagayan Valley' },
    { pattern: /Central\s+Luzon/i, replacement: 'Central Luzon' },
    { pattern: /Bicol/i, replacement: 'Bicol Region' },
    { pattern: /Western\s+Visayas/i, replacement: 'Western Visayas' },
    { pattern: /Central\s+Visayas/i, replacement: 'Central Visayas' },
    { pattern: /Eastern\s+Visayas/i, replacement: 'Eastern Visayas' },
    { pattern: /Zamboanga/i, replacement: 'Zamboanga Peninsula' },
    { pattern: /Northern\s+Mindanao/i, replacement: 'Northern Mindanao' },
    { pattern: /Davao/i, replacement: 'Davao Region' },
    { pattern: /SOCCSKSARGEN/i, replacement: 'SOCCSKSARGEN' },
    { pattern: /CARAGA/i, replacement: 'CARAGA' },
    { pattern: /BARMM/i, replacement: 'Bangsamoro' },
  ];

  for (const { pattern, group, replacement } of regionPatterns) {
    const match = text.match(pattern);
    if (match) {
      return replacement || match[group];
    }
  }

  return 'Nationwide'; // Default if no specific region is found
}

// Helper function to determine category from title and description
function determineCategory(title, description) {
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  
  if (lowerTitle.includes('typhoon') || lowerDesc.includes('typhoon') || 
      lowerTitle.includes('storm') || lowerDesc.includes('storm')) {
    return 'typhoon';
  } else if (lowerTitle.includes('flood') || lowerDesc.includes('flood')) {
    return 'flood';
  } else if (lowerTitle.includes('earthquake') || lowerDesc.includes('earthquake') || 
            lowerTitle.includes('seismic') || lowerDesc.includes('seismic')) {
    return 'earthquake';
  } else if (lowerTitle.includes('volcano') || lowerDesc.includes('volcano') || 
            lowerTitle.includes('eruption') || lowerDesc.includes('eruption')) {
    return 'volcano';
  }
  
  // Default to flood for rainfall advisories if no specific category is detected
  return 'flood';
}

// Function to store alerts in Supabase
async function storeAlerts(alerts) {
  if (!alerts || alerts.length === 0) {
    console.log('No alerts to store.');
    return;
  }

  console.log(`Storing ${alerts.length} alerts in Supabase...`);
  
  for (const alert of alerts) {
    // Check if alert already exists to prevent duplicates
    const { data: existingAlerts, error: selectError } = await supabase
      .from('disaster_alerts')
      .select('id')
      .eq('title', alert.title)
      .eq('source', alert.source)
      .eq('published_at', alert.published_at)
      .limit(1);
      
    if (selectError) {
      console.error('Error checking for existing alert:', selectError);
      continue;
    }
    
    // If alert doesn't exist, insert it
    if (!existingAlerts || existingAlerts.length === 0) {
      const { error: insertError } = await supabase
        .from('disaster_alerts')
        .insert([alert]);
        
      if (insertError) {
        console.error('Error inserting alert:', insertError);
      } else {
        console.log(`Alert stored: ${alert.title}`);
      }
    } else {
      console.log(`Alert already exists: ${alert.title}`);
    }
  }
}

// Main function to run the scraper
async function runScraper() {
  console.log('Starting disaster alert scraper...');
  
  try {
    // Scrape data from sources
    const pagasaAlerts = await scrapePAGASA();
    const phivolcsAlerts = await scrapePHIVOLCS();
    
    // Combine alerts
    const allAlerts = [...pagasaAlerts, ...phivolcsAlerts];
    
    // Store alerts in Supabase
    await storeAlerts(allAlerts);
    
    console.log('Scraper completed successfully!');
  } catch (error) {
    console.error('Error running scraper:', error);
  }
}

// Run the scraper once at startup
runScraper();

// Schedule the scraper to run at the interval specified in config
const minutes = Math.floor(config.scrapingInterval / (60 * 1000));
cron.schedule(`*/${minutes} * * * *`, () => {
  console.log(`Running scheduled scraper at ${new Date().toISOString()}...`);
  runScraper();
});

console.log(`Disaster alert scraper initialized and scheduled to run every ${minutes} minutes.`);
