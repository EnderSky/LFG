import { supabase } from './database.js';
import { Tables, User, UserStatus } from '../types/database.js';

/**
 * User management service
 */

/**
 * Get user by Telegram ID
 */
export async function getUserByTelegramId(telegramId: number): Promise<User | null> {
  const { data, error } = await supabase
    .from(Tables.USERS)
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching user:', error);
    throw error;
  }

  return data;
}

/**
 * Get user by Telegram username (without @)
 */
export async function getUserByUsername(username: string, hostelId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from(Tables.USERS)
    .select('*')
    .eq('username', username)
    .eq('hostel_id', hostelId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching user by username:', error);
    throw error;
  }

  return data;
}

/**
 * Get user by ID (UUID)
 */
export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from(Tables.USERS)
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching user by ID:', error);
    throw error;
  }

  return data;
}

/**
 * Create a pending user
 */
export async function createPendingUser(
  telegramId: number,
  username: string | null,
  firstName: string,
  lastName: string | null,
  hostelId: string
): Promise<User> {
  const { data, error } = await supabase
    .from(Tables.USERS)
    .insert({
      telegram_id: telegramId,
      username,
      first_name: firstName,
      last_name: lastName,
      hostel_id: hostelId,
      status: 'pending' as UserStatus,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw error;
  }

  return data;
}

/**
 * Approve a user
 */
export async function approveUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.USERS)
    .update({ status: 'approved' as UserStatus })
    .eq('id', userId);

  if (error) {
    console.error('Error approving user:', error);
    throw error;
  }
}

/**
 * Reject a user
 */
export async function rejectUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.USERS)
    .update({ status: 'banned' as UserStatus })
    .eq('id', userId);

  if (error) {
    console.error('Error rejecting user:', error);
    throw error;
  }
}

/**
 * Check if user is approved
 */
export async function isUserApproved(telegramId: number): Promise<boolean> {
  const user = await getUserByTelegramId(telegramId);
  return user?.status === 'approved';
}

/**
 * Get pending users for a hostel
 */
export async function getPendingUsers(hostelId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from(Tables.USERS)
    .select('*')
    .eq('hostel_id', hostelId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending users:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get user's active groups count
 */
export async function getUserActiveGroupsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(Tables.GROUPS)
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', userId)
    .in('status', ['open', 'full', 'in_progress']);

  if (error) {
    console.error('Error counting user groups:', error);
    throw error;
  }

  return count || 0;
}

/**
 * Get user's group memberships count
 */
export async function getUserGroupMembershipsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(Tables.GROUP_MEMBERS)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('Error counting user memberships:', error);
    throw error;
  }

  return count || 0;
}
