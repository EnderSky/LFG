import { supabase } from './database.js';
import { Tables, Group, GroupMember, GroupStatus, MemberStatus } from '../types/database.js';
import { CONFIG } from '../utils/constants.js';
import { addHours, addMinutes } from '../utils/datetime.js';

/**
 * Group management service
 */

// Extended group type with related data
export interface GroupWithDetails extends Group {
  creator_name: string;
  creator_username?: string;
  category_name: string;
  category_icon: string;
  resource_name?: string;
  members?: GroupMemberWithUser[];
}

export interface GroupMemberWithUser extends GroupMember {
  user_name: string;
  user_username?: string;
  telegram_id: number;
}

/**
 * Create a new group
 */
export async function createGroup(params: {
  hostelId: string;
  creatorId: string;
  categoryId: string;
  title: string;
  description?: string;
  maxPlayers: number;
  scheduledForMinutes: number; // 0 = now, >0 = minutes from now
  resourceId?: string;
}): Promise<Group> {
  const now = new Date();
  const scheduledFor = params.scheduledForMinutes === 0
    ? now
    : addMinutes(now, params.scheduledForMinutes);
  
  // Groups expire 6 hours after scheduled time by default
  const expiresAt = addHours(scheduledFor, CONFIG.DEFAULT_GROUP_EXPIRY_HOURS);

  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .insert({
      hostel_id: params.hostelId,
      creator_id: params.creatorId,
      category_id: params.categoryId,
      title: params.title,
      description: params.description || null,
      max_players: params.maxPlayers,
      current_players: 1, // Creator is first player
      resource_id: params.resourceId || null,
      scheduled_for: scheduledFor.toISOString(),
      starts_at: params.scheduledForMinutes === 0 ? now.toISOString() : null,
      expires_at: expiresAt.toISOString(),
      status: 'open' as GroupStatus,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating group:', error);
    throw error;
  }

  // Add creator as first member
  await addGroupMember(data.id, params.creatorId);

  return data;
}

/**
 * Get group by ID with full details
 */
export async function getGroupById(groupId: string): Promise<GroupWithDetails | null> {
  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .select(`
      *,
      users!groups_creator_id_fkey (
        first_name,
        username,
        telegram_id
      ),
      categories (
        name,
        icon
      ),
      resources (
        name
      )
    `)
    .eq('id', groupId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching group:', error);
    throw error;
  }

  return mapGroupWithDetails(data);
}

/**
 * Get active groups for a hostel
 */
export async function getGroupsByHostel(
  hostelId: string,
  status?: GroupStatus[]
): Promise<GroupWithDetails[]> {
  const statuses = status || ['open', 'full', 'in_progress'];

  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .select(`
      *,
      users!groups_creator_id_fkey (
        first_name,
        username,
        telegram_id
      ),
      categories (
        name,
        icon
      ),
      resources (
        name
      )
    `)
    .eq('hostel_id', hostelId)
    .in('status', statuses)
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Error fetching groups:', error);
    throw error;
  }

  return (data || []).map(mapGroupWithDetails);
}

/**
 * Get active groups by category for a hostel
 */
export async function getGroupsByCategory(
  hostelId: string,
  categoryId: string
): Promise<GroupWithDetails[]> {
  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .select(`
      *,
      users!groups_creator_id_fkey (
        first_name,
        username,
        telegram_id
      ),
      categories (
        name,
        icon
      ),
      resources (
        name
      )
    `)
    .eq('hostel_id', hostelId)
    .eq('category_id', categoryId)
    .in('status', ['open', 'full', 'in_progress'])
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Error fetching groups by category:', error);
    throw error;
  }

  return (data || []).map(mapGroupWithDetails);
}

/**
 * Get groups created by a user
 */
export async function getGroupsByCreator(userId: string): Promise<GroupWithDetails[]> {
  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .select(`
      *,
      users!groups_creator_id_fkey (
        first_name,
        username,
        telegram_id
      ),
      categories (
        name,
        icon
      ),
      resources (
        name
      )
    `)
    .eq('creator_id', userId)
    .in('status', ['open', 'full', 'in_progress'])
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Error fetching creator groups:', error);
    throw error;
  }

  return (data || []).map(mapGroupWithDetails);
}

/**
 * Get count of active groups created by user
 */
