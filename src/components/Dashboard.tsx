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
  const alertsPerPage = 20;
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Parse URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const categoryParam = urlParams.get('category');
    const regionParam = urlParams.get('region');
    const severityParam = urlParams.get('severity');
    const searchParam = urlParams.get('search');

    // Set the page from URL if present
    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        setCurrentPage(parsedPage);
      }
    }

    // Set filters from URL if present
    const newFilters: DisasterAlertFilter = {};
    if (categoryParam) newFilters.category = categoryParam;
    if (regionParam) newFilters.region = regionParam;
    if (severityParam) newFilters.severity = severityParam;
    if (Object.keys(newFilters).length > 0) {
      setFilters(newFilters);
    }

    // Set search query if present
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, []);

  // Fetch alerts from Supabase
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Calculate date 30 days ago for filtering (increased from 7 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        console.log('Fetching alerts from:', thirtyDaysAgo.toISOString());

        const { data, error } = await supabase
          .from('disaster_alerts')
          .select('*')
          .gte('published_at', thirtyDaysAgo.toISOString())
          .order('published_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (data) {
          console.log('Fetched alerts count:', data.length);
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
    console.log('Filter Debug - Total alerts:', alerts.length);

    // Apply category filter
    if (filters.category) {
      result = result.filter(alert => alert.category === filters.category);
      console.log('After category filter:', result.length);
    }

    // Apply region filter
    if (filters.region) {
      result = result.filter(alert => alert.region === filters.region);
      console.log('After region filter:', result.length);
    }

    // Apply severity filter
    if (filters.severity) {
      result = result.filter(alert => alert.severity === filters.severity);
      console.log('After severity filter:', result.length);
    }
    
    // Apply search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(alert => 
        alert.title.toLowerCase().includes(query) || 
        (alert.description && alert.description.toLowerCase().includes(query)) ||
        (alert.region && alert.region.toLowerCase().includes(query))
      );
      console.log('After search filter:', result.length);
    }

    // Update filtered alerts
    setFilteredAlerts(result);
    console.log('Updated filtered alerts:', result.length);
    
    // Don't reset to first page when component initially mounts or when no filters are active
    const isFilter = Object.keys(filters).length > 0 || searchQuery.trim() !== '';
    
    // Only reset to page 1 when explicitly applying a filter, not on initial load
    if (isFilter) {
      console.log('Resetting to page 1 due to filter change');
      setCurrentPage(1);
    }
  }, [alerts, filters, searchQuery]);
  
  // Handle pagination
  useEffect(() => {
    // Calculate pagination indexes
    const startIndex = (currentPage - 1) * alertsPerPage;
    const endIndex = startIndex + alertsPerPage;
    
    // Debug logging for pagination
    console.log('Pagination Debug:', { 
      currentPage, 
      totalPages, 
      alertsPerPage,
      filteredAlertsLength: filteredAlerts.length,
      startIndex,
      endIndex,
      displayedAlertsCount: filteredAlerts.slice(startIndex, endIndex).length
    });
    
    // Get current page of alerts
    setDisplayedAlerts(filteredAlerts.slice(startIndex, endIndex));
    
    // Update total pages calculation whenever filtered alerts change
    const calculatedTotalPages = Math.max(1, Math.ceil(filteredAlerts.length / alertsPerPage));
    setTotalPages(calculatedTotalPages);
    
    // If current page is greater than total pages, adjust to the last available page
    if (currentPage > calculatedTotalPages && calculatedTotalPages > 0) {
      setCurrentPage(calculatedTotalPages);
    }
  }, [filteredAlerts, currentPage, alertsPerPage]);

  const handleFilterChange = (newFilters: DisasterAlertFilter) => {
    setFilters(newFilters);
  };
  
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };
  
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) {
      console.log('Invalid page change rejected:', { requestedPage: page, totalPages, currentPage });
      return;
    }
    
    console.log('Changing page from', currentPage, 'to', page);
    setCurrentPage(page);
    
    // Scroll to top when page changes
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    
    // Build URL query params
    const urlParams = new URLSearchParams();
    urlParams.set('page', page.toString());
    if (filters.category) urlParams.set('category', filters.category);
    if (filters.region) urlParams.set('region', filters.region);
    if (filters.severity) urlParams.set('severity', filters.severity);
    if (searchQuery) urlParams.set('search', searchQuery);
    
    // Update URL with page parameter
    const url = `?${urlParams.toString()}`;
    console.log('Updating URL to:', url);
    window.history.pushState(
      { page, filters, searchQuery }, 
      '', 
      url
    );
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        // Restore page state from history
        if (event.state.page) {
          setCurrentPage(event.state.page);
        }
        if (event.state.filters) {
          setFilters(event.state.filters);
        }
        if (event.state.searchQuery !== undefined) {
          setSearchQuery(event.state.searchQuery);
        }
      } else {
        // If no state, parse from URL
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = urlParams.get('page');
        if (pageParam) {
          const parsedPage = parseInt(pageParam, 10);
          if (!isNaN(parsedPage) && parsedPage > 0) {
            setCurrentPage(parsedPage);
          }
        } else {
          setCurrentPage(1);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

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
