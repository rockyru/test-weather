import React, { useEffect, useState } from 'react';
import { supabase, DisasterAlert, DisasterAlertFilter } from '../supabase';
import AlertCard from './AlertCard';
import FilterBar from './FilterBar';
import Pagination from './Pagination';
import ScraperStatus from './ScraperStatus';

const Dashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<DisasterAlert[]>([]);
  const [displayedAlerts, setDisplayedAlerts] = useState<DisasterAlert[]>([]);
  const [filters, setFilters] = useState<DisasterAlertFilter>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<string[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const alertsPerPage = 10;
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch alerts from Supabase
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Calculate date 7 days ago for filtering
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        console.log('Fetching alerts from:', sevenDaysAgo.toISOString());

        const { data, error } = await supabase
          .from('disaster_alerts')
          .select('*')
          .gte('published_at', sevenDaysAgo.toISOString())
          .order('published_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (data) {
          setAlerts(data as DisasterAlert[]);
          
          // Extract unique regions for filter dropdown
          const uniqueRegions = Array.from(
            new Set(data.map((alert: DisasterAlert) => alert.region).filter(Boolean))
          ) as string[];
          
          setRegions(uniqueRegions);
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
        setError('Failed to fetch alerts. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();

    // Subscribe to changes in the disaster_alerts table
    const subscription = supabase
      .channel('public:disaster_alerts')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'disaster_alerts'
        }, 
        (payload) => {
          setAlerts(prevAlerts => [payload.new as DisasterAlert, ...prevAlerts]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Apply filters and search to alerts
  useEffect(() => {
    let result = [...alerts];

    // Apply category filter
    if (filters.category) {
      result = result.filter(alert => alert.category === filters.category);
    }

    // Apply region filter
    if (filters.region) {
      result = result.filter(alert => alert.region === filters.region);
    }

    // Apply severity filter
    if (filters.severity) {
      result = result.filter(alert => alert.severity === filters.severity);
    }
    
    // Apply search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(alert => 
        alert.title.toLowerCase().includes(query) || 
        (alert.description && alert.description.toLowerCase().includes(query)) ||
        (alert.region && alert.region.toLowerCase().includes(query))
      );
    }

    // Update filtered alerts
    setFilteredAlerts(result);
    
    // Calculate total pages
    setTotalPages(Math.ceil(result.length / alertsPerPage));
    
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [alerts, filters, searchQuery]);
  
  // Handle pagination
  useEffect(() => {
    // Calculate pagination indexes
    const startIndex = (currentPage - 1) * alertsPerPage;
    const endIndex = startIndex + alertsPerPage;
    
    // Get current page of alerts
    setDisplayedAlerts(filteredAlerts.slice(startIndex, endIndex));
  }, [filteredAlerts, currentPage]);

  const handleFilterChange = (newFilters: DisasterAlertFilter) => {
    setFilters(newFilters);
  };
  
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="container">
      <ScraperStatus />
      
      <FilterBar 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        regions={regions}
        onSearchChange={handleSearchChange}
      />

      {loading ? (
        <div className="loader">
          <div className="spinner"></div>
        </div>
      ) : error ? (
        <div className="error-message">
          <p className="error-title">Error</p>
          <p>{error}</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="empty-message">
          <p className="empty-title">No alerts found</p>
          <p>There are no disaster alerts matching your filters at this time.</p>
        </div>
      ) : (
        <>
          <div className="alert-grid">
            {displayedAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
          
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;