export async function getCreatorActiveGroupCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(Tables.GROUPS)
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', userId)
    .in('status', ['open', 'full', 'in_progress']);

  if (error) {
    console.error('Error counting creator groups:', error);
    throw error;
  }

  return count || 0;
}

/**
 * Update group status
 */
export async function updateGroupStatus(groupId: string, status: GroupStatus): Promise<void> {
  const updates: any = { status };
  
  // If starting the group, set starts_at
  if (status === 'in_progress') {
    updates.starts_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from(Tables.GROUPS)
    .update(updates)
    .eq('id', groupId);

  if (error) {
    console.error('Error updating group status:', error);
    throw error;
  }
}

/**
 * Cancel a group
 */
export async function cancelGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.GROUPS)
    .update({ status: 'cancelled' as GroupStatus })
    .eq('id', groupId);

  if (error) {
    console.error('Error cancelling group:', error);
    throw error;
  }
}

/**
 * Increment player count and update status if full
 */
export async function incrementPlayerCount(groupId: string): Promise<Group> {
  // Get current group
  const { data: group, error: fetchError } = await supabase
    .from(Tables.GROUPS)
    .select('current_players, max_players')
    .eq('id', groupId)
    .single();

  if (fetchError) {
    console.error('Error fetching group for increment:', fetchError);
    throw fetchError;
  }

  const newCount = group.current_players + 1;
  const newStatus = newCount >= group.max_players ? 'full' : 'open';

  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .update({
      current_players: newCount,
      status: newStatus as GroupStatus,
    })
    .eq('id', groupId)
    .select()
    .single();

  if (error) {
    console.error('Error incrementing player count:', error);
    throw error;
  }

  return data;
}

/**
 * Decrement player count and update status if was full
 */
export async function decrementPlayerCount(groupId: string): Promise<Group> {
  // Get current group
  const { data: group, error: fetchError } = await supabase
    .from(Tables.GROUPS)
    .select('current_players, status')
    .eq('id', groupId)
    .single();

  if (fetchError) {
    console.error('Error fetching group for decrement:', fetchError);
    throw fetchError;
  }

  const newCount = Math.max(0, group.current_players - 1);
  // If was full, go back to open
  const newStatus = group.status === 'full' ? 'open' : group.status;

  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .update({
      current_players: newCount,
      status: newStatus as GroupStatus,
    })
    .eq('id', groupId)
    .select()
    .single();

  if (error) {
    console.error('Error decrementing player count:', error);
    throw error;
  }

  return data;
}

// ============================================================================
// GROUP MEMBERS
// ============================================================================

/**
 * Add a member to a group
 */
export async function addGroupMember(groupId: string, userId: string): Promise<GroupMember> {
  const { data, error } = await supabase
    .from(Tables.GROUP_MEMBERS)
    .insert({
      group_id: groupId,
      user_id: userId,
      status: 'active' as MemberStatus,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding group member:', error);
    throw error;
  }

  return data;
}

/**
 * Remove a member from a group (mark as left)
 */
export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.GROUP_MEMBERS)
    .update({
      status: 'left' as MemberStatus,
      left_at: new Date().toISOString(),
    })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error removing group member:', error);
    throw error;
  }
}

/**
 * Get active members of a group
 */
export async function getGroupMembers(groupId: string): Promise<GroupMemberWithUser[]> {
  const { data, error } = await supabase
    .from(Tables.GROUP_MEMBERS)
    .select(`
      *,
      users (
        first_name,
        username,
        telegram_id
      )
    `)
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('Error fetching group members:', error);
    throw error;
  }

  return (data || []).map((member: any) => ({
    ...member,
    user_name: member.users?.first_name || 'Unknown',
    user_username: member.users?.username,
    telegram_id: member.users?.telegram_id,
    users: undefined,
  }));
}

/**
 * Check if user is a member of a group
 */
export async function isUserInGroup(groupId: string, userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from(Tables.GROUP_MEMBERS)
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('Error checking group membership:', error);
    throw error;
  }

  return (count || 0) > 0;
}

/**
 * Get active groups a user is a member of
 */
