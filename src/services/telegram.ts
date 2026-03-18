import { Bot } from 'grammy';
import { BotContext } from '../types/index.js';
import { GroupWithDetails } from './groups.js';
import { getHostelById } from './hostels.js';
import { EMOJI } from '../utils/constants.js';
import { formatTimeRemaining, formatTimestamp } from '../utils/datetime.js';

/**
 * Telegram-specific operations (channel posting, etc.)
 */

// Store bot reference for posting
let botInstance: Bot<BotContext> | null = null;

/**
 * Initialize telegram service with bot instance
 */
export function initTelegramService(bot: Bot<BotContext>): void {
  botInstance = bot;
}

/**
 * Format group announcement message for channel
 */
export function formatGroupAnnouncement(group: GroupWithDetails): string {
  const scheduledTime = new Date(group.scheduled_for);
  const isNow = scheduledTime.getTime() <= Date.now() + 60000; // Within 1 minute

  let message = `${group.category_icon} <b>LFG: ${group.title}</b>\n\n`;

  if (group.description) {
    message += `${group.description}\n\n`;
  }

  message += `${EMOJI.CATEGORY} Category: ${group.category_name}\n`;
  message += `${EMOJI.PLAYERS} Players: ${group.current_players}/${group.max_players}\n`;

  if (isNow) {
    message += `${EMOJI.NOW} Starting: Now\n`;
  } else {
    message += `${EMOJI.CLOCK} Starting: ${formatTimestamp(scheduledTime)} (${formatTimeRemaining(scheduledTime)})\n`;
  }

  if (group.resource_name) {
    message += `${EMOJI.LOCATION} Resource: ${group.resource_name}\n`;
  }

  message += `\n${EMOJI.USER} Created by: ${group.creator_username ? `@${group.creator_username}` : group.creator_name}`;

  message += `\n\n${EMOJI.JOIN} To join, message the bot and use /browse`;

  return message;
}

/**
 * Post group announcement to hostel channel
 */
export async function postGroupToChannel(group: GroupWithDetails): Promise<boolean> {
  if (!botInstance) {
    console.error('Telegram service not initialized');
    return false;
  }

  try {
    // Get hostel to find channel ID
    const hostel = await getHostelById(group.hostel_id);

    if (!hostel?.telegram_channel_id) {
      console.log(`No channel configured for hostel ${group.hostel_id}`);
      return false;
    }

    const message = formatGroupAnnouncement(group);

    await botInstance.api.sendMessage(hostel.telegram_channel_id, message, {
      parse_mode: 'HTML',
    });

    console.log(`Posted group ${group.id} to channel ${hostel.telegram_channel_id}`);
    return true;
  } catch (error: any) {
    console.error('Error posting to channel:', error);

    // Common errors:
    // - 400 Bad Request: chat not found
    // - 403 Forbidden: bot not admin in channel
    if (error.description?.includes('chat not found')) {
      console.error('Channel not found. Check telegram_channel_id in hostel config.');
    } else if (error.description?.includes('not enough rights')) {
      console.error('Bot is not an admin in the channel.');
    }

    return false;
  }
}

/**
 * Send notification to a user
 */
export async function sendUserNotification(
  telegramId: number,
  message: string
): Promise<boolean> {
  if (!botInstance) {
    console.error('Telegram service not initialized');
    return false;
  }

  try {
    await botInstance.api.sendMessage(telegramId, message, {
      parse_mode: 'HTML',
    });
    return true;
  } catch (error: any) {
    console.error(`Error sending notification to ${telegramId}:`, error);

    // User may have blocked the bot
    if (error.description?.includes('bot was blocked')) {
      console.log(`User ${telegramId} has blocked the bot`);
    }

    return false;
  }
}

/**
 * Format group update message for members
 */
export function formatGroupUpdateMessage(
  group: GroupWithDetails,
  updateType: 'joined' | 'left' | 'full' | 'cancelled' | 'starting_soon',
  userName?: string
): string {
  const groupTitle = `${group.category_icon} ${group.title}`;

  switch (updateType) {
    case 'joined':
      return `${EMOJI.JOIN} <b>${userName}</b> joined ${groupTitle}\n\n` +
        `${EMOJI.PLAYERS} Players: ${group.current_players}/${group.max_players}`;

    case 'left':
      return `${EMOJI.LEAVE} <b>${userName}</b> left ${groupTitle}\n\n` +
        `${EMOJI.PLAYERS} Players: ${group.current_players}/${group.max_players}`;

    case 'full':
      return `${EMOJI.FULL} ${groupTitle} is now full!\n\n` +
        `${EMOJI.PLAYERS} All ${group.max_players} players ready.`;

    case 'cancelled':
      return `${EMOJI.CANCEL} ${groupTitle} has been cancelled.`;

    case 'starting_soon':
      return `${EMOJI.NOTIFICATION} ${groupTitle} is starting soon!\n\n` +
        `${EMOJI.CLOCK} Starting in ${formatTimeRemaining(new Date(group.scheduled_for))}`;

    default:
      return `Update for ${groupTitle}`;
  }
}

/**
 * Notify all members of a group
 */
export async function notifyGroupMembers(
  members: { telegram_id: number }[],
  message: string,
  excludeTelegramId?: number
): Promise<void> {
  if (!botInstance) {
    console.error('Telegram service not initialized');
    return;
  }

  const sendPromises = members
    .filter(m => m.telegram_id !== excludeTelegramId)
    .map(member => sendUserNotification(member.telegram_id, message));

  await Promise.allSettled(sendPromises);
}
