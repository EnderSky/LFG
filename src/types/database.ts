// Database types generated from Supabase schema

export type UserStatus = 'pending' | 'approved' | 'banned';
export type GroupStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';
export type ResourceSessionStatus = 'active' | 'completed' | 'expired';
export type MemberStatus = 'active' | 'left';

export interface Hostel {
  id: string;
  name: string;
  slug: string;
  telegram_channel_id: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  hostel_id: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Admin {
  id: string;
  user_id: string;
  hostel_id: string;
  is_super_admin: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  hostel_id: string | null;
  name: string;
  icon: string;
  is_global: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Resource {
  id: string;
  hostel_id: string;
  name: string;
  category_id: string | null;
  description: string | null;
  max_duration_hours: number;
  created_at: string;
  updated_at: string;
}

export interface ResourceSession {
  id: string;
  resource_id: string;
  user_id: string;
  group_id: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  auto_checkout_at: string;
  status: ResourceSessionStatus;
  warned_expiring: boolean;
}

export interface Group {
  id: string;
  hostel_id: string;
  creator_id: string;
  category_id: string;
  title: string;
  description: string | null;
  max_players: number;
  current_players: number;
  resource_id: string | null;
  scheduled_for: string;
  starts_at: string | null;
  expires_at: string;
  status: GroupStatus;
  notified_starting_soon: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  status: MemberStatus;
}

// Database table names
export const Tables = {
  HOSTELS: 'hostels',
  USERS: 'users',
  ADMINS: 'admins',
  CATEGORIES: 'categories',
  RESOURCES: 'resources',
  RESOURCE_SESSIONS: 'resource_sessions',
  GROUPS: 'groups',
  GROUP_MEMBERS: 'group_members',
} as const;
