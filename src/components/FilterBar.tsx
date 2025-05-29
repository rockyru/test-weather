import React from 'react';
import { DisasterAlertFilter } from '../supabase';

interface FilterBarProps {
  filters: DisasterAlertFilter;
  onFilterChange: (filters: DisasterAlertFilter) => void;
  regions: string[];
}

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'typhoon', label: 'Typhoon' },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'flood', label: 'Flood' },
  { value: 'volcano', label: 'Volcano' },
];

const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange, regions }) => {
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, category: e.target.value });
  };

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, region: e.target.value });
  };

  return (
    <div className="filter-bar">
      <div>
        <h2 className="filter-bar-title">Disaster Alerts</h2>
        
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
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
