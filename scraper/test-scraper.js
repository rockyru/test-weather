const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config');
const { scrapePAGASA } = require('.');

// Function to analyze website structure and find relevant alert elements
async function analyzeWebsite(url, websiteName) {
  try {
    console.log(`\n\n======= ANALYZING ${websiteName} WEBSITE STRUCTURE =======`);
    console.log(`URL: ${url}`);
    
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    console.log('\n----- ANALYZING HTML ELEMENTS -----');
    
    // Check for standard content elements
    const elements = {
      'Headers (h1, h2, h3)': $('h1, h2, h3').length,
      'Paragraphs': $('p').length,
      'Divs with class': $('div[class]').length,
      'Links': $('a').length,
      'Tables': $('table').length,
      'Lists': $('ul, ol').length
    };
    
    for (const [type, count] of Object.entries(elements)) {
      console.log(`${type}: ${count} found`);
    }

    // Scan for common alert-related classes
    console.log('\n----- SCANNING FOR POTENTIAL ALERT ELEMENTS -----');
    
    // Find elements with content related to alerts
    const contentKeywords = ['typhoon', 'weather', 'rain', 'storm', 'earthquake', 'volcano', 'flood', 'warning', 'advisory'];
    
    let potentialAlertElements = [];
    
    // Look for elements containing these keywords
    contentKeywords.forEach(keyword => {
      $('div, section, article').each((i, el) => {
        const text = $(el).text().toLowerCase();
        if (text.includes(keyword)) {
          const elementInfo = {
            type: el.name,
            id: $(el).attr('id') || '',
            classes: $(el).attr('class') || '',
            contentPreview: text.substring(0, 100).trim() + '...',
            keyword
          };
          
          // Only add if not already found
          if (!potentialAlertElements.some(e => 
              e.type === elementInfo.type && 
              e.id === elementInfo.id && 
              e.classes === elementInfo.classes)) {
            potentialAlertElements.push(elementInfo);
          }
        }
      });
    });
    
    // Display found elements
    console.log(`Found ${potentialAlertElements.length} potential alert elements`);
    potentialAlertElements.forEach((el, i) => {
      console.log(`\n[${i+1}] ${el.type}${el.id ? '#'+el.id : ''}${el.classes ? '.'+el.classes.replace(/\s+/g, '.') : ''}`);
      console.log(`    Keyword: "${el.keyword}"`);
      console.log(`    Content: ${el.contentPreview}`);
    });
    
    return potentialAlertElements;
  } catch (error) {
    console.error(`Error analyzing ${websiteName}:`, error.message);
    return [];
  }
}

// Function to extract data based on the analysis
async function extractAlerts(url, websiteName, elementSelectors) {
  try {
    console.log(`\n\n======= EXTRACTING ALERTS FROM ${websiteName} =======`);
    
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const alerts = [];
    
    elementSelectors.forEach((selector, i) => {
      console.log(`\nTrying selector: ${selector}`);
      
      $(selector).each((i, el) => {
        // Extract the relevant information
        const title = $(el).find('h1, h2, h3, h4, .title, .heading').first().text().trim() || 
                      `${websiteName} Alert`;
        
        const description = $(el).text().trim().replace(/\s+/g, ' ');
        
        // Skip if description is too short (likely not an alert)
        if (description.length < 20) return;
        
        const link = $(el).find('a').attr('href') || '';
        
        // Determine category and severity
        const category = determineCategory(title, description);
        const severity = determineSeverity(title, description);
        const region = extractRegionFromText(description);
        
        alerts.push({
          source: websiteName,
          title,
          description: description.substring(0, 500), // Limit description length
          category,
          region,
          severity,
          published_at: new Date().toISOString(),
          link: link ? new URL(link, url).href : null
        });
        
        console.log(`Found alert: ${title} (${category}, ${severity})`);
      });
    });
    
    console.log(`\nExtracted ${alerts.length} alerts from ${websiteName}`);
    return alerts;
  } catch (error) {
    console.error(`Error extracting from ${websiteName}:`, error.message);
    return [];
  }
}

// Helper functions - simplified versions from the main scraper
function determineCategory(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  
  if (text.includes('typhoon') || text.includes('storm')) return 'typhoon';
  if (text.includes('flood')) return 'flood';
  if (text.includes('earthquake') || text.includes('seismic')) return 'earthquake';
  if (text.includes('volcano') || text.includes('eruption')) return 'volcano';
  if (text.includes('rain') || text.includes('rainfall')) return 'rainfall';
  if (text.includes('landslide')) return 'landslide';
  
  return 'weather'; // Default
}

function determineSeverity(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  
  if (text.includes('warning') || text.includes('severe') || 
      text.includes('danger') || text.includes('evacuate')) {
    return 'high';
  }
  
  if (text.includes('advisory') || text.includes('alert') || 
      text.includes('caution') || text.includes('moderate')) {
    return 'medium';
  }
  
  return 'low';
}

