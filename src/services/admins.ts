import { supabase } from './database.js';
import { Tables, Admin, User } from '../types/database.js';

/**
 * Admin management service
 */

// Extended admin type with user details
export interface AdminWithUser extends Admin {
  user_name: string;
  user_username?: string;
  telegram_id: number;
}

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
 * Check if user is a super admin
 */
export async function isUserSuperAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(Tables.ADMINS)
    .select('is_super_admin')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return false;
    }
    console.error('Error checking super admin status:', error);
    return false;
  }

  return data?.is_super_admin || false;
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
 * Get all admins for a hostel with user details
 */
export async function getAdminsWithUserDetails(hostelId: string): Promise<AdminWithUser[]> {
  const { data, error } = await supabase
    .from(Tables.ADMINS)
    .select(`
      *,
      users (
        first_name,
        username,
        telegram_id
      )
    `)
    .eq('hostel_id', hostelId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching admins with details:', error);
    throw error;
  }

  return (data || []).map((admin: any) => ({
    ...admin,
    user_name: admin.users?.first_name || 'Unknown',
    user_username: admin.users?.username,
    telegram_id: admin.users?.telegram_id,
    users: undefined,
  }));
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

/**
 * Get approved users who are not admins (for adding new admins)
 */
export async function getApprovedNonAdminUsers(hostelId: string): Promise<User[]> {
  // Get all approved users
  const { data: users, error: usersError } = await supabase
    .from(Tables.USERS)
    .select('*')
    .eq('hostel_id', hostelId)
    .eq('status', 'approved')
    .order('first_name', { ascending: true });

  if (usersError) {
    console.error('Error fetching approved users:', usersError);
    throw usersError;
  }

  // Get all admin user IDs for this hostel
  const { data: admins, error: adminsError } = await supabase
    .from(Tables.ADMINS)
    .select('user_id')
    .eq('hostel_id', hostelId);

  if (adminsError) {
    console.error('Error fetching admin IDs:', adminsError);
    throw adminsError;
  }

  const adminUserIds = new Set(admins?.map(a => a.user_id) || []);

  // Filter out users who are already admins
  return (users || []).filter(user => !adminUserIds.has(user.id));
}

/**
 * Add a user as admin
 */
export async function addAdmin(
  userId: string,
  hostelId: string,
  isSuperAdmin: boolean = false
): Promise<Admin> {
  const { data, error } = await supabase
    .from(Tables.ADMINS)
    .insert({
      user_id: userId,
      hostel_id: hostelId,
      is_super_admin: isSuperAdmin,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding admin:', error);
    throw error;
  }

  return data;
}

/**
 * Remove admin status from user
 */
export async function removeAdmin(userId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.ADMINS)
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error removing admin:', error);
    throw error;
  }
}

/**
 * Toggle super admin status
 */
export async function toggleSuperAdmin(userId: string): Promise<boolean> {
  // Get current status
  const { data: admin, error: fetchError } = await supabase
    .from(Tables.ADMINS)
    .select('is_super_admin')
    .eq('user_id', userId)
    .single();

  if (fetchError) {
    console.error('Error fetching admin:', fetchError);
    throw fetchError;
  }

  const newStatus = !admin.is_super_admin;

  const { error: updateError } = await supabase
    .from(Tables.ADMINS)
    .update({ is_super_admin: newStatus })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error toggling super admin:', updateError);
    throw updateError;
  }

  return newStatus;
}

/**
 * Count admins in hostel
 */
export async function getAdminCount(hostelId: string): Promise<number> {
  const { count, error } = await supabase
    .from(Tables.ADMINS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId);

  if (error) {
    console.error('Error counting admins:', error);
    throw error;
  }

  return count || 0;
}
