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

const severityLevels = [
  { value: '', label: 'All Risk Levels' },
  { value: 'high', label: 'High Risk' },
  { value: 'medium', label: 'Medium Risk' },
  { value: 'low', label: 'Low Risk' },
];

const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange, regions, onSearchChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
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

  return (
    <div className="filter-bar">
      <div>
        <h2 className="filter-bar-title">Disaster Alerts</h2>
        
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search alerts"
          />
        </div>
        
        <div className="filter-controls">
          <div>
            <select
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
          
          <div>
            <select
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
          
          <div>
            <select
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
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
