// Application constants and configuration

export const CONFIG = {
  // User limits
  MAX_ACTIVE_GROUPS_AS_CREATOR: 3,
  MAX_GROUP_MEMBERSHIPS: 5,
  MAX_ACTIVE_RESOURCE_SESSIONS: 2,

  // Group settings
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,
  DEFAULT_GROUP_EXPIRY_HOURS: 6,
  GROUP_START_NOTIFICATION_MINUTES: 15,

  // Resource settings
  DEFAULT_RESOURCE_MAX_HOURS: 6,
  RESOURCE_AUTO_CHECKOUT_WARNING_MINUTES: 30,

  // Rate limiting
  GROUP_CREATION_COOLDOWN_MS: 60000, // 1 minute
  RESOURCE_CHECKIN_COOLDOWN_MS: 30000, // 30 seconds

  // Scheduler intervals (from env or defaults)
  NOTIFICATION_CHECK_INTERVAL_MS: 300000, // 5 minutes
  CLEANUP_INTERVAL_MS: 900000, // 15 minutes
  ARCHIVE_INTERVAL_MS: 3600000, // 1 hour

  // Data retention
  ARCHIVE_GROUPS_AFTER_DAYS: 7,
  ARCHIVE_SESSIONS_AFTER_DAYS: 30,
} as const;

// Predefined global game categories
export const GLOBAL_CATEGORIES = [
  { name: 'Mahjong', icon: '🀄', order: 1 },
  { name: 'Nintendo Switch', icon: '🎮', order: 2 },
  { name: 'PlayStation', icon: '🎮', order: 3 },
  { name: 'Xbox', icon: '🎮', order: 4 },
  { name: 'Board Games', icon: '🎲', order: 5 },
  { name: 'Card Games', icon: '🃏', order: 6 },
  { name: 'Pool/Billiards', icon: '🎱', order: 7 },
  { name: 'Table Tennis', icon: '🏓', order: 8 },
  { name: 'Other', icon: '➕', order: 9 },
] as const;

// Emojis for UI
export const EMOJI = {
  // Status
  AVAILABLE: '✅',
  IN_USE: '🔴',
  FULL: '🔴',
  
  // Actions
  JOIN: '➕',
  LEAVE: '➖',
  CANCEL: '❌',
  APPROVE: '✅',
  REJECT: '❌',
  SKIP: '⏭️',
  BACK: '◀️',
  
  // Time
  NOW: '▶️',
  CLOCK: '⏰',
  CALENDAR: '📅',
  
  // Info
  PLAYERS: '👥',
  USER: '👤',
  ADMIN: '👨‍💼',
  LOCATION: '📍',
  NOTIFICATION: '🔔',
  STATS: '📊',
  SETTINGS: '⚙️',
  TOOLS: '🔧',
  CATEGORY: '🎮',
  
  // Success/Error
  SUCCESS: '🎉',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
} as const;

// Time presets for group scheduling (in minutes)
export const TIME_PRESETS = [
  { label: 'Now', minutes: 0, emoji: EMOJI.NOW },
  { label: 'In 30min', minutes: 30, emoji: EMOJI.CLOCK },
  { label: 'In 1hr', minutes: 60, emoji: EMOJI.CLOCK },
  { label: 'In 2hrs', minutes: 120, emoji: EMOJI.CLOCK },
  { label: 'Custom', minutes: -1, emoji: EMOJI.CALENDAR },
] as const;
