# Disaster Alert Scraper - Usage Guide

This guide explains how to test and troubleshoot the scraper for the Disaster Alert Aggregator PH.

## Quick Start

```bash
# Navigate to the scraper directory
cd scraper

# Install dependencies
npm install

# Run the scraper
node index.js
```

## Troubleshooting

If the scraper isn't collecting data properly, here are steps to diagnose and fix the issues:

### 1. Check Website Structure

The scraper uses CSS selectors to find elements on the PAGASA and PHIVOLCS websites. If these websites change their structure, the scraper will need to be updated.

To inspect the current structure:

```javascript
// Add this code to the top of your scraping functions to see the actual HTML
const html = await axios.get(config.sources.pagasa);
console.log(html.data);
// Do the same for PHIVOLCS
```

### 2. Update CSS Selectors

Based on the actual website structure, you may need to update the CSS selectors in `index.js`. The current selectors are:

- PAGASA:
  - `.typhoon-bulletin`
  - `.flood-bulletin`
  - `.rainfall-advisory`
  - `.weather-advisory, .advisory, .weather-bulletin, .general-advisory`
  - `.forecast, .regional-forecast, .daily-forecast`

- PHIVOLCS:
  - `.earthquake-bulletin`
  - `.volcano-advisory, .volcano-bulletin, .volcano-alert`
  - `.volcano-status, .alert-level, .volcano-monitoring`
  - `.earthquake-info, .seismic-activity, .quake-report`

### 3. Test with Sample Data

If direct scraping is challenging, you can test with sample data:

```javascript
// Add this to the top of index.js to test with sample data
const sampleAlerts = [
  {
    source: 'PAGASA',
    title: 'Weather Advisory: Cloudy skies in Zamboanga Peninsula',
    description: 'Cloudy skies with scattered rains and thunderstorms are expected due to the trough of a low-pressure area.',
    category: 'weather',
    region: 'Zamboanga Peninsula',
    published_at: new Date(),
    link: 'https://www.pagasa.dost.gov.ph/weather',
    severity: 'low'
  },
  // Add more sample alerts...
];

// Then use this instead of the actual scraping functions
async function testWithSampleData() {
  return sampleAlerts;
}

// Replace the actual scraping functions in runScraper()
// const pagasaAlerts = await scrapePAGASA();
// const phivolcsAlerts = await scrapePHIVOLCS();
// with:
// const alerts = await testWithSampleData();
```

### 4. Enable Debug Logging

Add more detailed logging to see what's happening:

```javascript
// Add this near the top of the file
const DEBUG = true;

// Then add debug logs throughout
function debug(message, data) {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  }
}

// Use it in your scraping functions
debug('Attempting to scrape PAGASA', { url: config.sources.pagasa });
```

### 5. Using with a Proxy

If you're experiencing network issues or website blocking:

```bash
# Install proxy support
npm install https-proxy-agent

# Then modify axios requests in index.js
const { HttpsProxyAgent } = require('https-proxy-agent');
const agent = new HttpsProxyAgent('http://localhost:3000');

// Then use the agent in axios calls
const response = await axios.get(config.sources.pagasa, { httpsAgent: agent });
```

## Common Issues and Solutions

1. **Empty Results**: Check if the CSS selectors match the current website structure
2. **Network Errors**: Ensure you have internet connectivity; consider using a proxy
3. **Rate Limiting**: Add delays between requests if you're being rate-limited
4. **Data Structure Changes**: Update the extraction logic if websites change their format

## Testing the Database Connection

To verify your Supabase connection is working:

```javascript
// Add this to test Supabase connection
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('disaster_alerts').select('count(*)');
    if (error) throw error;
    console.log('Supabase connection successful!', data);
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
}

// Call it at the start of your script
await testSupabaseConnection();
```

## Manually Inserting Test Data

If scraping isn't working but you want to test the rest of the application:

```javascript
// Add this function to manually insert test data
async function insertTestData() {
  const testAlert = {
    source: 'PAGASA',
    title: 'Test Alert',
    description: 'This is a test alert to verify database connectivity',
    category: 'weather',
    region: 'Metro Manila',
    published_at: new Date().toISOString(),
    severity: 'low',
    link: 'https://www.pagasa.dost.gov.ph/'
  };
  
  const { data, error } = await supabase
    .from('disaster_alerts')
    .insert([testAlert]);
    
  if (error) {
    console.error('Error inserting test data:', error);
  } else {
    console.log('Test data inserted successfully:', data);
  }
}

// Call this function to insert test data
// await insertTestData();
```
