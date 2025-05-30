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
const axiosInstance = axios.create({ 
  httpsAgent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Referrer': 'https://www.google.com/' // Add referrer to help with website access
  },
  timeout: 15000, // Increased timeout to 15 seconds
  maxRedirects: 5 // Allow following redirects
});

// Add request interceptor for debugging
axiosInstance.interceptors.request.use(request => {
  console.log(`Making request to: ${request.url}`);
  return request;
});

// Supabase configuration
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

console.log(`Scraper initialized with Supabase URL: ${config.supabaseUrl}`);
console.log(`Scraper will run every ${config.scrapingInterval / (60 * 1000)} minutes`);
console.log('Enhanced scraper: Capturing all risk levels but excluding alerts with insufficient information');

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
    
    // Extract regional forecasts for all weather conditions with sufficient information
    // Store forecast dates to avoid duplicates with different dates
    const forecastTitles = new Set();
    
    $('.forecast, .regional-forecast, .daily-forecast').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Regional Weather Forecast';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      // Skip if description is empty or has insufficient information
      if (!description || description.length < 15) {
        console.log(`Skipping forecast with insufficient information: ${title}`);
        return;
      }
      
      // Create a unique key for this forecast based on title and description
      const forecastKey = `${title}-${description.substring(0, 50)}`;
      
      // Skip if we've already seen this forecast
      if (forecastTitles.has(forecastKey)) {
        console.log(`Skipping duplicate forecast: ${title}`);
        return;
      }
      
      // Add to our set of seen forecasts
      forecastTitles.add(forecastKey);
      
      // Determine proper severity - can be low, medium or high based on content
      const severity = determineSeverity(title, description);
      
      alerts.push({
        source: 'PAGASA',
        title,
        description,
        category: 'weather',
        region: extractRegionFromText(description) || 'Nationwide',
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.pagasa.dost.gov.ph/').href : null,
        severity: severity
      });
    });

    return alerts;
  } catch (error) {
    console.error('Error scraping PAGASA:', error);
    return [];
  }
}

