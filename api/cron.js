// Import required modules
const { runScraper } = require('../scraper/index');

// Vercel serverless function for cron job
module.exports = async (req, res) => {
  // Add authorization check for security
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Starting scheduled scraper via Vercel Cron Job');
    await runScraper();
    
    return res.status(200).json({ 
      success: true, 
      message: 'Scraper executed successfully' 
    });
  } catch (error) {
    console.error('Scraper error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