function extractRegionFromText(text) {
  const regions = [
    'Metro Manila', 'CALABARZON', 'MIMAROPA', 'Cordillera', 'Ilocos', 
    'Cagayan', 'Central Luzon', 'Bicol', 'Western Visayas', 'Central Visayas', 
    'Eastern Visayas', 'Zamboanga', 'Northern Mindanao', 'Davao', 
    'SOCCSKSARGEN', 'CARAGA', 'BARMM', 'Bangsamoro'
  ];
  
  for (const region of regions) {
    if (text.includes(region)) {
      return region;
    }
  }
  
  return 'Nationwide';
}


async function scrapePAGASA() {
  try {
    console.log('Scraping PAGASA...');
    const response = await axios.get(config.sources.pagasa);
    const $ = cheerio.load(response.data);
    const alerts = [];

    // Use these selectors (based on actual website structure)
    const selectors = JSON.parse(JSON.stringify(pagasaSelectors.slice(0, 5)));
    
    selectors.forEach(selector => {
      $(selector).each((i, el) => {
        const title = $(el).find('h1, h2, h3, h4, .title, .heading').first().text().trim() || 'Weather Advisory';
        const description = $(el).text().trim().replace(/\\s+/g, ' ');
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
    });

    return alerts;
  } catch (error) {
    console.error('Error scraping PAGASA:', error);
    return [];
  }
}

async function scrapePHIVOLCS() {
  try {
    console.log('Scraping PHIVOLCS...');
    const response = await axios.get(config.sources.phivolcs);
    const $ = cheerio.load(response.data);
    const alerts = [];

    // Use these selectors (based on actual website structure)
    const selectors = JSON.parse(JSON.stringify(phivolcsSelectors.slice(0, 5)));
    
    selectors.forEach(selector => {
      $(selector).each((i, el) => {
        const title = $(el).find('h1, h2, h3, h4, .title, .heading').first().text().trim() || 'Seismic Update';
        const description = $(el).text().trim().replace(/\\s+/g, ' ');
        const link = $(el).find('a').attr('href');
        const publishedAt = new Date();
        
        alerts.push({
          source: 'PHIVOLCS',
          title,
          description,
          category: determineCategory(title, description),
          region: extractRegionFromText(description),
          published_at: publishedAt,
          link: link ? new URL(link, 'https://www.phivolcs.dost.gov.ph/').href : null,
          severity: determineCategory(title, description) === 'volcano' ? 
                    determineVolcanoSeverity(title, description) : 
                    determineEarthquakeSeverity(description)
        });
      });
    });

    return alerts;
  } catch (error) {
    console.error('Error scraping PHIVOLCS:', error);
    return [];
  }
}

  

async function insertTestData() {
  const testAlerts = [
    {
      source: 'PAGASA',
      title: 'Weather Advisory: Cloudy skies in Zamboanga Peninsula',
      description: 'Cloudy skies with scattered rains and thunderstorms are expected due to the trough of a low-pressure area. This weather condition may lead to possible flash floods or landslides in areas prone to these hazards.',
      category: 'weather',
      region: 'Zamboanga Peninsula',
      published_at: new Date().toISOString(),
      link: 'https://www.pagasa.dost.gov.ph/weather',
      severity: 'low'
    },
    {
      source: 'PHIVOLCS',
      title: 'Volcano Advisory: Kanlaon Volcano Alert Level 3',
      description: 'Alert Level 3 (Increased Tendency Towards Hazardous Eruption) is maintained over Kanlaon Volcano. The public is reminded to remain vigilant and avoid entry into the 4-kilometer radius Permanent Danger Zone.',
      category: 'volcano',
      region: 'Western Visayas',
      published_at: new Date().toISOString(),
      link: 'https://www.phivolcs.dost.gov.ph/volcano-bulletin',
      severity: 'high'
    },
    {
      source: 'PHIVOLCS',
      title: 'Volcano Status: Taal Volcano Alert Level 1',
      description: 'Alert Level 1 (Low-Level Unrest) is maintained over Taal Volcano. The public is advised to avoid entry into the Taal Volcano Island as it remains a Permanent Danger Zone.',
      category: 'volcano',
      region: 'CALABARZON',
      published_at: new Date().toISOString(),
      link: 'https://www.phivolcs.dost.gov.ph/volcano-bulletin',
      severity: 'low'
    },
    {
      source: 'PAGASA',
      title: 'Rainfall Advisory',
      description: 'Light to moderate rainshowers with possible occasional heavy rains are expected over Metro Manila and nearby provinces in the next 2 hours.',
      category: 'rainfall',
      region: 'Metro Manila',
      published_at: new Date().toISOString(),
      link: 'https://www.pagasa.dost.gov.ph/weather',
      severity: 'medium'
    }
  ];
  
  for (const alert of testAlerts) {
    const { data, error } = await supabase
      .from('disaster_alerts')
      .insert([alert]);
      
    if (error) {
      console.error('Error inserting test data:', error);
    } else {
      console.log('Test alert inserted successfully:', alert.title);
    }
  }
}

// Call this function to populate your database with test data
// await insertTestData();


// Run the test

// testScraper();

// scrapePHIVOLCS()
// scrapePAGASA()

