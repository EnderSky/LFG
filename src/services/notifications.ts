import { Bot } from 'grammy';
import { BotContext } from '../types/index.js';
import { getAdminUsersForHostel } from './admins.js';

/**
 * Notification service for sending messages to users
 */

let botInstance: Bot<BotContext> | null = null;

/**
 * Initialize the notification service with bot instance
 */
export function initNotifications(bot: Bot<BotContext>): void {
  botInstance = bot;
}

/**
 * Send notification to a single user
 */
export async function notifyUser(
  telegramId: number,
  message: string
): Promise<boolean> {
  if (!botInstance) {
    console.error('Bot instance not initialized for notifications');
    return false;
  }

  try {
    await botInstance.api.sendMessage(telegramId, message, {
      parse_mode: 'HTML',
    });
    return true;
  } catch (error) {
    console.error(`Failed to send notification to user ${telegramId}:`, error);
    return false;
  }
}

/**
 * Notify all admins of a hostel
 */
export async function notifyAdmins(
  hostelId: string,
  message: string
): Promise<void> {
  const admins = await getAdminUsersForHostel(hostelId);
  
  for (const admin of admins) {
    await notifyUser(admin.telegram_id, message);
  }
}

/**
 * Notify user of approval
 */
export async function notifyUserApproved(telegramId: number): Promise<void> {
  const message = `You've been approved! 🎉\n\nYou can now use the bot. Send /help to see what you can do.`;
  await notifyUser(telegramId, message);
}

/**
 * Notify user of rejection
 */
export async function notifyUserRejected(telegramId: number): Promise<void> {
  const message = `Sorry, your access request was not approved. ❌\n\nIf you think this is a mistake, please contact the hostel staff.`;
  await notifyUser(telegramId, message);
}

/**
 * Notify admins of pending user
 */
export async function notifyAdminsOfPendingUser(
  hostelId: string,
  username: string | null,
  firstName: string,
  userId: string
): Promise<void> {
  const userDisplay = username ? `@${username}` : firstName;
  const message = `🔔 New user ${userDisplay} (${firstName}) wants to join your hostel.\n\nUser ID: ${userId}\n\nUse /admin to approve or reject.`;
  
  await notifyAdmins(hostelId, message);
}

/**
 * Notify group members that someone joined
 */
export async function notifyGroupMemberJoined(
  memberTelegramIds: number[],
  joinerUsername: string | null,
  joinerFirstName: string,
  groupTitle: string,
  currentPlayers: number,
  maxPlayers: number
): Promise<void> {
  const joinerDisplay = joinerUsername ? `@${joinerUsername}` : joinerFirstName;
  let message = `🔔 ${joinerDisplay} joined your group!\n\n${groupTitle}\n👥 ${currentPlayers}/${maxPlayers} players`;
  
  if (currentPlayers >= maxPlayers) {
    message += ` 🔴 Group is now full!`;
  }

  for (const telegramId of memberTelegramIds) {
    await notifyUser(telegramId, message);
  }
}

/**
 * Notify group members that it's starting soon
 */
export async function notifyGroupStartingSoon(
  memberTelegramIds: number[],
  groupTitle: string,
  minutesUntilStart: number,
  resourceName?: string
): Promise<void> {
  let message = `🔔 Your game starts in ${minutesUntilStart} minutes!\n\n${groupTitle}`;
  
  if (resourceName) {
    message += `\n📍 ${resourceName}`;
  }

  for (const telegramId of memberTelegramIds) {
    await notifyUser(telegramId, message);
  }
}

/**
 * Notify group members that the group was cancelled
 */
export async function notifyGroupCancelled(
  memberTelegramIds: number[],
  groupTitle: string,
  reason?: string
): Promise<void> {
  let message = `❌ Group cancelled: ${groupTitle}`;
  
  if (reason) {
    message += `\n\nReason: ${reason}`;
  }

  for (const telegramId of memberTelegramIds) {
    await notifyUser(telegramId, message);
  }
}

/**
 * Notify user of resource auto-checkout warning
 */
export async function notifyResourceAutoCheckoutWarning(
  telegramId: number,
  resourceName: string,
  minutesRemaining: number
): Promise<void> {
  const message = `⚠️ Your ${resourceName} session will auto-checkout in ${minutesRemaining} minutes.\n\nUse /checkout to check out early, or your session will end automatically.`;
  await notifyUser(telegramId, message);
}

/**
 * Notify user of resource auto-checkout
 */
export async function notifyResourceAutoCheckedOut(
  telegramId: number,
  resourceName: string
): Promise<void> {
  const message = `ℹ️ You've been automatically checked out of ${resourceName}.\n\nThanks for using the resource! 🙏`;
  await notifyUser(telegramId, message);
}
