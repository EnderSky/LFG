import { CONFIG } from './utils/constants.js';
import {
  getExpiredGroups,
  getGroupsStartingSoon,
  getGroupMembers,
  markGroupNotified,
  updateGroupStatus,
} from './services/groups.js';
import {
  getExpiredSessions,
  markSessionsExpired,
  getResourceById,
} from './services/resources.js';
import {
  notifyGroupStartingSoon,
  notifyGroupCancelled,
  notifyResourceAutoCheckedOut,
  notifyResourceAutoCheckoutWarning,
} from './services/notifications.js';
import { supabase } from './services/database.js';
import { Tables } from './types/database.js';
import { addMinutes } from './utils/datetime.js';

/**
 * Background scheduler for automated tasks
 * Uses setInterval for local development
 */

let notificationInterval: NodeJS.Timeout | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;
let archiveInterval: NodeJS.Timeout | null = null;

/**
 * Start all scheduler jobs
 */
export function startScheduler(): void {
  console.log('Starting background scheduler...');

  // Notification check job - runs every 5 minutes
  const notificationMs = CONFIG.NOTIFICATION_CHECK_INTERVAL_MS;
  console.log(`  - Notification check: every ${notificationMs / 60000} minutes`);
  notificationInterval = setInterval(runNotificationCheck, notificationMs);

  // Cleanup job - runs every 15 minutes
  const cleanupMs = CONFIG.CLEANUP_INTERVAL_MS;
  console.log(`  - Cleanup job: every ${cleanupMs / 60000} minutes`);
  cleanupInterval = setInterval(runCleanupJob, cleanupMs);

  // Archive job - runs every hour
  const archiveMs = CONFIG.ARCHIVE_INTERVAL_MS;
  console.log(`  - Archive job: every ${archiveMs / 3600000} hour(s)`);
  archiveInterval = setInterval(runArchiveJob, archiveMs);

  // Run initial checks after a short delay
  setTimeout(() => {
    console.log('Running initial scheduler checks...');
    runNotificationCheck();
    runCleanupJob();
  }, 5000);

  console.log('Scheduler started successfully\n');
}

/**
 * Stop all scheduler jobs
 */
export function stopScheduler(): void {
  console.log('Stopping scheduler...');

  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  if (archiveInterval) {
    clearInterval(archiveInterval);
    archiveInterval = null;
  }

  console.log('Scheduler stopped');
}

// ============================================================================
// NOTIFICATION CHECK JOB
// ============================================================================

/**
 * Check for groups starting soon and resources expiring soon
 * Sends notifications to relevant users
 */
async function runNotificationCheck(): Promise<void> {
  try {
    await checkGroupsStartingSoon();
    await checkResourcesExpiringSoon();
  } catch (error) {
    console.error('Error in notification check job:', error);
  }
}

/**
 * Find groups starting soon and notify members
 */
