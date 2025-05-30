const { createClient } = require('@supabase/supabase-js');
const config = require('./service-config');

async function checkAlerts() {
  console.log('Connecting to Supabase...');
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);
  
  try {
    console.log('Fetching alerts count...');
    const { data, error, count } = await supabase
      .from('disaster_alerts')
      .select('*', { count: 'exact' });
    
    if (error) {
      console.error('Error fetching alerts:', error);
    } else {
      console.log(`Total alerts in database: ${count}`);
      
      if (data && data.length > 0) {
        console.log('\nRecent alerts:');
        // Show the most recent 5 alerts
        const recentAlerts = data.slice(0, 5);
        recentAlerts.forEach(alert => {
          console.log(`- ${alert.title} (${alert.source}) - ${alert.severity} risk`);
        });
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkAlerts();
