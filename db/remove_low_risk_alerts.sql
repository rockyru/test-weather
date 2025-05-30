-- Script to remove all low risk alerts from the database
-- This should be run to clean up existing data

-- First, count how many low risk alerts we have to delete
SELECT COUNT(*) AS low_risk_alerts_count FROM disaster_alerts WHERE severity = 'low';

-- Delete all low risk alerts
DELETE FROM disaster_alerts WHERE severity = 'low';

-- Verify the deletion was successful
SELECT COUNT(*) AS remaining_low_risk_alerts FROM disaster_alerts WHERE severity = 'low';

-- Show the remaining alerts by severity
SELECT severity, COUNT(*) FROM disaster_alerts GROUP BY severity ORDER BY severity;
