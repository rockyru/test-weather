import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="header-title">
            <svg 
              className="header-icon" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            <h1>Disaster Alert Aggregator PH</h1>
          </div>
          
          <div>
            <span className="header-badge">
              Data from PAGASA & PHIVOLCS
            </span>
          </div>
        </div>
        
        <p className="header-subtitle">
          Real-time disaster alerts and updates across the Philippines
        </p>
      </div>
    </header>
  );
};

export default Header;
