import React, { useState, useEffect } from 'react';
import { DisasterAlertFilter } from '../supabase';

interface FilterBarProps {
  filters: DisasterAlertFilter;
  onFilterChange: (filters: DisasterAlertFilter) => void;
  regions: string[];
  onSearchChange: (searchQuery: string) => void;
}

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'typhoon', label: 'Typhoon' },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'flood', label: 'Flood' },
  { value: 'volcano', label: 'Volcano' },
  { value: 'rainfall', label: 'Rainfall' },
  { value: 'landslide', label: 'Landslide' },
  { value: 'weather', label: 'Weather' },
];

const dataSources = [
  { value: '', label: 'All Sources' },
  { value: 'PAGASA', label: 'PAGASA' },
  { value: 'PHIVOLCS', label: 'PHIVOLCS' },
  { value: 'USGS API', label: 'USGS API' },
  { value: 'OpenWeatherMap API', label: 'OpenWeatherMap API' },
  // System sources could be added if needed, e.g.:
  // { value: 'PAGASA System', label: 'PAGASA System Alerts' },
  // { value: 'PHIVOLCS System', label: 'PHIVOLCS System Alerts' },
  // { value: 'USGS API System', label: 'USGS System Alerts' },
  // { value: 'OpenWeatherMap System', label: 'OpenWeatherMap System Alerts' },
];

const severityLevels = [
  { value: '', label: 'All Risk Levels' },
  { value: 'high', label: 'High Risk' },
  { value: 'medium', label: 'Medium Risk' },
  { value: 'low', label: 'Low Risk' },
];

const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange, regions, onSearchChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Debounce search input to avoid excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, onSearchChange]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, category: e.target.value });
  };

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, region: e.target.value });
  };
  
  const handleSeverityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, severity: e.target.value });
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, source: e.target.value });
  };

  const handleClearFilters = () => {
    onFilterChange({});
    setSearchQuery('');
    onSearchChange('');
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const hasActiveFilters = !!filters.category || !!filters.region || !!filters.severity || !!filters.source || !!searchQuery;

  return (
    <div className="filter-bar">
      <div className="filter-bar-header">
        <h2 className="filter-bar-title">
          <svg className="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter Alerts
        </h2>
        
        <div className="filter-actions">
          {hasActiveFilters && (
            <button 
              className="clear-filters-button" 
              onClick={handleClearFilters}
              aria-label="Clear all filters"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="clear-icon">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="action-text">Clear</span>
            </button>
          )}
          <button 
            className={`toggle-filters-button ${showFilters ? 'active' : ''}`} 
            onClick={toggleFilters}
            aria-label="Toggle filters"
            aria-expanded={showFilters}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="toggle-icon">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            <span className="action-text">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
          </button>
        </div>
      </div>
      
      <div className="search-container">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search alerts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search alerts"
        />
        {searchQuery && (
          <button 
            className="search-clear-button" 
            onClick={() => {
              setSearchQuery('');
              onSearchChange('');
            }}
            aria-label="Clear search"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      <div className={`filter-controls ${showFilters ? 'show' : 'hide'}`}>
        <div className="filter-group">
          <label className="filter-label" htmlFor="category-filter">
            <svg className="filter-label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            Category
          </label>
          <select
            id="category-filter"
            className="filter-select"
            value={filters.category || ''}
            onChange={handleCategoryChange}
            aria-label="Filter by category"
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label className="filter-label" htmlFor="region-filter">
            <svg className="filter-label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Region
          </label>
          <select
            id="region-filter"
            className="filter-select"
            value={filters.region || ''}
            onChange={handleRegionChange}
            aria-label="Filter by region"
          >
            <option value="">All Regions</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label className="filter-label" htmlFor="severity-filter">
            <svg className="filter-label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Risk Level
          </label>
          <select
            id="severity-filter"
            className="filter-select"
            value={filters.severity || ''}
            onChange={handleSeverityChange}
            aria-label="Filter by risk level"
          >
            {severityLevels.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="source-filter">
            <svg className="filter-label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              {/* Simple icon for source - could be improved */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 012-2m14 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v2m14 0h1m-1 0h-1" />
            </svg>
            Source
          </label>
          <select
            id="source-filter"
            className="filter-select"
            value={filters.source || ''}
            onChange={handleSourceChange}
            aria-label="Filter by source"
          >
            {dataSources.map((source) => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {hasActiveFilters && (
        <div className="active-filters">
          <div className="active-filters-label">Active filters:</div>
          <div className="active-filter-tags">
            {filters.category && (
              <span className="active-filter-tag">
                Category: {categories.find(c => c.value === filters.category)?.label}
                <button 
                  onClick={() => onFilterChange({ ...filters, category: '' })} 
                  className="remove-filter"
                  aria-label="Remove category filter"
                >
                  ×
                </button>
              </span>
            )}
            {filters.region && (
              <span className="active-filter-tag">
                Region: {filters.region}
                <button 
                  onClick={() => onFilterChange({ ...filters, region: '' })} 
                  className="remove-filter"
                  aria-label="Remove region filter"
                >
                  ×
                </button>
              </span>
            )}
            {filters.severity && (
              <span className="active-filter-tag">
                Risk Level: {severityLevels.find(s => s.value === filters.severity)?.label}
                <button 
                  onClick={() => onFilterChange({ ...filters, severity: '' })} 
                  className="remove-filter"
                  aria-label="Remove severity filter"
                >
                  ×
                </button>
              </span>
            )}
            {filters.source && (
              <span className="active-filter-tag">
                Source: {dataSources.find(s => s.value === filters.source)?.label}
                <button
                  onClick={() => onFilterChange({ ...filters, source: '' })}
                  className="remove-filter"
                  aria-label="Remove source filter"
                >
                  ×
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="active-filter-tag">
                Search: {searchQuery}
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    onSearchChange('');
                  }} 
                  className="remove-filter"
                  aria-label="Remove search filter"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
