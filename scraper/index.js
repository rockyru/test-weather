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

// Function to scrape PAGASA website (HTML Only)
async function scrapePAGASA() {
  const alerts = [];
  try {
    console.log('Scraping PAGASA HTML website for specific bulletins...');
    const response = await axiosInstance.get(config.sources.pagasa);
    const $ = cheerio.load(response.data);

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
        link: link ? new URL(link, config.sources.pagasa).href : null,
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
        link: link ? new URL(link, config.sources.pagasa).href : null,
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
        link: link ? new URL(link, config.sources.pagasa).href : null,
        severity: determineSeverity(title, description)
      });
    });
    
    // Extract general weather advisories (for low level alerts)
    $('.weather-advisory, .advisory, .weather-bulletin, .general-advisory').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Weather Advisory';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      if (!description) return;
      
      alerts.push({
        source: 'PAGASA',
        title,
        description,
        category: determineCategory(title, description),
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, config.sources.pagasa).href : null,
        severity: determineSeverity(title, description)
      });
    });
    
    // Extract regional forecasts for all weather conditions with sufficient information
    const forecastTitles = new Set();
    
    $('.forecast, .regional-forecast, .daily-forecast').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Regional Weather Forecast';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      if (!description || description.length < 15) {
        console.log(`Skipping PAGASA forecast with insufficient information: ${title}`);
        return;
      }
      
      const forecastKey = `${title}-${description.substring(0, 50)}`;
      if (forecastTitles.has(forecastKey)) {
        console.log(`Skipping duplicate PAGASA forecast: ${title}`);
        return;
      }
      forecastTitles.add(forecastKey);
      
      const severity = determineSeverity(title, description);
      
      alerts.push({
        source: 'PAGASA',
        title,
        description,
        category: 'weather', // This might be general, specific PAGASA forecasts
        region: extractRegionFromText(description) || 'Nationwide',
        published_at: publishedAt,
        link: link ? new URL(link, config.sources.pagasa).href : null,
        severity: severity
      });
    });

    if (alerts.length > 0) {
        console.log(`Successfully scraped ${alerts.length} alerts from PAGASA HTML.`);
    } else {
        console.log('PAGASA HTML scraping yielded no specific bulletins.');
    }
    return alerts;
  } catch (error) {
    console.error('Error scraping PAGASA HTML for specific bulletins:', error);
    return [];
  }
}

