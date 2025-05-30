const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const https = require('https');
// Use service-config.js which contains the service role key that can bypass RLS policies
const config = require('./service-config');

// Log which configuration is being used
console.log('Using service configuration with higher database privileges');

// Create axios instance with SSL certificate verification disabled
// This is needed for some government websites with problematic certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const axiosInstance = axios.create({ httpsAgent });

// Supabase configuration
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

console.log(`Scraper initialized with Supabase URL: ${config.supabaseUrl}`);
console.log(`Scraper will run every ${config.scrapingInterval / (60 * 1000)} minutes`);
console.log('Enhanced scraper: Now capturing all alert levels, including low-risk conditions');

// Function to scrape PAGASA website
async function scrapePAGASA() {
  try {
    console.log('Scraping PAGASA...');
    const response = await axiosInstance.get(config.sources.pagasa);
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
        severity: determineSeverity(title, description)
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
        severity: determineSeverity(title, description)
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
        severity: determineSeverity(title, description)
      });
    });
    
    // Extract general weather advisories (for low level alerts)
    $('.weather-advisory, .advisory, .weather-bulletin, .general-advisory').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Weather Advisory';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      // Skip if this is empty
      if (!description) return;
      
      alerts.push({
        source: 'PAGASA',
        title,
        description,
        category: determineCategory(title, description),
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.pagasa.dost.gov.ph/').href : null,
        severity: determineSeverity(title, description)
      });
    });
    
    // Extract regional forecasts for low-level weather conditions
    $('.forecast, .regional-forecast, .daily-forecast').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Regional Weather Forecast';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      // Skip if this is empty
      if (!description) return;
      
      alerts.push({
        source: 'PAGASA',
        title,
        description,
        category: 'weather',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.pagasa.dost.gov.ph/').href : null,
        severity: 'low' // Default to low for general forecasts
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
    const response = await axiosInstance.get(config.sources.phivolcs);
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
        severity: determineEarthquakeSeverity(description)
      });
    });

    // Extract volcano updates - all alert levels including 0 and 1
    $('.volcano-advisory, .volcano-bulletin, .volcano-alert').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim();
      const description = $(el).find('.advisory-content, .bulletin-content, .content, p').text().trim();
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
        severity: determineVolcanoSeverity(title, description)
      });
    });
    
    // Extract all volcano alert levels (including Level 0 and Level 1)
    $('.volcano-status, .alert-level, .volcano-monitoring').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Volcano Status Update';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      // Skip if this is empty
      if (!description) return;
      
      alerts.push({
        source: 'PHIVOLCS',
        title,
        description,
        category: 'volcano',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.phivolcs.dost.gov.ph/').href : null,
        severity: determineVolcanoSeverity(title, description)
      });
    });
    
    // Extract all earthquake information (even minor ones)
    $('.earthquake-info, .seismic-activity, .quake-report').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Earthquake Activity';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      // Skip if this is empty
      if (!description) return;
      
      alerts.push({
        source: 'PHIVOLCS',
        title,
        description,
        category: 'earthquake',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.phivolcs.dost.gov.ph/').href : null,
        severity: determineEarthquakeSeverity(description)
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
  } else if (lowerTitle.includes('rain') || lowerDesc.includes('rain') ||
            lowerTitle.includes('shower') || lowerDesc.includes('shower')) {
    return 'rainfall';
  } else if (lowerTitle.includes('landslide') || lowerDesc.includes('landslide')) {
    return 'landslide';
  } else if (lowerTitle.includes('cloudy') || lowerDesc.includes('cloudy') ||
            lowerTitle.includes('weather') || lowerDesc.includes('weather') ||
            lowerTitle.includes('forecast') || lowerDesc.includes('forecast')) {
    return 'weather';
  }
  
  // Default to weather for general advisories
  return 'weather';
}

// Helper function to determine severity from title and description
function determineSeverity(title, description) {
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  
  // Check for high severity keywords
  if (lowerTitle.includes('warning') || lowerDesc.includes('warning') ||
      lowerTitle.includes('severe') || lowerDesc.includes('severe') ||
      lowerTitle.includes('danger') || lowerDesc.includes('danger') ||
      lowerTitle.includes('evacuate') || lowerDesc.includes('evacuate') ||
      lowerTitle.includes('signal no. 3') || lowerDesc.includes('signal no. 3') ||
      lowerTitle.includes('signal no. 4') || lowerDesc.includes('signal no. 4') ||
      lowerTitle.includes('signal no. 5') || lowerDesc.includes('signal no. 5')) {
    return 'high';
  }
  
  // Check for medium severity keywords
  if (lowerTitle.includes('advisory') || lowerDesc.includes('advisory') ||
      lowerTitle.includes('alert') || lowerDesc.includes('alert') ||
      lowerTitle.includes('caution') || lowerDesc.includes('caution') ||
      lowerTitle.includes('moderate') || lowerDesc.includes('moderate') ||
      lowerTitle.includes('signal no. 1') || lowerDesc.includes('signal no. 1') ||
      lowerTitle.includes('signal no. 2') || lowerDesc.includes('signal no. 2')) {
    return 'medium';
  }
  
  // Everything else is low severity
  return 'low';
}

