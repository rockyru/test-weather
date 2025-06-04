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

// Function to parse PAGASA API response (hypothetical structure)
function parsePAGASAApiResponse(apiData) {
  const alerts = [];
  if (apiData && Array.isArray(apiData.bulletins)) {
    apiData.bulletins.forEach(item => {
      const title = item.title || 'PAGASA Bulletin';
      const description = item.description || item.summary || '';
      const link = item.link || (item.id ? `https://www.pagasa.dost.gov.ph/bulletin/${item.id}` : null);
      const publishedAt = item.published_at ? new Date(item.published_at) : new Date();
      const category = determineCategory(title, description); // Reuse existing helper
      const region = item.area_affected ? item.area_affected.join(', ') : extractRegionFromText(description);
      const severity = item.severity_level ? item.severity_level.toLowerCase() : determineSeverity(title, description);

      if (description) { // Ensure there's a description
        alerts.push({
          source: 'PAGASA API',
          title,
          description,
          category,
          region,
          published_at: publishedAt,
          link,
          severity
        });
      }
    });
  }
  return alerts;
}

// Function to scrape PAGASA website (with API fallback)
async function scrapePAGASA() {
  let alerts = [];

  // Try PAGASA API first
  if (config.sources.pagasaApi) {
    try {
      console.log('Attempting to fetch data from PAGASA API...');
      const apiResponse = await axiosInstance.get(config.sources.pagasaApi);
      if (apiResponse.data) {
        alerts = parsePAGASAApiResponse(apiResponse.data);
        if (alerts.length > 0) {
          console.log(`Successfully fetched ${alerts.length} alerts from PAGASA API.`);
          return alerts; // Return API alerts if successful
        } else {
          console.log('PAGASA API returned no usable alerts. Falling back to HTML scraping.');
        }
      } else {
        console.log('PAGASA API did not return data. Falling back to HTML scraping.');
      }
    } catch (apiError) {
      console.error('Error fetching from PAGASA API:', apiError.message, '- Falling back to HTML scraping.');
    }
  }

  // Fallback to HTML scraping if API fails or returns no data
  try {
    console.log('Scraping PAGASA HTML website...');
    const response = await axiosInstance.get(config.sources.pagasa);
    const $ = cheerio.load(response.data);
    // Keep existing HTML scraping logic here
    // Extract typhoon warnings
    $('.typhoon-bulletin').each((i, el) => {
      const title = $(el).find('h3').text().trim();
      const description = $(el).find('.bulletin-content').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      alerts.push({
        source: 'PAGASA HTML', // Indicate source
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
        source: 'PAGASA HTML', // Indicate source
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
        source: 'PAGASA HTML', // Indicate source
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
        source: 'PAGASA HTML', // Indicate source
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
    const forecastTitles = new Set(); // Keep this local to HTML scraping part
    
    $('.forecast, .regional-forecast, .daily-forecast').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Regional Weather Forecast';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      if (!description || description.length < 15) {
        console.log(`Skipping HTML forecast with insufficient information: ${title}`);
        return;
      }
      
      const forecastKey = `${title}-${description.substring(0, 50)}`;
      if (forecastTitles.has(forecastKey)) {
        console.log(`Skipping duplicate HTML forecast: ${title}`);
        return;
      }
      forecastTitles.add(forecastKey);
      
      const severity = determineSeverity(title, description);
      
      alerts.push({
        source: 'PAGASA HTML', // Indicate source
        title,
        description,
        category: 'weather',
        region: extractRegionFromText(description) || 'Nationwide',
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.pagasa.dost.gov.ph/').href : null,
        severity: severity
      });
    });

    if (alerts.length > 0) {
        console.log(`Successfully scraped ${alerts.length} alerts from PAGASA HTML.`);
    } else {
        console.log('PAGASA HTML scraping yielded no alerts.');
    }
    return alerts;
  } catch (error) {
    console.error('Error scraping PAGASA HTML:', error);
    // If API also failed, and HTML scraping fails, return empty array
    return alerts.length > 0 ? alerts : [];
  }
}

// Function to parse PHIVOLCS API response (hypothetical structure)
function parsePHIVOLCSApiResponse(apiData) {
  const alerts = [];
  if (apiData && Array.isArray(apiData.events)) {
    apiData.events.forEach(event => {
      const title = event.title || (event.type === 'earthquake' ? 'PHIVOLCS Earthquake Event' : 'PHIVOLCS Volcano Event');
      const description = event.description || event.details || '';
      const link = event.link || (event.id ? `https://www.phivolcs.dost.gov.ph/event/${event.id}` : null);
      const publishedAt = event.timestamp ? new Date(event.timestamp) : new Date();
      const category = event.type === 'earthquake' ? 'earthquake' : (event.type === 'volcano' ? 'volcano' : determineCategory(title, description));
      const region = event.location || extractRegionFromText(description);
      let severity;
      if (category === 'earthquake') {
        severity = event.magnitude ? determineEarthquakeSeverity(`Magnitude ${event.magnitude}`) : determineEarthquakeSeverity(description);
      } else if (category === 'volcano') {
        severity = event.alert_level ? determineVolcanoSeverity(`Alert Level ${event.alert_level}`, description) : determineVolcanoSeverity(title, description);
      } else {
        severity = determineSeverity(title, description);
      }

      if (description) { // Ensure there's a description
        alerts.push({
          source: 'PHIVOLCS API',
          title,
          description,
          category,
          region,
          published_at: publishedAt,
          link,
          severity
        });
      }
    });
  }
  return alerts;
}

// Helper function to retry API requests (used for HTML scraping fallback)
async function retryRequest(url, maxRetries = 5) { // Increased retries to 5
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = 2000 * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} for ${url} after ${delayMs}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      if (attempt === 0) {
        return await axiosInstance.get(url);
      } else if (attempt === 1) {
        return await axiosInstance.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': '*/*'
          }
        });
      } else {
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
  let alerts = [];

  // Try PHIVOLCS API first
  if (config.sources.phivolcsApi) {
    try {
      console.log('Attempting to fetch data from PHIVOLCS API...');
      const apiResponse = await axiosInstance.get(config.sources.phivolcsApi);
      if (apiResponse.data) {
        alerts = parsePHIVOLCSApiResponse(apiResponse.data);
        if (alerts.length > 0) {
          console.log(`Successfully fetched ${alerts.length} alerts from PHIVOLCS API.`);
          return alerts; // Return API alerts if successful
        } else {
          console.log('PHIVOLCS API returned no usable alerts. Falling back to HTML scraping.');
        }
      } else {
        console.log('PHIVOLCS API did not return data. Falling back to HTML scraping.');
      }
    } catch (apiError) {
      console.error('Error fetching from PHIVOLCS API:', apiError.message, '- Falling back to HTML scraping.');
    }
  }

  // Fallback to HTML scraping
  try {
    console.log('Scraping PHIVOLCS HTML website...');
    const phivolcsEndpoints = [
      config.sources.phivolcs,
      'https://earthquake.phivolcs.dost.gov.ph/',
      'https://www.phivolcs.dost.gov.ph/index.php/earthquake/earthquake-information'
    ];
    
    let response = null;
    // let successfulEndpoint = null; // Not strictly needed if we just process the first success
    
    for (const endpoint of phivolcsEndpoints) {
      try {
        console.log(`Trying PHIVOLCS HTML endpoint: ${endpoint}`);
        response = await retryRequest(endpoint); // Uses the existing retry logic
        // successfulEndpoint = endpoint;
        console.log(`Successfully connected to PHIVOLCS HTML at: ${endpoint}`);
        break;
      } catch (error) {
        console.error(`Failed to connect to PHIVOLCS HTML at ${endpoint}: ${error.message}`);
      }
    }
    
    if (!response) {
      console.error('All PHIVOLCS HTML endpoints failed.');
      // If API also failed, and HTML scraping fails, return empty or placeholder
      return alerts.length > 0 ? alerts : [{
        source: 'PHIVOLCS System',
        title: 'PHIVOLCS Unavailable',
        description: 'Unable to connect to PHIVOLCS API or website. Please check sources directly.',
        category: 'system',
        region: 'Philippines',
        published_at: new Date(),
        link: 'https://www.phivolcs.dost.gov.ph/',
        severity: 'medium' // Or 'low', depending on desired behavior for system errors
      }];
    }
    
    const $ = cheerio.load(response.data);
    // Clear alerts array if API call was attempted but failed to populate it, to avoid mixing.
    // Or, decide if you want to merge. For now, HTML scraping will overwrite if API failed.
    alerts = [];

    // Extract earthquake bulletins
    $('.earthquake-bulletin').each((i, el) => {
      const title = $(el).find('h3').text().trim();
      const description = $(el).find('.bulletin-content').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      alerts.push({
        source: 'PHIVOLCS HTML', // Indicate source
        title,
        description,
        category: 'earthquake',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.phivolcs.dost.gov.ph/').href : null,
        severity: determineEarthquakeSeverity(description)
      });
    });

    // Extract volcano updates
    $('.volcano-advisory, .volcano-bulletin, .volcano-alert').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim();
      const description = $(el).find('.advisory-content, .bulletin-content, .content, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      alerts.push({
        source: 'PHIVOLCS HTML', // Indicate source
        title,
        description,
        category: 'volcano',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.phivolcs.dost.gov.ph/').href : null,
        severity: determineVolcanoSeverity(title, description)
      });
    });
    
    // Extract all volcano alert levels
    $('.volcano-status, .alert-level, .volcano-monitoring').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Volcano Status Update';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      if (!description) return;
      
      alerts.push({
        source: 'PHIVOLCS HTML', // Indicate source
        title,
        description,
        category: 'volcano',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.phivolcs.dost.gov.ph/').href : null,
        severity: determineVolcanoSeverity(title, description)
      });
    });
    
    // Extract all earthquake information
    $('.earthquake-info, .seismic-activity, .quake-report').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Earthquake Activity';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      if (!description) return;
      
      alerts.push({
        source: 'PHIVOLCS HTML', // Indicate source
        title,
        description,
        category: 'earthquake',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, 'https://www.phivolcs.dost.gov.ph/').href : null,
        severity: determineEarthquakeSeverity(description)
      });
    });
    
    if (alerts.length > 0) {
        console.log(`Successfully scraped ${alerts.length} alerts from PHIVOLCS HTML.`);
    } else {
        console.log('PHIVOLCS HTML scraping yielded no alerts.');
    }
    return alerts;
  } catch (error) {
    console.error('Error scraping PHIVOLCS HTML:', error);
    // If API also failed, and HTML scraping fails, return empty array or the placeholder from above
    return alerts.length > 0 ? alerts : [{
        source: 'PHIVOLCS System',
        title: 'PHIVOLCS Unavailable',
        description: 'Unable to connect to PHIVOLCS API or website. Please check sources directly.',
        category: 'system',
        region: 'Philippines',
        published_at: new Date(),
        link: 'https://www.phivolcs.dost.gov.ph/',
        severity: 'medium'
      }];
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
      lowerTitle.includes('signal no. 5') || lowerDesc.includes('signal no. 5') ||
      lowerTitle.includes('signal no. 4') || lowerDesc.includes('signal no. 4') ||
      lowerTitle.includes('signal no. 3') || lowerDesc.includes('signal no. 3')) {
    return 'high';
  }

  // Check for medium severity keywords
  if (lowerTitle.includes('advisory') || lowerDesc.includes('advisory') ||
      lowerTitle.includes('watch') || lowerDesc.includes('watch') ||
      lowerTitle.includes('signal no. 2') || lowerDesc.includes('signal no. 2') ||
      lowerTitle.includes('signal no. 1') || lowerDesc.includes('signal no. 1') ||
      lowerTitle.includes('moderate') || lowerDesc.includes('moderate') ||
      (lowerTitle.includes('heavy rain') && !lowerTitle.includes('warning')) ||
      (lowerDesc.includes('heavy rain') && !lowerDesc.includes('warning'))) {
    return 'medium';
  }
  
  // Default to low for other general information or minor alerts
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
      // Check if the exact alert (title, source, published_at) already exists
      const { data: existingAlerts, error: selectError } = await supabase
        .from('disaster_alerts')
        .select('id')
        .eq('title', alert.title.trim())
        .eq('source', alert.source)
        .eq('published_at', alert.published_at); // Exact timestamp match

      if (selectError) {
        console.error('Error checking for existing alert:', selectError);
        continue;
      }
      
      // If alert doesn't exist, insert it
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

// Function to delete old scraper logs
async function deleteOldScraperLogs() {
  try {
    // Calculate timestamp for 12 hours ago
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
    
    console.log(`Deleting scraper logs older than: ${twelveHoursAgo.toISOString()}`);
    
    // First count the records to be deleted
    const { data: logsToDelete, error: countError } = await supabase
      .from('scraper_logs')
      .select('id')
      .lt('timestamp', twelveHoursAgo.toISOString());
    
    if (countError) {
      console.error('Error counting old scraper logs:', countError);
      return;
    }
    
    const countToDelete = logsToDelete ? logsToDelete.length : 0;
    
    // Then delete the records
    const { error: deleteError } = await supabase
      .from('scraper_logs')
      .delete()
      .lt('timestamp', twelveHoursAgo.toISOString());
    
    if (deleteError) {
      console.error('Error deleting old scraper logs:', deleteError);
    } else {
      console.log(`Successfully deleted ${countToDelete} scraper logs older than 12 hours`);
    }
  } catch (error) {
    console.error('Unexpected error deleting old scraper logs:', error);
  }
}

// Function to run the scraper
async function runScraper() {
  try {
    // Delete old scraper logs
    await deleteOldScraperLogs();
    
    await logScraperStatus('starting', 'Starting disaster alert scraper...');
    
    let alerts = [];
    
    // Attempt live scraping
    await logScraperStatus('running', 'Attempting to scrape PAGASA...');
    const pagasaAlerts = await scrapePAGASA();
    
    await logScraperStatus('running', 'Attempting to scrape PHIVOLCS...');
    const phivolcsAlerts = await scrapePHIVOLCS();
    
    // Combine alerts from live scraping
    alerts = [...pagasaAlerts, ...phivolcsAlerts];
    
    if (alerts.length > 0) {
      await logScraperStatus('running', `Successfully found ${alerts.length} total alerts from live sources.`);
    } else {
      await logScraperStatus('running', 'Live scraping yielded 0 alerts. No data will be stored.');
    }
    
    // Store alerts in Supabase (only if alerts exist)
    if (alerts.length > 0) {
      await logScraperStatus('running', 'Storing alerts in database...');
      await storeAlerts(alerts);
      await logScraperStatus('completed', 'Scraper completed. Alerts processed and stored.');
    } else {
      await logScraperStatus('completed', 'Scraper completed. No alerts found to store.');
    }
    
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