// Helper function to retry API requests (used for PHIVOLCS HTML scraping fallback)
async function retryRequest(url, maxRetries = 5) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = 2000 * Math.pow(2, attempt - 1);
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
          timeout: 20000
        });
      }
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt + 1} failed for ${url}:`, error.message);
    }
  }
  throw lastError;
}

// Function to scrape PHIVOLCS website (HTML Only)
async function scrapePHIVOLCS() {
  let alerts = [];
  try {
    console.log('Scraping PHIVOLCS HTML website for specific bulletins...');
    const phivolcsEndpoints = [
      config.sources.phivolcs,
      'https://earthquake.phivolcs.dost.gov.ph/',
      'https://www.phivolcs.dost.gov.ph/index.php/earthquake/earthquake-information'
      // Note: The earthquake info page might be redundant if USGS API is primary for quakes
    ];
    
    let response = null;
    
    for (const endpoint of phivolcsEndpoints) {
      try {
        console.log(`Trying PHIVOLCS HTML endpoint: ${endpoint}`);
        response = await retryRequest(endpoint);
        console.log(`Successfully connected to PHIVOLCS HTML at: ${endpoint}`);
        break;
      } catch (error) {
        console.error(`Failed to connect to PHIVOLCS HTML at ${endpoint}: ${error.message}`);
      }
    }
    
    if (!response) {
      console.error('All PHIVOLCS HTML endpoints failed.');
      return [{ // Placeholder if all HTML attempts fail
        source: 'PHIVOLCS System',
        title: 'PHIVOLCS Bulletins Unavailable',
        description: 'Unable to connect to PHIVOLCS website for specific bulletins. Volcano data might be missing.',
        category: 'system',
        region: 'Philippines',
        published_at: new Date(),
        link: config.sources.phivolcs,
        severity: 'medium'
      }];
    }
    
    const $ = cheerio.load(response.data);
    alerts = [];

    // Extract earthquake bulletins (Primarily for non-USGS covered or specific PHIVOLCS reports)
    // Consider if this is still needed if USGS is the primary earthquake source.
    // For now, keeping it for any PHIVOLCS specific earthquake bulletins.
    $('.earthquake-bulletin').each((i, el) => {
      const title = $(el).find('h3').text().trim();
      const description = $(el).find('.bulletin-content').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      alerts.push({
        source: 'PHIVOLCS',
        title,
        description,
        category: 'earthquake', // Could be PHIVOLCS specific quake report
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, config.sources.phivolcs).href : null,
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
        source: 'PHIVOLCS',
        title,
        description,
        category: 'volcano',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, config.sources.phivolcs).href : null,
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
        source: 'PHIVOLCS',
        title,
        description,
        category: 'volcano',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, config.sources.phivolcs).href : null,
        severity: determineVolcanoSeverity(title, description)
      });
    });
    
    // Extract all earthquake information (minor ones, or PHIVOLCS specific)
    // Again, consider redundancy with USGS.
    $('.earthquake-info, .seismic-activity, .quake-report').each((i, el) => {
      const title = $(el).find('h3, h4, .title').text().trim() || 'Earthquake Activity';
      const description = $(el).find('.content, .description, p').text().trim();
      const link = $(el).find('a').attr('href');
      const publishedAt = new Date();
      
      if (!description) return;
      
      alerts.push({
        source: 'PHIVOLCS',
        title,
        description,
        category: 'earthquake',
        region: extractRegionFromText(description),
        published_at: publishedAt,
        link: link ? new URL(link, config.sources.phivolcs).href : null,
        severity: determineEarthquakeSeverity(description)
      });
    });
    
    if (alerts.length > 0) {
        console.log(`Successfully scraped ${alerts.length} alerts from PHIVOLCS HTML.`);
    } else {
        console.log('PHIVOLCS HTML scraping yielded no specific bulletins.');
    }
    return alerts;
  } catch (error) {
    console.error('Error scraping PHIVOLCS HTML for specific bulletins:', error);
    return [{ // Fallback if all else fails in this function
        source: 'PHIVOLCS System',
        title: 'PHIVOLCS Bulletins Error',
        description: 'An error occurred while scraping PHIVOLCS website for specific bulletins.',
        category: 'system',
        region: 'Philippines',
        published_at: new Date(),
        link: config.sources.phivolcs,
        severity: 'medium'
      }];
  }
}

// Function to scrape USGS Earthquake API
async function scrapeUSGSEarthquakes() {
  const alerts = [];
  try {
    console.log('Scraping USGS Earthquake API...');
    // Get earthquakes from the last 24 hours, magnitude 2.5+ in the Philippines region
    // Philippines bounding box: approx 4.0,116.0 to 21.5,127.0 (lat,lon)
    // minlatitude, minlongitude, maxlatitude, maxlongitude
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Last 24 hours
    if (!config.sources || !config.sources.usgsApi) {
      console.error('USGS API URL not configured in config.sources.usgsApi. Skipping USGS scrape.');
      throw new Error('USGS API URL not configured.'); // Throw error to be caught by catch block
    }
    const usgsUrl = `${config.sources.usgsApi}?format=geojson&starttime=${startTime}&minmagnitude=2.5&minlatitude=4.0&minlongitude=116.0&maxlatitude=21.5&maxlongitude=127.0&eventtype=earthquake&orderby=time`;
    
    const response = await axiosInstance.get(usgsUrl);
    const data = response.data;

    if (data && data.features) {
      data.features.forEach(event => {
        const props = event.properties;
        const mag = props.mag;
        const place = props.place || 'Unknown location';
        const time = new Date(props.time);
        const url = props.url;
        const depth = event.geometry.coordinates[2]; // Depth in km

        // More detailed description
        let description = `Magnitude ${mag} earthquake reported ${place}. Depth: ${depth} km.`;
        if (props.tsunami) {
          description += ' Tsunami warning issued.';
        }
        if (props.felt) {
          description += ` Reported felt by ${props.felt} people.`;
        }
        
        alerts.push({
          source: 'USGS API',
          title: `M ${mag} Earthquake - ${place}`,
          description: description,
          category: 'earthquake',
          region: extractRegionFromText(place) || 'Philippines', // Attempt to extract more specific region
          published_at: time,
          link: url,
          severity: determineEarthquakeSeverity(`Magnitude ${mag} ${description}`) // Pass more info for severity
        });
      });
      console.log(`Successfully fetched ${alerts.length} earthquake alerts from USGS API.`);
    } else {
      console.log('No earthquake data found from USGS API for the specified parameters.');
    }
  } catch (error) {
    console.error('Error scraping USGS Earthquake API:', error.message);
    // Optionally, return a system alert if the API fails
    alerts.push({
        source: 'USGS API System',
        title: 'USGS Earthquake API Unavailable',
        description: `Failed to fetch data from USGS Earthquake API: ${error.message}`,
        category: 'system',
        region: 'Global/Philippines',
        published_at: new Date(),
        link: config.sources.usgsApi,
        severity: 'medium'
    });
  }
  return alerts;
}

// Function to scrape OpenWeatherMap API for general weather
async function scrapeOpenWeatherMap() {
  const alerts = [];
  // Correctly check for the API key at the root of config, and the URL under config.sources
  if (!config.openweathermapApiKey || !config.sources || !config.sources.openWeatherMapApi) {
    console.warn('OpenWeatherMap API key or base URL not configured correctly. Skipping OpenWeatherMap.');
    // Add a system alert to indicate configuration issue
    alerts.push({
        source: 'OpenWeatherMap System',
        title: 'OpenWeatherMap Configuration Error',
        description: 'OpenWeatherMap API key or base URL is missing in the configuration.',
        category: 'system',
        region: 'System',
        published_at: new Date(),
        link: null,
        severity: 'medium'
      });
    return alerts;
  }

  // Define target cities in the Philippines with their coordinates
  // Manila: 14.5995, 120.9842
  // Cebu City: 10.3157, 123.8854
  // Davao City: 7.1907, 125.4553
  const cities = [
    { name: 'Metro Manila', lat: 14.5995, lon: 120.9842 },
    { name: 'Cebu City', lat: 10.3157, lon: 123.8854 },
    { name: 'Davao City', lat: 7.1907, lon: 125.4553 },
    // Add more major cities/regions if needed
  ];

  console.log('Scraping OpenWeatherMap API for general weather...');

  for (const city of cities) {
    try {
      // Using One Call API 3.0 (requires subscription, but free tier allows some calls)
      // If using older free tier, might need /weather endpoint
      // For simplicity, let's assume /weather endpoint for current weather.
      // For forecast, you'd use /forecast
      const weatherUrl = `${config.sources.openWeatherMapApi}weather?lat=${city.lat}&lon=${city.lon}&appid=${config.openweathermapApiKey}&units=metric`;
      
      const response = await axiosInstance.get(weatherUrl);
      const data = response.data;

      if (data && data.weather && data.main) {
        const weatherDesc = data.weather[0].description;
        const temp = data.main.temp;
        const feelsLike = data.main.feels_like;
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;
        
        const title = `Weather in ${city.name}: ${weatherDesc}`;
        const description = `Current temperature: ${temp}°C (feels like ${feelsLike}°C). Humidity: ${humidity}%. Wind: ${windSpeed} m/s. ${data.weather[0].main}.`;
        const publishedAt = data.dt ? new Date(data.dt * 1000) : new Date(); // dt is UTC timestamp

        alerts.push({
          source: 'OpenWeatherMap API',
          title: title,
          description: description,
          category: 'weather',
          region: city.name,
          published_at: publishedAt,
          link: `https://openweathermap.org/city/${data.id}`, // Link to city page if available
          severity: determineSeverity(title, description) // General severity based on description
        });
      } else {
        console.warn(`No valid weather data from OpenWeatherMap for ${city.name}. Response:`, data);
      }
    } catch (error) {
      console.error(`Error scraping OpenWeatherMap for ${city.name}:`, error.message);
      // Optionally, add a system alert for this specific city failure
       alerts.push({
        source: 'OpenWeatherMap System',
        title: `OpenWeatherMap API Error for ${city.name}`,
        description: `Failed to fetch weather data for ${city.name}: ${error.message}`,
        category: 'system',
        region: city.name,
        published_at: new Date(),
        link: config.sources.openWeatherMapApi,
        severity: 'low'
      });
    }
  }
  if (alerts.filter(a => a.source === 'OpenWeatherMap API').length > 0) {
    console.log(`Successfully fetched ${alerts.filter(a => a.source === 'OpenWeatherMap API').length} weather updates from OpenWeatherMap API.`);
  }
  return alerts;
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
    await deleteOldScraperLogs();
    await logScraperStatus('starting', 'Starting disaster alert scraper run...');
    
    let allAlerts = [];
    
    // Scrape PAGASA HTML for specific bulletins
    await logScraperStatus('running', 'Attempting to scrape PAGASA HTML for bulletins...');
    const pagasaAlerts = await scrapePAGASA();
    if (pagasaAlerts.length > 0) {
      await logScraperStatus('running', `PAGASA HTML: Found ${pagasaAlerts.length} alerts.`);
      allAlerts = allAlerts.concat(pagasaAlerts);
    } else {
      await logScraperStatus('running', 'PAGASA HTML: No specific bulletins found.');
    }

    // Scrape PHIVOLCS HTML for specific bulletins (mainly volcano)
    await logScraperStatus('running', 'Attempting to scrape PHIVOLCS HTML for bulletins...');
    const phivolcsAlerts = await scrapePHIVOLCS();
     if (phivolcsAlerts.length > 0) {
      await logScraperStatus('running', `PHIVOLCS HTML: Found ${phivolcsAlerts.length} alerts.`);
      allAlerts = allAlerts.concat(phivolcsAlerts);
    } else {
      await logScraperStatus('running', 'PHIVOLCS HTML: No specific bulletins found.');
    }

    // Scrape USGS API for earthquakes
    await logScraperStatus('running', 'Attempting to fetch earthquake data from USGS API...');
    const usgsEarthquakeAlerts = await scrapeUSGSEarthquakes();
    if (usgsEarthquakeAlerts.length > 0) {
      // Filter out system alerts from USGS before counting actual earthquake alerts
      const actualUsgsAlerts = usgsEarthquakeAlerts.filter(a => a.source === 'USGS API');
      if (actualUsgsAlerts.length > 0) {
        await logScraperStatus('running', `USGS API: Found ${actualUsgsAlerts.length} earthquake alerts.`);
      } else if (usgsEarthquakeAlerts.some(a => a.source === 'USGS API System')) {
        // Log if only system error alerts were returned
         await logScraperStatus('error', 'USGS API: Call resulted in a system alert/error. Check details.'); // Changed to 'error'
      } else {
        await logScraperStatus('running', 'USGS API: No earthquake alerts found.');
      }
      allAlerts = allAlerts.concat(usgsEarthquakeAlerts); // Add all, including potential system error alerts
    } else { // Should not happen if scrapeUSGSEarthquakes always returns an array
      await logScraperStatus('running', 'USGS API: No alerts returned (empty array).');
    }

    // Scrape OpenWeatherMap API for general weather
    await logScraperStatus('running', 'Attempting to fetch general weather data from OpenWeatherMap API...');
    const openWeatherMapAlerts = await scrapeOpenWeatherMap();
    if (openWeatherMapAlerts.length > 0) {
      // Filter out system alerts from OpenWeatherMap
      const actualWeatherAlerts = openWeatherMapAlerts.filter(a => a.source === 'OpenWeatherMap API');
      if (actualWeatherAlerts.length > 0) {
         await logScraperStatus('running', `OpenWeatherMap API: Found ${actualWeatherAlerts.length} weather updates.`);
      } else if (openWeatherMapAlerts.some(a => a.source === 'OpenWeatherMap System')) {
        await logScraperStatus('error', 'OpenWeatherMap API: Call resulted in system alerts/errors. Check details.'); // Changed to 'error'
      } else {
        await logScraperStatus('running', 'OpenWeatherMap API: No weather updates found.');
      }
      allAlerts = allAlerts.concat(openWeatherMapAlerts); // Add all, including potential system error alerts
    } else {
      await logScraperStatus('running', 'OpenWeatherMap API: No weather updates returned (empty array).');
    }
    
    // Log total alerts found before storage
    if (allAlerts.length > 0) {
      // Filter out any system error messages before final count of actual disaster/weather alerts
      const actualDisasterAlerts = allAlerts.filter(a => !a.category || a.category !== 'system');
      await logScraperStatus('running', `Total actual alerts from all sources before storage: ${actualDisasterAlerts.length}. (Total items including system messages: ${allAlerts.length})`);
    } else {
      await logScraperStatus('running', 'All sources yielded 0 items. No data will be stored.');
    }
    
    // Store alerts in Supabase (only if alerts exist)
    // Filter out system messages again before storing, unless you want to store them.
    // For now, let's assume we only want to store actual alerts.
    const alertsToStore = allAlerts.filter(a => !a.category || a.category !== 'system');

    if (alertsToStore.length > 0) {
      await logScraperStatus('running', `Storing ${alertsToStore.length} combined actual alerts in database...`);
      await storeAlerts(alertsToStore); // storeAlerts already has its own logging for added/skipped
      await logScraperStatus('completed', 'Scraper run completed. Alerts processed and stored.');
    } else {
      await logScraperStatus('completed', 'Scraper run completed. No new actual alerts found to store.');
    }
    
  } catch (error) {
    console.error('Error running main scraper process:', error);
    await logScraperStatus('error', `Error in main scraper process: ${error.message}`);
  }
}

