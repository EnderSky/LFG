import { EMOJI } from './constants.js';
import { formatTimeRemaining } from './datetime.js';

/**
 * Message formatting utilities for consistent bot responses
 */

/**
 * Format a welcome message for new users
 */
export function formatWelcomeMessage(): string {
  return `Welcome to LFG! ${EMOJI.SUCCESS}

Looking For Groups helps you find friends to play games and use shared resources at your hostel.

To get started, please select your hostel below.`;
}

/**
 * Format a pending approval message
 */
export function formatPendingApprovalMessage(hostelName: string): string {
  return `Thanks! Your access request has been sent to the admins at ${hostelName}.

You'll be notified once approved! ${EMOJI.NOTIFICATION}`;
}

/**
 * Format an approval notification
 */
export function formatApprovedMessage(): string {
  return `You've been approved! ${EMOJI.SUCCESS}

You can now use the bot. Send /help to see what you can do.`;
}

/**
 * Format a rejection notification
 */
export function formatRejectedMessage(): string {
  return `Sorry, your access request was not approved. ${EMOJI.ERROR}

If you think this is a mistake, please contact the hostel staff.`;
}

/**
 * Format help message for regular users
 */
export function formatHelpMessage(): string {
  return `${EMOJI.INFO} Available Commands:

${EMOJI.PLAYERS} Groups:
/lfg - Create a new gaming group
/browse - Browse and join groups
/mygroups - View your active groups
/join <id> - Join a group by ID
/leave <id> - Leave a group

${EMOJI.LOCATION} Resources:
/resources - View available resources
/checkout - Check out of resources

${EMOJI.INFO} Other:
/help - Show this help message`;
}

/**
 * Format help message for admins
 */
export function formatAdminHelpMessage(): string {
  const userHelp = formatHelpMessage();
  return `${userHelp}

${EMOJI.ADMIN} Admin Commands:
/admin - Open admin panel
/approve <user_id> - Approve a user
/reject <user_id> - Reject a user
/cancel <group_id> - Cancel a group
/stats - View statistics`;
}

/**
 * Format error message
 */
export function formatErrorMessage(message: string): string {
  return `${EMOJI.ERROR} ${message}`;
}

/**
 * Format success message
 */
export function formatSuccessMessage(message: string): string {
  return `${EMOJI.SUCCESS} ${message}`;
}

/**
 * Format info message
 */
export function formatInfoMessage(message: string): string {
  return `${EMOJI.INFO} ${message}`;
}

/**
 * Format warning message
 */
export function formatWarningMessage(message: string): string {
  return `${EMOJI.WARNING} ${message}`;
}

/**
 * Format a group summary for display
 */
export function formatGroupSummary(group: {
  title: string;
  currentPlayers: number;
  maxPlayers: number;
  scheduledFor: Date;
  resourceName?: string;
  creatorUsername?: string;
}): string {
  const timeInfo = formatTimeRemaining(group.scheduledFor);
  const playersInfo = `${group.currentPlayers}/${group.maxPlayers}`;
  
  let message = `${group.title}\n`;
  message += `${EMOJI.PLAYERS} ${playersInfo} players`;
  
  if (group.currentPlayers >= group.maxPlayers) {
    message += ` ${EMOJI.FULL} FULL`;
  }
  
  message += `\n${EMOJI.CLOCK} `;
  if (timeInfo === 'Now' || timeInfo === 'Expired') {
    message += `${EMOJI.NOW} ${timeInfo}`;
  } else {
    message += `Starts in ${timeInfo}`;
  }
  
  if (group.resourceName) {
    message += `\n${EMOJI.LOCATION} ${group.resourceName}`;
  }
  
  if (group.creatorUsername) {
    message += `\n${EMOJI.USER} @${group.creatorUsername}`;
  }
  
  return message;
}

/**
 * Format resource status for display
 */
export function formatResourceStatus(resource: {
  name: string;
  description?: string;
  isAvailable: boolean;
  timeRemaining?: string;
  usedBy?: string;
}): string {
  const status = resource.isAvailable ? EMOJI.AVAILABLE : EMOJI.IN_USE;
  const statusText = resource.isAvailable ? 'Available' : 'In use';
  
  let message = `${status} ${resource.name} - ${statusText}`;
  
  if (resource.description) {
    message += `\n   ${resource.description}`;
  }
  
  if (!resource.isAvailable && resource.timeRemaining) {
    message += `\n   ${EMOJI.CLOCK} ${resource.timeRemaining} left`;
  }
  
  if (!resource.isAvailable && resource.usedBy) {
    message += `\n   Used by: ${resource.usedBy}`;
  }
  
  return message;
}

/**
 * Format a notification message for new group member
 */
export function formatMemberJoinedNotification(
  groupTitle: string,
  username: string,
  currentPlayers: number,
  maxPlayers: number
): string {
  let message = `${EMOJI.NOTIFICATION} @${username} joined your group!\n\n`;
  message += `${groupTitle}\n`;
  message += `${EMOJI.PLAYERS} ${currentPlayers}/${maxPlayers} players`;
  
  if (currentPlayers >= maxPlayers) {
    message += ` ${EMOJI.FULL} Group is now full!`;
  }
  
  return message;
}

/**
 * Format a group starting soon notification
 */
export function formatGroupStartingSoonNotification(
  groupTitle: string,
  minutesUntilStart: number,
  resourceName?: string
): string {
  let message = `${EMOJI.NOTIFICATION} Your game starts in ${minutesUntilStart} minutes!\n\n`;
  message += `${groupTitle}\n`;
  
  if (resourceName) {
    message += `${EMOJI.LOCATION} ${resourceName}`;
  }
  
  return message;
}

/**
 * Format admin panel welcome message
 */
export function formatAdminPanelMessage(adminName: string): string {
  return `${EMOJI.ADMIN} Admin Panel

Welcome, ${adminName}!

Select an option below:`;
}

/**
 * Format time ago (e.g., "2 hours ago", "3 days ago")
 * Used for showing when user registered
 */
export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}
