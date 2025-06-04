import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type DisasterAlert = {
  id: string;
  source: string;
  title: string;
  description: string | null;
  category: 'typhoon' | 'earthquake' | 'flood' | 'volcano' | 'rainfall' | 'landslide' | 'weather';
  region: string | null;
  published_at: string;
  link: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  created_at: string;
};

export type DisasterAlertFilter = {
  category?: string;
  region?: string;
  severity?: string;
  source?: string; // Added source filter
};