// Function to scrape PHIVOLCS website
// Helper function to retry API requests
async function retryRequest(url, maxRetries = 5) { // Increased retries to 5
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add exponential backoff delay between retries
      if (attempt > 0) {
        const delayMs = 2000 * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} for ${url} after ${delayMs}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Try different approaches on subsequent attempts
      if (attempt === 0) {
        return await axiosInstance.get(url);
      } else if (attempt === 1) {
        // Try with different headers on second attempt
        return await axiosInstance.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': '*/*'
          }
        });
      } else {
        // Standard attempt with increased timeout
        return await axiosInstance.get(url, {
          timeout: 20000 // 20 seconds timeout on later attempts
        });
      }
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt + 1} failed for ${url}:`, error.message);
    }
  }
  throw lastError;
}

async function scrapePHIVOLCS() {
  try {
    console.log('Scraping PHIVOLCS...');
    
    // Try alternative PHIVOLCS endpoints if the main one fails
    const phivolcsEndpoints = [
      config.sources.phivolcs,
      'https://earthquake.phivolcs.dost.gov.ph/',
      'https://www.phivolcs.dost.gov.ph/index.php/earthquake/earthquake-information'
    ];
    
    let response = null;
    let successfulEndpoint = null;
    
    // Try each endpoint until one works
    for (const endpoint of phivolcsEndpoints) {
      try {
        console.log(`Trying PHIVOLCS endpoint: ${endpoint}`);
        response = await retryRequest(endpoint);
        successfulEndpoint = endpoint;
        console.log(`Successfully connected to PHIVOLCS at: ${endpoint}`);
        break;
      } catch (error) {
        console.error(`Failed to connect to PHIVOLCS at ${endpoint}: ${error.message}`);
      }
    }
    
    // If all endpoints failed, return placeholder data
    if (!response) {
      console.error('All PHIVOLCS endpoints failed');
      return [
        {
          source: 'PHIVOLCS',
          title: 'No Current Earthquake Alerts',
          description: 'Unable to connect to PHIVOLCS website. This is a placeholder alert.',
          category: 'earthquake',
          region: 'Philippines',
          published_at: new Date(),
          link: 'https://www.phivolcs.dost.gov.ph/',
          severity: 'low'
        }
      ];
    }
    
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
  if (!text) return 'Nationwide';
  
  // Comprehensive region patterns with official names, alternate names, and major provinces/cities
  const regionPatterns = [
    // NCR - National Capital Region
    { pattern: /\b(?:NCR|Metro\s*Manila|National\s*Capital\s*Region|Manila|Quezon\s*City|Makati|Pasig|Taguig|Parañaque|Pasay|Caloocan|Marikina|Muntinlupa|Las\s*Piñas|Malabon|Mandaluyong|Navotas|Valenzuela|San\s*Juan|Pateros)\b/i, replacement: 'Metro Manila' },
    
    // CAR - Cordillera Administrative Region
    { pattern: /\b(?:CAR|Cordillera|Baguio|Abra|Apayao|Benguet|Ifugao|Kalinga|Mountain\s*Province)\b/i, replacement: 'Cordillera Administrative Region' },
    
    // Region I - Ilocos Region
    { pattern: /\b(?:Region\s*[I1]|Ilocos|Ilocos\s*Norte|Ilocos\s*Sur|La\s*Union|Pangasinan|Vigan|Laoag|San\s*Fernando,\s*La\s*Union)\b/i, replacement: 'Ilocos Region' },
    
    // Region II - Cagayan Valley
    { pattern: /\b(?:Region\s*[II2]|Cagayan\s*Valley|Cagayan(?!\s+de\s+Oro)|Isabela|Nueva\s*Vizcaya|Quirino|Batanes|Tuguegarao)\b/i, replacement: 'Cagayan Valley' },
    
    // Region III - Central Luzon
    { pattern: /\b(?:Region\s*[III3]|Central\s*Luzon|Aurora|Bataan|Bulacan|Nueva\s*Ecija|Pampanga|Tarlac|Zambales|Angeles|Olongapo|San\s*Fernando,\s*Pampanga)\b/i, replacement: 'Central Luzon' },
    
    // Region IV-A - CALABARZON
    { pattern: /\b(?:Region\s*IV-?A|Region\s*4-?A|CALABARZON|Cavite|Laguna|Batangas|Rizal|Quezon(?!\s+City)|Lucena|Antipolo|Calamba|Batangas\s*City|Tagaytay)\b/i, replacement: 'CALABARZON' },
    
    // Region IV-B - MIMAROPA
    { pattern: /\b(?:Region\s*IV-?B|Region\s*4-?B|MIMAROPA|Occidental\s*Mindoro|Oriental\s*Mindoro|Marinduque|Romblon|Palawan|Puerto\s*Princesa|Calapan)\b/i, replacement: 'MIMAROPA' },
    
    // Region V - Bicol Region
    { pattern: /\b(?:Region\s*[V5]|Bicol|Albay|Camarines\s*Norte|Camarines\s*Sur|Catanduanes|Masbate|Sorsogon|Legazpi|Naga)\b/i, replacement: 'Bicol Region' },
    
    // Region VI - Western Visayas
    { pattern: /\b(?:Region\s*[VI6]|Western\s*Visayas|Aklan|Antique|Capiz|Guimaras|Iloilo|Negros\s*Occidental|Bacolod|Iloilo\s*City|Roxas)\b/i, replacement: 'Western Visayas' },
    
    // Region VII - Central Visayas
    { pattern: /\b(?:Region\s*[VII7]|Central\s*Visayas|Bohol|Cebu|Negros\s*Oriental|Siquijor|Cebu\s*City|Lapu-Lapu|Mandaue|Tagbilaran|Dumaguete)\b/i, replacement: 'Central Visayas' },
    
    // Region VIII - Eastern Visayas
    { pattern: /\b(?:Region\s*[VIII8]|Eastern\s*Visayas|Biliran|Eastern\s*Samar|Leyte|Northern\s*Samar|Samar|Southern\s*Leyte|Tacloban|Ormoc|Calbayog|Catbalogan)\b/i, replacement: 'Eastern Visayas' },
    
    // Region IX - Zamboanga Peninsula
    { pattern: /\b(?:Region\s*[IX9]|Zamboanga(?!\s+del\s+Sur|\s+del\s+Norte|\s+Sibugay)\s*Peninsula|Zamboanga\s*del\s*Norte|Zamboanga\s*del\s*Sur|Zamboanga\s*Sibugay|Isabela\s*City|Zamboanga\s*City|Dapitan|Dipolog|Pagadian)\b/i, replacement: 'Zamboanga Peninsula' },
    
    // Region X - Northern Mindanao
    { pattern: /\b(?:Region\s*[X10]|Northern\s*Mindanao|Bukidnon|Camiguin|Lanao\s*del\s*Norte|Misamis\s*Occidental|Misamis\s*Oriental|Cagayan\s*de\s*Oro|Iligan|Valencia)\b/i, replacement: 'Northern Mindanao' },
    
    // Region XI - Davao Region
    { pattern: /\b(?:Region\s*[XI11]|Davao(?!\s+Occidental|\s+Oriental|\s+del\s+Norte|\s+del\s+Sur|\s+de\s+Oro)\s*Region|Davao\s*del\s*Norte|Davao\s*del\s*Sur|Davao\s*Oriental|Davao\s*Occidental|Davao\s*de\s*Oro|Compostela\s*Valley|Davao\s*City|Panabo|Tagum|Digos|Mati)\b/i, replacement: 'Davao Region' },
    
    // Region XII - SOCCSKSARGEN
    { pattern: /\b(?:Region\s*[XII12]|SOCCSKSARGEN|South\s*Cotabato|Cotabato|Sultan\s*Kudarat|Sarangani|General\s*Santos|Koronadal|Kidapawan|Tacurong)\b/i, replacement: 'SOCCSKSARGEN' },
    
    // Region XIII - CARAGA
    { pattern: /\b(?:Region\s*[XIII13]|CARAGA|Agusan\s*del\s*Norte|Agusan\s*del\s*Sur|Dinagat\s*Islands|Surigao\s*del\s*Norte|Surigao\s*del\s*Sur|Butuan|Surigao\s*City|Tandag|Bislig)\b/i, replacement: 'CARAGA' },
    
    // BARMM - Bangsamoro Autonomous Region in Muslim Mindanao
    { pattern: /\b(?:BARMM|Bangsamoro|ARMM|Muslim\s*Mindanao|Basilan|Lanao\s*del\s*Sur|Maguindanao|Sulu|Tawi-Tawi|Cotabato\s*City|Marawi|Lamitan)\b/i, replacement: 'Bangsamoro' },
    
    // Handling Roman numerals for regions (I to XIII)
    { pattern: /Region\s+(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII)\b/i, group: 1 },
  ];

  // Enhancing search by checking for multiple regions and combining results
  let foundRegions = [];
  
  for (const { pattern, group, replacement } of regionPatterns) {
    const matches = text.match(new RegExp(pattern, 'gi'));
    if (matches) {
      foundRegions.push(replacement || matches[group]);
    }
  }
  
  // Remove duplicates and return
  const uniqueRegions = [...new Set(foundRegions)];
  
  if (uniqueRegions.length > 0) {
    // If multiple regions, join them or return the first one
    if (uniqueRegions.length > 3) {
      return 'Multiple Regions';
    } else if (uniqueRegions.length > 1) {
      return uniqueRegions.join(', ');
    } else {
      return uniqueRegions[0];
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
  
  // All other alerts default to medium severity - we no longer use 'low' severity
  // as per requirement to remove low risk alerts
  return 'medium';
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

  console.log(`Processing ${alerts.length} alerts for storage...`);
  
  // Filter out alerts with insufficient information
  const filteredAlerts = alerts.filter(alert => {
    // Check that description has enough content to be useful
    const hasInformation = alert.description && alert.description.length >= 15;
    
    if (!hasInformation) {
      console.log(`Filtering out alert with insufficient information: ${alert.title}`);
      return false;
    }
    
    return true;
  });
  
  // Log filtering statistics
  if (alerts.length !== filteredAlerts.length) {
    console.warn(`INFO: Filtered out ${alerts.length - filteredAlerts.length} alerts with insufficient information.`);
  }
  
  // If no alerts remain after filtering, exit early
  if (filteredAlerts.length === 0) {
    console.log('No alerts to store after filtering.');
    return;
  }
  
  // Create a map to deduplicate alerts by title/source/date (strictly ignoring time)
  const uniqueAlertMap = new Map();
  
  // First pass - create unique keys based ONLY on title, source, and date (no time component)
  for (const alert of filteredAlerts) {
    // Format date properly to avoid timezone issues
    if (alert.published_at instanceof Date) {
      // Keep original date object for sorting
      alert.originalDate = new Date(alert.published_at);
      
      // Convert to ISO string for storage
      alert.published_at = alert.published_at.toISOString();
    } else {
      // If already a string, parse it back to a date for comparison
      alert.originalDate = new Date(alert.published_at);
    }
    
    // Create a unique key using ONLY title, source, and date (explicitly without time component)
    const alertDate = new Date(alert.originalDate);
    // Format as YYYY-MM-DD to ensure consistency
    const dateString = `${alertDate.getFullYear()}-${(alertDate.getMonth() + 1).toString().padStart(2, '0')}-${alertDate.getDate().toString().padStart(2, '0')}`;
    const uniqueKey = `${alert.title.trim()}|${alert.source}|${dateString}`;
    
    console.log(`Generated unique key: ${uniqueKey} [Severity: ${alert.severity}]`);
    
    // Only keep the most recent alert for each unique key
    if (!uniqueAlertMap.has(uniqueKey) || 
        alert.originalDate > uniqueAlertMap.get(uniqueKey).originalDate) {
      uniqueAlertMap.set(uniqueKey, alert);
    }
  }
  
  // Convert the map back to an array
  const uniqueAlerts = Array.from(uniqueAlertMap.values());
  
  console.log(`After deduplication, storing ${uniqueAlerts.length} unique alerts in Supabase...`);
  
  let addedCount = 0;
  let skippedCount = 0;
  
  for (const alert of uniqueAlerts) {
    // Remove helper property before storage
    delete alert.originalDate;
    
    try {
      // Check if alert already exists in database with the SAME title and source on the SAME DAY
      const alertDate = new Date(alert.published_at);
      // Create date range for the entire day (midnight to 11:59:59 PM)
      const startOfDay = new Date(Date.UTC(alertDate.getFullYear(), alertDate.getMonth(), alertDate.getDate(), 0, 0, 0));
      const endOfDay = new Date(Date.UTC(alertDate.getFullYear(), alertDate.getMonth(), alertDate.getDate(), 23, 59, 59, 999));
      
      const { data: existingAlerts, error: selectError } = await supabase
        .from('disaster_alerts')
        .select('id, title, published_at')
        .eq('title', alert.title.trim())
        .eq('source', alert.source)
        .gte('published_at', startOfDay.toISOString())
        .lt('published_at', endOfDay.toISOString());
      
      if (selectError) {
        console.error('Error checking for existing alert:', selectError);
        continue;
      }
      
      // If alert doesn't exist in database for this day, insert it
      if (!existingAlerts || existingAlerts.length === 0) {
        console.log('Attempting to insert alert:', alert.title);
        console.log('Database connection:', config.supabaseUrl);
        
        const { data: insertData, error: insertError } = await supabase
          .from('disaster_alerts')
          .insert([alert])
          .select();
          
        if (insertError) {
          console.error('Error inserting alert:', insertError);
          console.error('Full error details:', JSON.stringify(insertError));
        } else {
          console.log(`Alert stored: ${alert.title} for ${new Date(alert.published_at).toLocaleDateString()} [Severity: ${alert.severity}]`);
          console.log('Insert response:', insertData);
          addedCount++;
        }
      } else {
        console.log(`Duplicate prevention: Alert already exists in database: ${alert.title} for ${new Date(alert.published_at).toLocaleDateString()}`);
        skippedCount++;
      }
    } catch (error) {
      console.error('Unexpected error during alert storage:', error);
    }
  }
  
  console.log(`Alerts storage summary: ${addedCount} new alerts added, ${skippedCount} duplicates skipped (alerts with insufficient information excluded)`);
}

// Function to get sample alerts when scraping is not possible
async function getSampleAlerts() {
  console.log('Using sample alerts instead of scraping...');
  
  // Generate current date for database
  const now = new Date();
  
  return [
    // Volcano Advisories
    {
      source: 'PHIVOLCS',
      title: 'Kanlaon Volcano Advisory',
      description: 'Seventy-two volcanic earthquakes recorded beneath the northern and northwestern flanks of Kanlaon Volcano.',
      category: 'volcano',
      region: 'Negros Island Region',
      published_at: new Date('2025-05-12T13:30:00+08:00'),
      link: 'https://www.phivolcs.dost.gov.ph/index.php/volcano-advisory-menu/31125-kanlaon-volcano-advisory-12-may-2025-1-30-pm',
      severity: 'medium',
      // Not using display_date field as it's causing schema issues
    },
    {
      source: 'PHIVOLCS',
      title: 'Kanlaon Volcano Eruption Bulletin',
      description: 'Moderately explosive eruption at 2:55 AM, generating a 4.5 km high plume.',
      category: 'volcano',
      region: 'Negros Island Region',
      published_at: new Date('2025-05-13T04:30:00+08:00'),
      link: 'https://www.phivolcs.dost.gov.ph/index.php/volcano-advisory-menu/31145-kanlaon-volcano-eruption-bulletin-13-may-2025-04-30-am',
      severity: 'high',
      // Not using display_date field as it's causing schema issues
    },
    {
      source: 'PHIVOLCS',
      title: 'Taal Volcano 24-Hour Observation Summary',
      description: 'Taal Volcano remains under Alert Level 1. Sulfur dioxide emission measured at 1,812 tonnes/day.',
      category: 'volcano',
      region: 'CALABARZON',
      published_at: new Date('2025-05-27T00:00:00+08:00'),
      link: 'https://www.phivolcs.dost.gov.ph/index.php/volcano-hazard/volcano-bulletin2/taal-volcano',
      severity: 'low',
      // Not using display_date field as it's causing schema issues
    },
    
    // Rainfall and Weather Advisories
    {
      source: 'PAGASA',
      title: 'Rainfall Advisory No. 2 - Visayas',
      description: 'Light to moderate to at times heavy rains affecting portions of Visayas, with possible flooding in low-lying areas.',
      category: 'rainfall',
      region: 'Eastern and Central Visayas',
      published_at: new Date('2025-05-28T05:00:00+08:00'),
      link: 'https://www.pagasa.dost.gov.ph/regional-forecast/visprsd',
      severity: 'medium',
      // Not using display_date field as it's causing schema issues
    },
    {
      source: 'PAGASA',
      title: 'Rainfall Advisory No. 4 - Southern Luzon',
      description: 'Rainfall has weakened; this is the final advisory for Southern Luzon regarding today\'s system.',
      category: 'rainfall',
      region: 'Southern Luzon',
      published_at: new Date('2025-05-28T14:00:00+08:00'),
      link: 'https://bagong.pagasa.dost.gov.ph/regional-forecast/southern-luzon',
      severity: 'low',
      // Not using display_date field as it's causing schema issues
    },
    {
      source: 'PAGASA',
      title: 'Weekly Weather Outlook',
      description: 'Scattered rains over Mindanao and parts of Visayas due to the Intertropical Convergence Zone (ITCZ).',
      category: 'weather',
      region: 'Nationwide',
      published_at: new Date('2025-05-23T00:00:00+08:00'),
      link: 'https://bagong.pagasa.dost.gov.ph/weather/weather-outlook-weekly',
      severity: 'medium',
      // Not using display_date field as it's causing schema issues
    },
    {
      source: 'PAGASA',
      title: 'Daily Rainfall and Temperature Report',
      description: 'Temperature and rainfall levels within normal range. No extreme anomalies recorded.',
      category: 'climate',
      region: 'Nationwide',
      published_at: new Date('2025-05-27T08:00:00+08:00'),
      link: 'https://www.pagasa.dost.gov.ph/climate/climate-monitoring',
      severity: 'low',
      // Not using display_date field as it's causing schema issues
    },
    {
      source: 'PAGASA',
      title: 'Seasonal Climate Outlook',
      description: 'Near-normal to above-normal rainfall conditions expected from June to August in most parts of the country.',
      category: 'climate',
      region: 'Nationwide',
      published_at: new Date('2025-05-29T00:00:00+08:00'),
      link: 'https://bagong.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast',
      severity: 'medium',
      // Not using display_date field as it's causing schema issues
    },
    {
      source: 'PAGASA',
      title: 'Thunderstorm Advisory No. 19 - NCR',
      description: 'Moderate to heavy rainshowers with lightning and strong winds expected over Metro Manila and nearby provinces.',
      category: 'rainfall',
      region: 'Metro Manila',
      published_at: new Date('2025-05-28T02:00:00+08:00'),
      link: 'https://www.pagasa.dost.gov.ph/regional-forecast/ncrprsd',
      severity: 'medium',
      // Not using display_date field as it's causing schema issues
    },
    {
      source: 'PAGASA',
      title: 'Weather Advisory No. 4 - ITCZ',
      description: 'Heavy rainfall outlook due to ITCZ, with potential impacts including widespread flooding and landslides.',
      category: 'weather',
      region: 'Nationwide',
      published_at: new Date('2025-05-23T05:00:00+08:00'),
      link: 'https://pubfiles.pagasa.dost.gov.ph/tamss/weather/advisory.pdf',
      severity: 'high',
      // Not using display_date field as it's causing schema issues
    },
    
    // Typhoon and Cyclone Advisories
    {
      source: 'PAGASA',
      title: 'Tropical Cyclone Threat Potential',
      description: 'No tropical cyclone-like vortex present inside the PAR; low chance of development in the coming week.',
      category: 'typhoon',
      region: 'Nationwide',
      published_at: new Date('2025-05-30T00:00:00+08:00'),
      link: 'https://pubfiles.pagasa.dost.gov.ph/pagasaweb/files/climate/tcthreat/TC_Threat_and_S2S_Forecast.pdf',
      severity: 'low',
      // Not using display_date field as it's causing schema issues
    },
    
    // Flood Advisories
    {
      source: 'PAGASA',
      title: 'Flood Advisory - Dam Water Level Update',
      description: 'Monitoring of reservoir water levels in major dams; some deviations from normal high water levels observed.',
      category: 'flood',
      region: 'Nationwide',
      published_at: new Date('2025-05-28T08:00:00+08:00'),
      link: 'https://www.pagasa.dost.gov.ph/flood',
      severity: 'medium',
      // Not using display_date field as it's causing schema issues
    },
    
    // Earthquake Advisories
    {
      source: 'PHIVOLCS',
      title: 'Earthquake Information No. 1',
      description: 'Magnitude 2.4 tectonic earthquake recorded 60 km southeast of Jose Abad Santos, Davao Occidental.',
      category: 'earthquake',
      region: 'Davao Region',
      published_at: new Date('2025-05-25T13:21:00+08:00'),
      link: 'https://earthquake.phivolcs.dost.gov.ph/2025_Earthquake_Information/May/2025_0525_0521_B1.html',
      severity: 'low',
      // Not using display_date field as it's causing schema issues
    },
    
    // Landslide Advisories
    {
      source: 'PAGASA',
      title: 'Northern Luzon Regional Forecast',
      description: 'Residents along mountain slopes advised of possible landslides, mudslides, rockslides, and flash floods.',
      category: 'landslide',
      region: 'Northern Luzon',
      published_at: new Date('2025-05-30T05:00:00+08:00'),
      link: 'https://bagong.pagasa.dost.gov.ph/regional-forecast/nlprsd',
      severity: 'medium',
      // Not using display_date field as it's causing schema issues
    },
    
    // General Weather Forecasts
    {
      source: 'PAGASA',
      title: 'Extended Weather Outlook for Selected Cities',
      description: 'Forecast for selected Philippine cities indicating generally fair weather with isolated rain showers.',
      category: 'weather',
      region: 'Nationwide',
      published_at: new Date('2025-05-30T00:00:00+08:00'),
      link: 'https://www.pagasa.dost.gov.ph/weather/weather-outlook-selected-philippine-cities',
      severity: 'low',
      // Not using display_date field as it's causing schema issues
    }
  ];
}

// Function to log scraper status to Supabase
async function logScraperStatus(status, message) {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${status.toUpperCase()}] ${message}`);
    
    const { error } = await supabase
      .from('scraper_logs')
      .insert([{
        timestamp,
        status,
        message
      }]);
      
    if (error) {
      console.error('Error logging scraper status:', error);
    }
  } catch (error) {
    console.error('Unexpected error logging scraper status:', error);
  }
}

// Function to run the scraper
async function runScraper() {
  try {
    await logScraperStatus('starting', 'Starting disaster alert scraper...');
    
    let alerts = [];
    
    // Check if we should use sample alerts
    if (config.useSampleAlerts) {
      await logScraperStatus('running', 'Using sample alerts instead of scraping...');
      alerts = await getSampleAlerts();
    } else {
      // Scrape PAGASA
      await logScraperStatus('running', 'Scraping PAGASA...');
      const pagasaAlerts = await scrapePAGASA();
      
      // Scrape PHIVOLCS
      await logScraperStatus('running', 'Scraping PHIVOLCS...');
      const phivolcsAlerts = await scrapePHIVOLCS();
      
      // Combine alerts from all sources
      alerts = [...pagasaAlerts, ...phivolcsAlerts];
      await logScraperStatus('running', `Found ${alerts.length} total alerts from all sources`);
    }
    
    // Store alerts in Supabase
    await logScraperStatus('running', 'Storing alerts in database...');
    await storeAlerts(alerts);
    
    await logScraperStatus('completed', 'Scraper completed successfully!');
  } catch (error) {
    console.error('Error running scraper:', error);
    await logScraperStatus('error', `Error running scraper: ${error.message}`);
  }
}

// Initialize the scraper and scheduler
async function initializeScraperAndScheduler() {
  const minutes = Math.floor(config.scrapingInterval / (60 * 1000));
  
  // Log initialization status
  await logScraperStatus('starting', `Disaster alert scraper initialized and scheduled to run every ${minutes} minutes.`);
  console.log(`Disaster alert scraper initialized and scheduled to run every ${minutes} minutes.`);
  
  // Schedule the scraper to run at the interval specified in config
  const scheduledTask = cron.schedule(`*/${minutes} * * * *`, () => {
    console.log(`Running scheduled scraper at ${new Date().toISOString()}`);
    runScraper();
  });
  
  // Run the scraper once at startup
  runScraper();
}

// Start the scraper
// Only run initialization if called directly, not when imported as a module
if (require.main === module) {
  initializeScraperAndScheduler().catch(error => {
    console.error('Error initializing scraper:', error);
  });
}

// Export functions for Vercel API routes
module.exports = {
  runScraper,
  scrapePAGASA,
  scrapePHIVOLCS,
  storeAlerts
};