// Initialize the scraper and scheduler
async function initializeScraperAndScheduler() {
  const minutes = Math.floor(config.scrapingInterval / (60 * 1000));
  
  await logScraperStatus('starting', `Disaster alert scraper system initialized. Scheduled to run every ${minutes} minutes.`);
  console.log(`Disaster alert scraper system initialized. Scheduled to run every ${minutes} minutes.`);
  
  const scheduledTask = cron.schedule(`*/${minutes} * * * *`, () => {
    console.log(`Running scheduled scraper task at ${new Date().toISOString()}`);
    runScraper();
  });
  
  console.log('Running initial scraper task on startup...');
  runScraper(); // Run once at startup
}

// Start the scraper
if (require.main === module) {
  initializeScraperAndScheduler().catch(error => {
    console.error('Fatal error initializing scraper and scheduler:', error);
    // Attempt to log to DB if possible, though Supabase client might not be initialized
    // For now, just console log is fine as logScraperStatus might fail here.
    // await logScraperStatus('error', `Fatal error during initialization: ${error.message}`);
  });
}

// Export functions for Vercel API routes or manual triggering
module.exports = {
  runScraper,
  scrapePAGASA, // HTML specific bulletins
  scrapePHIVOLCS, // HTML specific bulletins
  scrapeUSGSEarthquakes, // USGS API
  scrapeOpenWeatherMap, // OpenWeatherMap API
  storeAlerts
};