async function checkGroupsStartingSoon(): Promise<void> {
  try {
    const groups = await getGroupsStartingSoon();

    if (groups.length === 0) return;

    console.log(`[Scheduler] Found ${groups.length} group(s) starting soon`);

    for (const group of groups) {
      try {
        // Get all members
        const members = await getGroupMembers(group.id);
        const telegramIds = members.map(m => m.telegram_id);

        // Get resource name if any
        let resourceName: string | undefined;
        if (group.resource_id) {
          const resource = await getResourceById(group.resource_id);
          resourceName = resource?.name;
        }

        // Calculate minutes until start
        const scheduledFor = new Date(group.scheduled_for);
        const now = new Date();
        const minutesUntilStart = Math.max(0, Math.round((scheduledFor.getTime() - now.getTime()) / 60000));

        // Send notifications
        await notifyGroupStartingSoon(telegramIds, group.title, minutesUntilStart, resourceName);

        // Mark as notified
        await markGroupNotified(group.id);

        console.log(`[Scheduler] Notified ${telegramIds.length} members for group: ${group.title}`);
      } catch (error) {
        console.error(`[Scheduler] Error notifying for group ${group.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error checking groups starting soon:', error);
  }
}

/**
 * Find resource sessions expiring soon and warn users
 */
async function checkResourcesExpiringSoon(): Promise<void> {
  try {
    const now = new Date();
    const warningTime = addMinutes(now, CONFIG.RESOURCE_AUTO_CHECKOUT_WARNING_MINUTES);

    // Find sessions that will expire within the warning window and haven't been warned
    const { data: sessions, error } = await supabase
      .from(Tables.RESOURCE_SESSIONS)
      .select(`
        *,
        resources (name),
        users (telegram_id)
      `)
      .eq('status', 'active')
      .eq('warned_expiring', false)
      .gte('auto_checkout_at', now.toISOString())
      .lte('auto_checkout_at', warningTime.toISOString());

    if (error) {
      console.error('[Scheduler] Error fetching sessions expiring soon:', error);
      return;
    }

    if (!sessions || sessions.length === 0) return;

    console.log(`[Scheduler] Found ${sessions.length} resource session(s) expiring soon`);

    for (const session of sessions) {
      try {
        const telegramId = (session as any).users?.telegram_id;
        const resourceName = (session as any).resources?.name || 'Resource';

        if (!telegramId) continue;

        // Calculate minutes remaining
        const autoCheckoutAt = new Date(session.auto_checkout_at);
        const minutesRemaining = Math.max(0, Math.round((autoCheckoutAt.getTime() - now.getTime()) / 60000));

        // Send warning
        await notifyResourceAutoCheckoutWarning(telegramId, resourceName, minutesRemaining);

        // Mark as warned
        await supabase
          .from(Tables.RESOURCE_SESSIONS)
          .update({ warned_expiring: true })
          .eq('id', session.id);

        console.log(`[Scheduler] Warned user ${telegramId} about ${resourceName} expiring`);
      } catch (error) {
        console.error(`[Scheduler] Error warning for session ${session.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error checking resources expiring soon:', error);
  }
}

// ============================================================================
// CLEANUP JOB
// ============================================================================

/**
 * Clean up expired groups and auto-checkout expired resource sessions
 */
async function runCleanupJob(): Promise<void> {
  try {
    await expireGroups();
    await autoCheckoutResources();
  } catch (error) {
    console.error('Error in cleanup job:', error);
  }
}

/**
 * Mark expired groups as completed
 */
async function expireGroups(): Promise<void> {
  try {
    const expiredGroups = await getExpiredGroups();

    if (expiredGroups.length === 0) return;

    console.log(`[Scheduler] Found ${expiredGroups.length} expired group(s)`);

    for (const group of expiredGroups) {
      try {
        // Get members for notification
        const members = await getGroupMembers(group.id);
        const telegramIds = members.map(m => m.telegram_id);

        // Update status to completed
        await updateGroupStatus(group.id, 'completed');

        // Notify members
        if (telegramIds.length > 0) {
          await notifyGroupCancelled(telegramIds, group.title, 'Group time has expired');
        }

        // TODO: Free associated resource if any
        // This would require checking out the resource session linked to this group

        console.log(`[Scheduler] Expired group: ${group.title}`);
      } catch (error) {
        console.error(`[Scheduler] Error expiring group ${group.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error expiring groups:', error);
  }
}

/**
 * Auto-checkout expired resource sessions
 */
async function autoCheckoutResources(): Promise<void> {
  try {
    const expiredSessions = await getExpiredSessions();

    if (expiredSessions.length === 0) return;

    console.log(`[Scheduler] Found ${expiredSessions.length} expired resource session(s)`);

    // Get session details for notifications
    const sessionIds = expiredSessions.map(s => s.id);

    // Fetch with user and resource info
    const { data: sessionsWithDetails, error } = await supabase
      .from(Tables.RESOURCE_SESSIONS)
      .select(`
        *,
        resources (name),
        users (telegram_id)
      `)
      .in('id', sessionIds);

    if (error) {
      console.error('[Scheduler] Error fetching session details:', error);
      return;
    }

    // Mark sessions as expired
    await markSessionsExpired(sessionIds);

    // Send notifications
    for (const session of sessionsWithDetails || []) {
      try {
        const telegramId = (session as any).users?.telegram_id;
        const resourceName = (session as any).resources?.name || 'Resource';

        if (telegramId) {
          await notifyResourceAutoCheckedOut(telegramId, resourceName);
          console.log(`[Scheduler] Auto-checked out ${resourceName} for user ${telegramId}`);
        }
      } catch (error) {
        console.error(`[Scheduler] Error notifying for session ${session.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error auto-checking out resources:', error);
  }
}

// ============================================================================
// ARCHIVE JOB
// ============================================================================

/**
 * Archive old data (groups older than 7 days, sessions older than 30 days)
 */
async function runArchiveJob(): Promise<void> {
  try {
    await archiveOldGroups();
    await archiveOldSessions();
  } catch (error) {
    console.error('Error in archive job:', error);
  }
}

/**
 * Delete groups older than configured retention period
 */
async function archiveOldGroups(): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONFIG.ARCHIVE_GROUPS_AFTER_DAYS);

    // First delete group members for old groups
    const { data: oldGroups, error: fetchError } = await supabase
      .from(Tables.GROUPS)
      .select('id')
      .in('status', ['completed', 'cancelled'])
      .lt('updated_at', cutoffDate.toISOString());

    if (fetchError) {
      console.error('[Scheduler] Error fetching old groups:', fetchError);
      return;
    }

    if (!oldGroups || oldGroups.length === 0) return;

    const groupIds = oldGroups.map(g => g.id);

    // Delete group members first
    const { error: memberError } = await supabase
      .from(Tables.GROUP_MEMBERS)
      .delete()
      .in('group_id', groupIds);

    if (memberError) {
      console.error('[Scheduler] Error deleting old group members:', memberError);
      return;
    }

    // Delete groups
    const { error: groupError } = await supabase
      .from(Tables.GROUPS)
      .delete()
      .in('id', groupIds);

    if (groupError) {
      console.error('[Scheduler] Error deleting old groups:', groupError);
      return;
    }

    console.log(`[Scheduler] Archived ${groupIds.length} old group(s)`);
  } catch (error) {
    console.error('[Scheduler] Error archiving old groups:', error);
  }
}

/**
 * Delete resource sessions older than configured retention period
 */
async function archiveOldSessions(): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONFIG.ARCHIVE_SESSIONS_AFTER_DAYS);

    const { data, error } = await supabase
      .from(Tables.RESOURCE_SESSIONS)
      .delete()
      .in('status', ['completed', 'expired'])
      .lt('checked_out_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('[Scheduler] Error archiving old sessions:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log(`[Scheduler] Archived ${data.length} old resource session(s)`);
    }
  } catch (error) {
    console.error('[Scheduler] Error archiving old sessions:', error);
  }
}
