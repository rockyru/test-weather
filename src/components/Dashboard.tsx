import React, { useEffect, useState } from 'react';
import { supabase, DisasterAlert, DisasterAlertFilter } from '../supabase';
import AlertCard from './AlertCard';
import FilterBar from './FilterBar';

const Dashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<DisasterAlert[]>([]);
  const [filters, setFilters] = useState<DisasterAlertFilter>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<string[]>([]);

  // Fetch alerts from Supabase
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('disaster_alerts')
          .select('*')
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

  // Apply filters to alerts
  useEffect(() => {
    let result = [...alerts];

    if (filters.category) {
      result = result.filter(alert => alert.category === filters.category);
    }

    if (filters.region) {
      result = result.filter(alert => alert.region === filters.region);
    }

    setFilteredAlerts(result);
  }, [alerts, filters]);

  const handleFilterChange = (newFilters: DisasterAlertFilter) => {
    setFilters(newFilters);
  };

  return (
    <div className="container">
      <FilterBar 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        regions={regions}
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
        <div className="alert-grid">
          {filteredAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