export async function getUserActiveGroups(userId: string): Promise<GroupWithDetails[]> {
  // Get group IDs user is a member of
  const { data: memberships, error: memberError } = await supabase
    .from(Tables.GROUP_MEMBERS)
    .select('group_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (memberError) {
    console.error('Error fetching user memberships:', memberError);
    throw memberError;
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const groupIds = memberships.map(m => m.group_id);

  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .select(`
      *,
      users!groups_creator_id_fkey (
        first_name,
        username,
        telegram_id
      ),
      categories (
        name,
        icon
      ),
      resources (
        name
      )
    `)
    .in('id', groupIds)
    .in('status', ['open', 'full', 'in_progress'])
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Error fetching user groups:', error);
    throw error;
  }

  return (data || []).map(mapGroupWithDetails);
}

/**
 * Get count of active groups user is a member of
 */
export async function getUserActiveGroupCount(userId: string): Promise<number> {
  const { data: memberships, error } = await supabase
    .from(Tables.GROUP_MEMBERS)
    .select(`
      group_id,
      groups!inner (
        status
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('groups.status', ['open', 'full', 'in_progress']);

  if (error) {
    console.error('Error counting user groups:', error);
    throw error;
  }

  return memberships?.length || 0;
}

/**
 * Check if user can join a group (validation)
 */
export async function canUserJoinGroup(
  userId: string,
  groupId: string
): Promise<{ canJoin: boolean; reason?: string }> {
  // Check if already in group
  const isMember = await isUserInGroup(groupId, userId);
  if (isMember) {
    return { canJoin: false, reason: 'You are already in this group.' };
  }

  // Check group status and capacity
  const group = await getGroupById(groupId);
  if (!group) {
    return { canJoin: false, reason: 'Group not found.' };
  }

  if (group.status === 'full') {
    return { canJoin: false, reason: 'This group is full.' };
  }

  if (group.status === 'cancelled') {
    return { canJoin: false, reason: 'This group has been cancelled.' };
  }

  if (group.status === 'completed') {
    return { canJoin: false, reason: 'This group has ended.' };
  }

  // Check user's active group count
  const activeCount = await getUserActiveGroupCount(userId);
  if (activeCount >= CONFIG.MAX_GROUP_MEMBERSHIPS) {
    return {
      canJoin: false,
      reason: `You can only be in ${CONFIG.MAX_GROUP_MEMBERSHIPS} groups at a time.`,
    };
  }

  return { canJoin: true };
}

// ============================================================================
// CATEGORY GROUP COUNTS (for browse)
// ============================================================================

/**
 * Get count of active groups per category for a hostel
 */
export async function getGroupCountsByCategory(
  hostelId: string
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .select('category_id')
    .eq('hostel_id', hostelId)
    .in('status', ['open', 'full', 'in_progress']);

  if (error) {
    console.error('Error fetching group counts:', error);
    throw error;
  }

  const counts = new Map<string, number>();
  for (const group of data || []) {
    const count = counts.get(group.category_id) || 0;
    counts.set(group.category_id, count + 1);
  }

  return counts;
}

// ============================================================================
// EXPIRY & CLEANUP
// ============================================================================

/**
 * Get expired groups that need to be marked as completed
 */
export async function getExpiredGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .select('*')
    .in('status', ['open', 'full', 'in_progress'])
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Error fetching expired groups:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get groups starting soon (for notifications)
 */
export async function getGroupsStartingSoon(
  minutesBefore: number = CONFIG.GROUP_START_NOTIFICATION_MINUTES
): Promise<Group[]> {
  const now = new Date();
  const soon = addMinutes(now, minutesBefore);

  const { data, error } = await supabase
    .from(Tables.GROUPS)
    .select('*')
    .in('status', ['open', 'full'])
    .eq('notified_starting_soon', false)
    .gte('scheduled_for', now.toISOString())
    .lte('scheduled_for', soon.toISOString());

  if (error) {
    console.error('Error fetching groups starting soon:', error);
    throw error;
  }

  return data || [];
}

/**
 * Mark group as notified for starting soon
 */
export async function markGroupNotified(groupId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.GROUPS)
    .update({ notified_starting_soon: true })
    .eq('id', groupId);

  if (error) {
    console.error('Error marking group as notified:', error);
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map database result to GroupWithDetails
 */
function mapGroupWithDetails(data: any): GroupWithDetails {
  return {
    ...data,
    creator_name: data.users?.first_name || 'Unknown',
    creator_username: data.users?.username,
    category_name: data.categories?.name || 'Unknown',
    category_icon: data.categories?.icon || '🎮',
    resource_name: data.resources?.name,
    users: undefined,
    categories: undefined,
    resources: undefined,
  };
}
