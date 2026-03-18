import { supabase } from './database.js';
import { Tables } from '../types/database.js';

/**
 * Statistics service for admin dashboard
 */

export interface HostelStats {
  // User stats
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  bannedUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;

  // Group stats
  totalGroups: number;
  activeGroups: number;
  completedGroups: number;
  cancelledGroups: number;
  groupsLast7Days: number;
  groupsLast30Days: number;

  // Resource stats
  totalResources: number;
  activeResourceSessions: number;
  totalResourceSessions: number;
  sessionsLast7Days: number;
  sessionsLast30Days: number;

  // Admin stats
  totalAdmins: number;
}

export interface PopularCategory {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  groupCount: number;
}

export interface PopularResource {
  resourceId: string;
  resourceName: string;
  sessionCount: number;
  totalHours: number;
}

export interface PeakHour {
  hour: number;
  groupCount: number;
}

/**
 * Get comprehensive hostel statistics
 */
export async function getHostelStats(hostelId: string): Promise<HostelStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // User stats
  const { count: totalUsers } = await supabase
    .from(Tables.USERS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId);

  const { count: approvedUsers } = await supabase
    .from(Tables.USERS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .eq('status', 'approved');

  const { count: pendingUsers } = await supabase
    .from(Tables.USERS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .eq('status', 'pending');

  const { count: bannedUsers } = await supabase
    .from(Tables.USERS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .eq('status', 'banned');

  const { count: newUsersLast7Days } = await supabase
    .from(Tables.USERS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .gte('created_at', sevenDaysAgo.toISOString());

  const { count: newUsersLast30Days } = await supabase
    .from(Tables.USERS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Group stats
  const { count: totalGroups } = await supabase
    .from(Tables.GROUPS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId);

  const { count: activeGroups } = await supabase
    .from(Tables.GROUPS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .in('status', ['open', 'full', 'in_progress']);

  const { count: completedGroups } = await supabase
    .from(Tables.GROUPS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .eq('status', 'completed');

  const { count: cancelledGroups } = await supabase
    .from(Tables.GROUPS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .eq('status', 'cancelled');

  const { count: groupsLast7Days } = await supabase
    .from(Tables.GROUPS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .gte('created_at', sevenDaysAgo.toISOString());

  const { count: groupsLast30Days } = await supabase
    .from(Tables.GROUPS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Resource stats
  const { count: totalResources } = await supabase
    .from(Tables.RESOURCES)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId);

  // Resource sessions need to be joined with resources to filter by hostel
  const { data: activeSessionsData } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select(`
      id,
      resources!inner (
        hostel_id
      )
    `)
    .eq('status', 'active')
    .eq('resources.hostel_id', hostelId);

  const activeResourceSessions = activeSessionsData?.length || 0;

  const { data: totalSessionsData } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select(`
      id,
      resources!inner (
        hostel_id
      )
    `)
    .eq('resources.hostel_id', hostelId);

  const totalResourceSessions = totalSessionsData?.length || 0;

  const { data: sessionsLast7DaysData } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select(`
      id,
      resources!inner (
        hostel_id
      )
    `)
    .eq('resources.hostel_id', hostelId)
    .gte('checked_in_at', sevenDaysAgo.toISOString());

  const sessionsLast7Days = sessionsLast7DaysData?.length || 0;

  const { data: sessionsLast30DaysData } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select(`
      id,
      resources!inner (
        hostel_id
      )
    `)
    .eq('resources.hostel_id', hostelId)
    .gte('checked_in_at', thirtyDaysAgo.toISOString());

  const sessionsLast30Days = sessionsLast30DaysData?.length || 0;

  // Admin stats
  const { count: totalAdmins } = await supabase
    .from(Tables.ADMINS)
    .select('*', { count: 'exact', head: true })
    .eq('hostel_id', hostelId);

  return {
    totalUsers: totalUsers || 0,
    approvedUsers: approvedUsers || 0,
    pendingUsers: pendingUsers || 0,
    bannedUsers: bannedUsers || 0,
    newUsersLast7Days: newUsersLast7Days || 0,
    newUsersLast30Days: newUsersLast30Days || 0,
    totalGroups: totalGroups || 0,
    activeGroups: activeGroups || 0,
    completedGroups: completedGroups || 0,
    cancelledGroups: cancelledGroups || 0,
    groupsLast7Days: groupsLast7Days || 0,
    groupsLast30Days: groupsLast30Days || 0,
    totalResources: totalResources || 0,
    activeResourceSessions,
    totalResourceSessions,
    sessionsLast7Days,
    sessionsLast30Days,
    totalAdmins: totalAdmins || 0,
  };
}

/**
 * Get most popular categories by group count
 */
export async function getPopularCategories(
  hostelId: string,
  limit: number = 5
): Promise<PopularCategory[]> {
  // Get groups from the past 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .select(`
      category_id,
      categories (
        name,
        icon
      )
    `)
    .eq('hostel_id', hostelId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error) {
    console.error('Error fetching popular categories:', error);
    return [];
  }

  // Count groups per category
  const categoryCounts = new Map<string, { name: string; icon: string; count: number }>();

  for (const group of data || []) {
    const catData = categoryCounts.get(group.category_id) || {
      name: (group as any).categories?.name || 'Unknown',
      icon: (group as any).categories?.icon || '🎮',
      count: 0,
    };
    catData.count++;
    categoryCounts.set(group.category_id, catData);
  }

  // Sort by count and return top N
  return Array.from(categoryCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      categoryIcon: data.icon,
      groupCount: data.count,
    }));
}

/**
 * Get most popular resources by session count
 */
export async function getPopularResources(
  hostelId: string,
  limit: number = 5
): Promise<PopularResource[]> {
  // Get sessions from the past 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from(Tables.RESOURCE_SESSIONS)
    .select(`
      resource_id,
      checked_in_at,
      checked_out_at,
      resources!inner (
        name,
        hostel_id
      )
    `)
    .eq('resources.hostel_id', hostelId)
    .gte('checked_in_at', thirtyDaysAgo.toISOString());

  if (error) {
    console.error('Error fetching popular resources:', error);
    return [];
  }

  // Count sessions and calculate hours per resource
  const resourceStats = new Map<string, { name: string; count: number; hours: number }>();

  for (const session of data || []) {
    const stats = resourceStats.get(session.resource_id) || {
      name: (session as any).resources?.name || 'Unknown',
      count: 0,
      hours: 0,
    };
    stats.count++;

    // Calculate session duration
    const checkedIn = new Date(session.checked_in_at);
    const checkedOut = session.checked_out_at 
      ? new Date(session.checked_out_at) 
      : new Date();
    const hours = (checkedOut.getTime() - checkedIn.getTime()) / (1000 * 60 * 60);
    stats.hours += hours;

    resourceStats.set(session.resource_id, stats);
  }

  // Sort by count and return top N
  return Array.from(resourceStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([resourceId, data]) => ({
      resourceId,
      resourceName: data.name,
      sessionCount: data.count,
      totalHours: Math.round(data.hours * 10) / 10,
    }));
}

/**
 * Get peak hours for group creation (0-23)
 */
export async function getPeakHours(hostelId: string): Promise<PeakHour[]> {
  // Get groups from the past 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .select('scheduled_for')
    .eq('hostel_id', hostelId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error) {
    console.error('Error fetching peak hours:', error);
    return [];
  }

  // Count groups per hour
  const hourCounts = new Map<number, number>();
  for (let i = 0; i < 24; i++) {
    hourCounts.set(i, 0);
  }

  for (const group of data || []) {
    const hour = new Date(group.scheduled_for).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  return Array.from(hourCounts.entries())
    .map(([hour, groupCount]) => ({ hour, groupCount }))
    .sort((a, b) => a.hour - b.hour);
}
