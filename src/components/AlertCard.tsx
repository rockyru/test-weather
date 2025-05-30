import React, { useState } from 'react';
import { DisasterAlert } from '../supabase';

interface AlertCardProps {
  alert: DisasterAlert;
}

// Function to format date to Philippine Standard Time (UTC+8) with validation
const formatDate = (dateString: string): string => {
  // Parse the date string
  const date = new Date(dateString);
  
  // Check if date is valid and not in the future
  if (isNaN(date.getTime())) {
    console.error('Invalid date:', dateString);
    return 'Invalid date';
  }
  
  // Get current date for comparison
  const now = new Date();
  
  // If date is more than a year in the future, it's likely wrong
  // In that case, create a new date with current year
  if (date.getFullYear() > now.getFullYear() + 1) {
    console.warn('Future date detected, correcting year:', dateString);
    date.setFullYear(now.getFullYear());
  }
  
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila'
  }).format(date);
};

// Function to get appropriate icon and class based on category
const getCategoryStyles = (category: string): { icon: string; cardClass: string } => {
  switch (category) {
    case 'typhoon':
      return { icon: '🌀', cardClass: 'alert-card-typhoon' };
    case 'earthquake':
      return { icon: '🌋', cardClass: 'alert-card-earthquake' };
    case 'flood':
      return { icon: '🌊', cardClass: 'alert-card-flood' };
    case 'volcano':
      return { icon: '🌋', cardClass: 'alert-card-volcano' };
    case 'rainfall':
      return { icon: '🌧️', cardClass: 'alert-card-rainfall' };
    case 'landslide':
      return { icon: '⛰️', cardClass: 'alert-card-landslide' };
    case 'weather':
      return { icon: '☁️', cardClass: 'alert-card-weather' };
    default:
      return { icon: '⚠️', cardClass: '' };
  }
};

// Function to get appropriate color class based on severity
const getSeverityClass = (severity: string | null): string => {
  switch (severity) {
    case 'high':
      return 'severity-high';
    case 'medium':
      return 'severity-medium';
    case 'low':
      return 'severity-low';
    default:
      return 'severity-low';
  }
};

// Function to truncate text with ellipsis
const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const AlertCard: React.FC<AlertCardProps> = ({ alert }) => {
  const { icon, cardClass } = getCategoryStyles(alert.category);
  const severityClass = getSeverityClass(alert.severity);
  
  // State to toggle between truncated and full description
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  // Truncate description if it's too long
  const maxDescriptionLength = 120;
  const shouldTruncate = alert.description && alert.description.length > maxDescriptionLength;
  
  const toggleExpand = () => {
    setExpanded(!expanded);
  };
  
  return (
    <div className={`alert-card ${cardClass} ${severityClass} ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="alert-header" onClick={toggleExpand}>
        <div className="alert-title-group">
          <span className="alert-icon">{icon}</span>
          <h3 className="alert-title">{alert.title}</h3>
        </div>
        <div className="alert-header-right">
          <span className="alert-source">{alert.source}</span>
          <button className="expand-button" aria-label={expanded ? 'Collapse alert' : 'Expand alert'}>
            <svg className="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d={expanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} 
              />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="alert-content">
        <div className="alert-meta mobile-meta">
          <div className="alert-tags">
            <span className="alert-tag">
              {alert.category.toUpperCase()}
            </span>
            {alert.severity && (
              <span className={`alert-tag alert-severity ${getSeverityClass(alert.severity)}`}>
                {alert.severity.toUpperCase()} RISK
              </span>
            )}
          </div>
          
          <span className="alert-date">
            {formatDate(alert.published_at)}
          </span>
        </div>

        {alert.description && (
          <div className="alert-description-container">
            <p className="alert-description">
              {shouldTruncate && !showFullDescription && !expanded
                ? truncateText(alert.description, maxDescriptionLength)
                : alert.description
              }
            </p>
            {shouldTruncate && !expanded && (
              <button 
                className="read-more-button" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowFullDescription(!showFullDescription);
                }}
              >
                {showFullDescription ? 'Read less' : 'Read more'}
              </button>
            )}
          </div>
        )}
        
        {expanded && (
          <>
            <div className="alert-details">
              {alert.region && (
                <div className="alert-detail-item">
                  <span className="detail-label">Region:</span>
                  <span className="detail-value">{alert.region}</span>
                </div>
              )}
              <div className="alert-detail-item">
                <span className="detail-label">Published:</span>
                <span className="detail-value">{formatDate(alert.published_at)}</span>
              </div>
            </div>
            
            {alert.link && (
              <div className="alert-links">
                <a 
                  href={alert.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="alert-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  View official alert
                  <svg className="alert-link-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
                  </svg>
                </a>
              </div>
            )}
            
            <div className="alert-actions">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (navigator.share) {
                    navigator.share({
                      title: alert.title,
                      text: alert.description || '',
                      url: alert.link || window.location.href
                    }).catch(err => console.error('Error sharing:', err));
                  } else {
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(alert.title)}&url=${encodeURIComponent(alert.link || window.location.href)}`, '_blank');
                  }
                }}
                className="alert-action-button"
              >
                <svg className="action-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"></path>
                </svg>
                Share
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AlertCard;
