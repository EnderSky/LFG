import { supabase } from './database.js';
import { Tables, Hostel } from '../types/database.js';

/**
 * Hostel management service
 */

/**
 * Get all hostels
 */
export async function getAllHostels(): Promise<Hostel[]> {
  const { data, error } = await supabase
    .from(Tables.HOSTELS)
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching hostels:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get hostel by ID
 */
export async function getHostelById(id: string): Promise<Hostel | null> {
  const { data, error } = await supabase
    .from(Tables.HOSTELS)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching hostel:', error);
    throw error;
  }

  return data;
}

/**
 * Get hostel by slug
 */
export async function getHostelBySlug(slug: string): Promise<Hostel | null> {
  const { data, error } = await supabase
    .from(Tables.HOSTELS)
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching hostel:', error);
    throw error;
  }

  return data;
}
