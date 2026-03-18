import { supabase } from './database.js';
import { Tables, Resource, ResourceSession, ResourceSessionStatus } from '../types/database.js';
import { CONFIG } from '../utils/constants.js';

/**
 * Resource management service
 */

// Extended resource type with session info
export interface ResourceWithStatus extends Resource {
  is_available: boolean;
  current_session?: {
    id: string;
    user_id: string;
    user_name: string;
    checked_in_at: string;
    auto_checkout_at: string;
  };
  category_name?: string;
  category_icon?: string;
}

/**
 * Get all resources for a hostel with their current status
 */
export async function getResourcesByHostel(hostelId: string): Promise<ResourceWithStatus[]> {
  // Get resources with category info
  const { data: resources, error } = await supabase
    .from(Tables.RESOURCES)
    .select(`
      *,
      categories (
        name,
        icon
      )
    `)
    .eq('hostel_id', hostelId)
    .order('name');

  if (error) {
    console.error('Error fetching resources:', error);
    throw error;
  }

  if (!resources || resources.length === 0) {
    return [];
  }

  // Get active sessions for these resources
  const resourceIds = resources.map(r => r.id);
  const { data: sessions, error: sessionsError } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select(`
      id,
      resource_id,
      user_id,
      checked_in_at,
      auto_checkout_at,
      users (
        first_name,
        username
      )
    `)
    .in('resource_id', resourceIds)
    .eq('status', 'active');

  if (sessionsError) {
    console.error('Error fetching resource sessions:', sessionsError);
    throw sessionsError;
  }

  // Map sessions by resource_id
  const sessionsByResource = new Map<string, any>();
  for (const session of sessions || []) {
    sessionsByResource.set(session.resource_id, session);
  }

  // Build result with status
  return resources.map((resource: any) => {
    const session = sessionsByResource.get(resource.id);
    const categoryInfo = resource.categories;

    return {
      ...resource,
      categories: undefined, // Remove nested object
      is_available: !session,
      category_name: categoryInfo?.name,
      category_icon: categoryInfo?.icon,
      current_session: session ? {
        id: session.id,
        user_id: session.user_id,
        user_name: session.users?.username || session.users?.first_name || 'Unknown',
        checked_in_at: session.checked_in_at,
        auto_checkout_at: session.auto_checkout_at,
      } : undefined,
    };
  });
}

/**
 * Get a single resource by ID with status
 */
export async function getResourceById(resourceId: string): Promise<ResourceWithStatus | null> {
  const { data: resource, error } = await supabase
    .from(Tables.RESOURCES)
    .select(`
      *,
      categories (
        name,
        icon
      )
    `)
    .eq('id', resourceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching resource:', error);
    throw error;
  }

  // Get active session if any
  const { data: session, error: sessionError } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select(`
      id,
      user_id,
      checked_in_at,
      auto_checkout_at,
      users (
        first_name,
        username
      )
    `)
    .eq('resource_id', resourceId)
    .eq('status', 'active')
    .maybeSingle();

  if (sessionError) {
    console.error('Error fetching resource session:', sessionError);
    throw sessionError;
  }

  const categoryInfo = (resource as any).categories;

  return {
    ...resource,
    categories: undefined,
    is_available: !session,
    category_name: categoryInfo?.name,
    category_icon: categoryInfo?.icon,
    current_session: session ? {
      id: session.id,
      user_id: session.user_id,
      user_name: (session as any).users?.username || (session as any).users?.first_name || 'Unknown',
      checked_in_at: session.checked_in_at,
      auto_checkout_at: session.auto_checkout_at,
    } : undefined,
  };
}

/**
 * Check in to a resource
 */
