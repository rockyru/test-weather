import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-main">
          <div className="footer-logo">
            <svg 
              className="footer-logo-icon" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            <span className="footer-logo-text">Disaster Alert Aggregator PH</span>
          </div>
          
          <p className="footer-description">
            Aggregating real-time disaster information from official Philippine government sources
            to help keep communities informed and prepared.
          </p>
        </div>
        
        <div className="footer-sections">
          <div className="footer-section">
            <h4 className="footer-section-title">Data Sources</h4>
            <div className="footer-links">
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
          
          <div className="footer-section">
            <h4 className="footer-section-title">Disaster Types</h4>
            <div className="footer-links">
              <span className="footer-text">Typhoons</span>
              <span className="footer-text">Earthquakes</span>
              <span className="footer-text">Floods</span>
              <span className="footer-text">Volcanic Activity</span>
              <span className="footer-text">Landslides</span>
              <span className="footer-text">Rainfall</span>
            </div>
          </div>
          
          <div className="footer-section">
            <h4 className="footer-section-title">Information</h4>
            <div className="footer-links">
              <p className="footer-text">
                <strong>Updates:</strong> Every 15 minutes
              </p>
              <p className="footer-text">
                <strong>Time Zone:</strong> Philippine Standard Time (UTC+8)
              </p>
              <p className="footer-text">
                <strong>Coverage:</strong> Nationwide
              </p>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p className="footer-copyright">
            &copy; {new Date().getFullYear()} Disaster Alert Aggregator PH. 
            This service is for informational purposes only.
          </p>
          <p className="footer-disclaimer">
            For official emergency information and instructions, please refer to the original sources.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