// Helper function to determine volcano severity from alert level
function determineVolcanoSeverity(title, description) {
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  
  // Try to extract alert level
  const alertLevelMatch = (lowerTitle + ' ' + lowerDesc).match(/alert level (\d+)/i);
  
  if (alertLevelMatch) {
    const level = parseInt(alertLevelMatch[1]);
    if (level >= 3) return 'high';
    if (level === 2) return 'medium';
    return 'low'; // For levels 0 and 1
  }
  
  // Check for keywords if no explicit level is found
  if (lowerTitle.includes('eruption') || lowerDesc.includes('eruption') ||
      lowerTitle.includes('evacuate') || lowerDesc.includes('evacuate') ||
      lowerTitle.includes('danger zone') || lowerDesc.includes('danger zone')) {
    return 'high';
  }
  
  if (lowerTitle.includes('increased activity') || lowerDesc.includes('increased activity') ||
      lowerTitle.includes('elevated') || lowerDesc.includes('elevated')) {
    return 'medium';
  }
  
  return 'low'; // Default for general updates or low-level unrest
}

// Helper function to determine earthquake severity
function determineEarthquakeSeverity(description) {
  const lowerDesc = description.toLowerCase();
  
  // Try to extract magnitude
  const magnitudeMatch = lowerDesc.match(/magnitude (\d+\.?\d*)/i);
  
  if (magnitudeMatch) {
    const magnitude = parseFloat(magnitudeMatch[1]);
    if (magnitude >= 6.0) return 'high';
    if (magnitude >= 4.0) return 'medium';
    return 'low'; // For magnitudes below 4.0
  }
  
  // Check for keywords if no explicit magnitude is found
  if (lowerDesc.includes('destructive') || lowerDesc.includes('major damage') ||
      lowerDesc.includes('casualties') || lowerDesc.includes('fatalities')) {
    return 'high';
  }
  
  if (lowerDesc.includes('felt') || lowerDesc.includes('minor damage')) {
    return 'medium';
  }
  
  return 'low'; // Default for minor or unspecified earthquakes
}

// Function to store alerts in Supabase
async function storeAlerts(alerts) {
  if (!alerts || alerts.length === 0) {
    console.log('No alerts to store.');
    return;
  }

  console.log(`Storing ${alerts.length} alerts in Supabase...`);
  
  for (const alert of alerts) {
    // Format date properly to avoid timezone issues
    if (alert.published_at instanceof Date) {
      // Convert to ISO string in a Postgres-compatible format
      alert.published_at = alert.published_at.toISOString();
    }
    
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

// Function to get sample alerts when scraping is not possible
async function getSampleAlerts() {
  console.log('Using sample alerts instead of scraping...');
  
  // Generate current date
  const now = new Date();
  
  return [
    {
      source: 'PAGASA',
      title: 'Weather Advisory: Cloudy skies in Zamboanga Peninsula',
      description: 'Cloudy skies with scattered rains and thunderstorms are expected due to the trough of a low-pressure area. This weather condition may lead to possible flash floods or landslides in areas prone to these hazards.',
      category: 'weather',
      region: 'Zamboanga Peninsula',
      published_at: now,
      link: 'https://www.pagasa.dost.gov.ph/weather',
      severity: 'low'
    },
    {
      source: 'PHIVOLCS',
      title: 'Volcano Advisory: Kanlaon Volcano Alert Level 3',
      description: 'Alert Level 3 (Increased Tendency Towards Hazardous Eruption) is maintained over Kanlaon Volcano. The public is reminded to remain vigilant and avoid entry into the 4-kilometer radius Permanent Danger Zone.',
      category: 'volcano',
      region: 'Western Visayas',
      published_at: now,
      link: 'https://www.phivolcs.dost.gov.ph/volcano-bulletin',
      severity: 'high'
    },
    {
      source: 'PHIVOLCS',
      title: 'Volcano Status: Taal Volcano Alert Level 1',
      description: 'Alert Level 1 (Low-Level Unrest) is maintained over Taal Volcano. The public is advised to avoid entry into the Taal Volcano Island as it remains a Permanent Danger Zone.',
      category: 'volcano',
      region: 'CALABARZON',
      published_at: now,
      link: 'https://www.phivolcs.dost.gov.ph/volcano-bulletin',
      severity: 'low'
    },
    {
      source: 'PHIVOLCS',
      title: 'Volcano Status: Mayon Volcano Alert Level 1',
      description: 'Alert Level 1 (Low-Level Unrest) is maintained over Mayon Volcano. The public is advised to avoid entry into the 6-kilometer radius Permanent Danger Zone.',
      category: 'volcano',
      region: 'Bicol Region',
      published_at: now,
      link: 'https://www.phivolcs.dost.gov.ph/volcano-bulletin',
      severity: 'low'
    },
    {
      source: 'PAGASA',
      title: 'Rainfall Advisory',
      description: 'Light to moderate rainshowers with possible occasional heavy rains are expected over Metro Manila and nearby provinces in the next 2 hours.',
      category: 'rainfall',
      region: 'Metro Manila',
      published_at: now,
      link: 'https://www.pagasa.dost.gov.ph/weather',
      severity: 'medium'
    }
  ];
}

// Main function to run the scraper
async function runScraper() {
  console.log('Starting disaster alert scraper...');
  
  try {
    let alerts = [];
    
    // Check if we should use sample alerts
    if (config.useSampleAlerts) {
      alerts = await getSampleAlerts();
    } else {
      // Scrape data from sources
      const pagasaAlerts = await scrapePAGASA();
      const phivolcsAlerts = await scrapePHIVOLCS();
      
      // Combine alerts from all sources
      alerts = [...pagasaAlerts, ...phivolcsAlerts];
    }
    
    // Store alerts in Supabase
    await storeAlerts(alerts);
    
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