export async function checkInResource(
  resourceId: string,
  userId: string,
  groupId?: string
): Promise<ResourceSession> {
  // Get resource to check max duration
  const { data: resource, error: resourceError } = await supabase
    .from(Tables.RESOURCES)
    .select('max_duration_hours')
    .eq('id', resourceId)
    .single();

  if (resourceError) {
    console.error('Error fetching resource for check-in:', resourceError);
    throw resourceError;
  }

  // Calculate auto-checkout time
  const maxHours = resource.max_duration_hours || CONFIG.DEFAULT_RESOURCE_MAX_HOURS;
  const autoCheckoutAt = new Date();
  autoCheckoutAt.setHours(autoCheckoutAt.getHours() + maxHours);

  // Create session
  const { data: session, error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .insert({
      resource_id: resourceId,
      user_id: userId,
      group_id: groupId || null,
      auto_checkout_at: autoCheckoutAt.toISOString(),
      status: 'active' as ResourceSessionStatus,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating resource session:', error);
    throw error;
  }

  return session;
}

/**
 * Check out from a resource session
 */
export async function checkOutResource(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .update({
      status: 'completed' as ResourceSessionStatus,
      checked_out_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error checking out resource:', error);
    throw error;
  }
}

/**
 * Check out from a resource by resource ID and user ID
 */
export async function checkOutResourceByUser(resourceId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .update({
      status: 'completed' as ResourceSessionStatus,
      checked_out_at: new Date().toISOString(),
    })
    .eq('resource_id', resourceId)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('Error checking out resource by user:', error);
    throw error;
  }
}

/**
 * Get active resource sessions for a user
 */
export async function getUserActiveSessions(userId: string): Promise<(ResourceSession & { resource_name: string })[]> {
  const { data, error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select(`
      *,
      resources (
        name
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('checked_in_at', { ascending: false });

  if (error) {
    console.error('Error fetching user sessions:', error);
    throw error;
  }

  return (data || []).map((session: any) => ({
    ...session,
    resource_name: session.resources?.name || 'Unknown Resource',
    resources: undefined,
  }));
}

/**
 * Get count of user's active resource sessions
 */
export async function getUserActiveSessionCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('Error counting user sessions:', error);
    throw error;
  }

  return count || 0;
}

/**
 * Check if resource is available
 */
export async function isResourceAvailable(resourceId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select('*', { count: 'exact', head: true })
    .eq('resource_id', resourceId)
    .eq('status', 'active');

  if (error) {
    console.error('Error checking resource availability:', error);
    throw error;
  }

  return (count || 0) === 0;
}

/**
 * Get all active sessions for a hostel (admin view)
 */
export async function getActiveSessionsByHostel(hostelId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select(`
      *,
      resources!inner (
        id,
        name,
        hostel_id
      ),
      users (
        first_name,
        username,
        telegram_id
      )
    `)
    .eq('resources.hostel_id', hostelId)
    .eq('status', 'active')
    .order('checked_in_at', { ascending: false });

  if (error) {
    console.error('Error fetching active sessions:', error);
    throw error;
  }

  return data || [];
}

/**
 * Force checkout a session (admin)
 */
export async function forceCheckout(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .update({
      status: 'completed' as ResourceSessionStatus,
      checked_out_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error force checking out session:', error);
    throw error;
  }
}

// ============================================================================
// ADMIN CRUD OPERATIONS
// ============================================================================

/**
 * Create a new resource
 */
export async function createResource(
  hostelId: string,
  name: string,
  description: string | null,
  categoryId: string | null,
  maxDurationHours: number = CONFIG.DEFAULT_RESOURCE_MAX_HOURS
): Promise<Resource> {
  const { data, error } = await supabase
    .from(Tables.RESOURCES)
    .insert({
      hostel_id: hostelId,
      name,
      description,
      category_id: categoryId,
      max_duration_hours: maxDurationHours,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating resource:', error);
    throw error;
  }

  return data;
}

/**
 * Update a resource
 */
export async function updateResource(
  resourceId: string,
  updates: {
    name?: string;
    description?: string | null;
    category_id?: string | null;
    max_duration_hours?: number;
  }
): Promise<Resource> {
  const { data, error } = await supabase
    .from(Tables.RESOURCES)
    .update(updates)
    .eq('id', resourceId)
    .select()
    .single();

  if (error) {
    console.error('Error updating resource:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a resource
 */
export async function deleteResource(resourceId: string): Promise<void> {
  // First, check for active sessions
  const { count, error: countError } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select('*', { count: 'exact', head: true })
    .eq('resource_id', resourceId)
    .eq('status', 'active');

  if (countError) {
    console.error('Error checking active sessions:', countError);
    throw countError;
  }

  if ((count || 0) > 0) {
    throw new Error('Cannot delete resource with active sessions');
  }

  const { error } = await supabase
    .from(Tables.RESOURCES)
    .delete()
    .eq('id', resourceId);

  if (error) {
    console.error('Error deleting resource:', error);
    throw error;
  }
}

/**
 * Get expired sessions that need to be auto-checked out
 */
export async function getExpiredSessions(): Promise<ResourceSession[]> {
  const { data, error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select('*')
    .eq('status', 'active')
    .lt('auto_checkout_at', new Date().toISOString());

  if (error) {
    console.error('Error fetching expired sessions:', error);
    throw error;
  }

  return data || [];
}

/**
 * Mark sessions as expired
 */
export async function markSessionsExpired(sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return;

  const { error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .update({
      status: 'expired' as ResourceSessionStatus,
      checked_out_at: new Date().toISOString(),
    })
    .in('id', sessionIds);

  if (error) {
    console.error('Error marking sessions as expired:', error);
    throw error;
  }
}
