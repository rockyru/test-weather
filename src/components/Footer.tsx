import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-info">
            <h3 className="footer-title">Disaster Alert Aggregator PH</h3>
            <p className="footer-subtitle">
              Aggregating disaster information from official Philippine government sources
            </p>
          </div>
          
          <div className="footer-links">
            <div>
              <h4 className="footer-links-title">Data Sources:</h4>
              <div className="footer-links-group">
                <a 
                  href="https://www.pagasa.dost.gov.ph/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  PAGASA
                </a>
                <a 
                  href="https://www.phivolcs.dost.gov.ph/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  PHIVOLCS
                </a>
              </div>
            </div>
            
            <p className="footer-note">
              All timestamps are in Philippine Standard Time (UTC+8)
            </p>
          </div>
        </div>
        
        <div className="footer-copyright">
          <p>
            &copy; {new Date().getFullYear()} Disaster Alert Aggregator PH. 
            This service is for informational purposes only.
          </p>
          <p>
            For official emergency information, please refer to the original sources.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
