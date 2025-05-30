import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

interface ScraperLogEntry {
  id: string;
  timestamp: string;
  status: 'starting' | 'running' | 'completed' | 'error';
  message: string;
  created_at: string;
}

const ScraperStatus: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [logEntries, setLogEntries] = useState<ScraperLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch the most recent scraper status
    const fetchScraperStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('scraper_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        if (data && data.length > 0) {
          setLogEntries(data);
          
          // Set the last run time
          const lastRunTime = new Date(data[0].created_at);
          setLastRun(lastRunTime.toLocaleString());
          
          // Set the status
          const latestStatus = data[0].status;
          setStatus(latestStatus);
        }
      } catch (error) {
        console.error('Error fetching scraper status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScraperStatus();

    // Set up real-time subscription to scraper_logs table
    const subscription = supabase
      .channel('public:scraper_logs')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'scraper_logs'
        }, 
        (payload) => {
          setLogEntries(prevLogs => [payload.new as ScraperLogEntry, ...prevLogs.slice(0, 19)]);
          setLastRun(new Date((payload.new as ScraperLogEntry).created_at).toLocaleString());
          setStatus((payload.new as ScraperLogEntry).status);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'starting':
        return 'bg-blue-500';
      case 'running':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Function to format log messages
  const formatLogMessage = (message: string) => {
    if (message.includes('Making request to:')) {
      return <span className="text-blue-600">{message}</span>;
    } else if (message.includes('Skipping')) {
      return <span className="text-yellow-600">{message}</span>;
    } else if (message.includes('Successfully')) {
      return <span className="text-green-600">{message}</span>;
    } else if (message.includes('Error')) {
      return <span className="text-red-600">{message}</span>;
    }
    return message;
  };

  if (isLoading) {
    return <div className="scraper-status-indicator">Loading scraper status...</div>;
  }

  return (
    <div className="scraper-status-panel">
      <div 
        className="scraper-status-header" 
        onClick={toggleExpand}
      >
        <div className="scraper-status-indicator">
          <div className={`status-dot ${getStatusColor(status)}`}></div>
          <span className="status-text">
            Scraper Status: <strong>{status.charAt(0).toUpperCase() + status.slice(1)}</strong>
          </span>
          {lastRun && (
            <span className="last-run-time">
              Last run: {lastRun}
            </span>
          )}
        </div>
        <button className="expand-button">
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {isExpanded && (
        <div className="scraper-log-container">
          <h3 className="scraper-log-title">Scraper Log</h3>
          <div className="scraper-log">
            {logEntries.length > 0 ? (
              logEntries.map((entry) => (
                <div key={entry.id} className="log-entry">
                  <span className="log-timestamp">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`log-status ${getStatusColor(entry.status)}`}>
                    {entry.status}
                  </span>
                  <span className="log-message">
                    {formatLogMessage(entry.message)}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-log">No log entries available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScraperStatus;
