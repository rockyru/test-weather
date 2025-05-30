import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-title-container">
          <div className="header-title">
            <svg 
              className="header-icon" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            <h1>Disaster Alert Aggregator <span className="header-highlight">PH</span></h1>
          </div>
          
          <div className="header-badges">
            <span className="header-badge">
              Data from PAGASA & PHIVOLCS
            </span>
            <span className="header-badge header-badge-live">
              <span className="live-indicator"></span>
              Live Updates
            </span>
          </div>
        </div>
        
        <p className="header-subtitle">
          Real-time monitoring and alerts for typhoons, earthquakes, floods, volcanic activity, 
          and other disaster events across the Philippines.
        </p>
      </div>
    </header>
  );
};

export default Header;
