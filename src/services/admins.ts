import { supabase } from './database.js';
import { Tables, Admin, User } from '../types/database.js';

/**
 * Admin management service
 */

/**
 * Check if user is an admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from(Tables.ADMINS)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Error checking admin status:', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Check if user is admin by telegram ID
 */
export async function isUserAdminByTelegramId(telegramId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from(Tables.USERS)
    .select(`
      id,
      admins!inner(id)
    `)
    .eq('telegram_id', telegramId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return false;
    }
    console.error('Error checking admin status:', error);
    return false;
  }

  return !!data;
}

/**
 * Get admin record for user
 */
export async function getAdminRecord(userId: string): Promise<Admin | null> {
  const { data, error } = await supabase
    .from(Tables.ADMINS)
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching admin record:', error);
    throw error;
  }

  return data;
}

/**
 * Get all admins for a hostel
 */
export async function getAdminsByHostel(hostelId: string): Promise<Admin[]> {
  const { data, error } = await supabase
    .from(Tables.ADMINS)
    .select('*')
    .eq('hostel_id', hostelId);

  if (error) {
    console.error('Error fetching admins:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get admin users for a hostel (with user details)
 */
export async function getAdminUsersForHostel(hostelId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from(Tables.ADMINS)
    .select(`
      user_id,
      users!inner(*)
    `)
    .eq('hostel_id', hostelId);

  if (error) {
    console.error('Error fetching admin users:', error);
    throw error;
  }

  return data?.map((item: any) => item.users) || [];
}
