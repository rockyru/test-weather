import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-sections">
          <div className="footer-section">
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
              Real-time disaster alerts from official Philippine government sources.
            </p>
          </div>
          
          <div className="footer-section compact">
            <h4 className="footer-section-title">Sources & Types</h4>
            <div className="footer-links-group">
              <a href="https://www.pagasa.dost.gov.ph/" target="_blank" rel="noopener noreferrer" className="footer-link">PAGASA </a>

              <a href="https://www.phivolcs.dost.gov.ph/" target="_blank" rel="noopener noreferrer" className="footer-link">PHIVOLCS </a>
              
              <a href="https://ndrrmc.gov.ph/" target="_blank" rel="noopener noreferrer" className="footer-link">NDRRMC</a>
            </div>
            <div className="footer-links-group">
              <span className="footer-text small">Typhoons </span>
              <span className="footer-text small">Earthquakes </span>
              <span className="footer-text small">Floods </span> <br />
              <span className="footer-text small">Volcanic </span>
              <span className="footer-text small">Landslides</span>
            </div>
          </div>
          
          <div className="footer-section compact">
            <h4 className="footer-section-title">Emergency Preparedness</h4>
            <div className="footer-info">
              <p className="footer-text small">
                <strong>Emergency Hotline:</strong> 911
              </p>
              <p className="footer-text small">
                <strong>Red Cross:</strong> 143 or (02) 8527-8385
              </p>
              <p className="footer-text small">
                <a href="https://ndrrmc.gov.ph/attachments/article/3277/TNFF_Infographics.pdf" target="_blank" rel="noopener noreferrer" className="footer-link">Disaster Preparedness Guide</a>
              </p>
            </div>
          </div>
          
          <div className="footer-section compact">
            <h4 className="footer-section-title">Information</h4>
            <div className="footer-info">
              <p className="footer-text small">
                <strong>Updates:</strong> Every 15 minutes
              </p>
              <p className="footer-text small">
                <strong>Coverage:</strong> Nationwide
              </p>
              <p className="footer-text small">
                <strong>Time Zone:</strong> Philippine Time (UTC+8)
              </p>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p className="footer-copyright">
            &copy; {new Date().getFullYear()} Disaster Alert Aggregator PH | For informational purposes only | 
            <a href="#" className="footer-link small">Privacy Policy</a> | 
            <a href="#" className="footer-link small">Terms of Use</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
