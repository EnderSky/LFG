import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import {
  getGroupById,
  canUserJoinGroup,
  addGroupMember,
  removeGroupMember,
  incrementPlayerCount,
  decrementPlayerCount,
  cancelGroup,
  getGroupMembers,
  getUserActiveGroups,
  GroupWithDetails,
} from '../services/groups.js';
import { checkOutResourceByUser } from '../services/resources.js';
import {
  formatGroupUpdateMessage,
  notifyGroupMembers,
} from '../services/telegram.js';
import { EMOJI } from '../utils/constants.js';
import { formatTimeRemaining, formatTimestamp } from '../utils/datetime.js';

/**
 * Group action handlers (join, leave, cancel)
 */

/**
 * Handle join group callback
 */
export async function handleJoinGroup(ctx: BotContext, groupId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery('❌ Authentication required.');
    return;
  }

  try {
    // Check if user can join
    const { canJoin, reason } = await canUserJoinGroup(ctx.dbUser.id, groupId);

    if (!canJoin) {
      await ctx.answerCallbackQuery(reason || 'Cannot join this group.');
      return;
    }

    // Add user to group
    await addGroupMember(groupId, ctx.dbUser.id);
    const updatedGroup = await incrementPlayerCount(groupId);

    await ctx.answerCallbackQuery('Joined group!');

    // Get updated group details
    const group = await getGroupById(groupId);
    if (!group) return;

    // Notify other members
    const members = await getGroupMembers(groupId);
    const userName = ctx.dbUser.username ? `@${ctx.dbUser.username}` : ctx.dbUser.first_name;
    const message = formatGroupUpdateMessage(group, 'joined', userName);
    await notifyGroupMembers(members, message, ctx.from?.id);

    // If group is now full, notify everyone
    if (updatedGroup.status === 'full') {
      const fullMessage = formatGroupUpdateMessage(group, 'full');
      await notifyGroupMembers(members, fullMessage);
    }

    // Refresh the group view
    await showGroupDetails(ctx, group);
  } catch (error) {
    console.error('Error joining group:', error);
    await ctx.answerCallbackQuery('❌ Error joining group.');
  }
}

/**
 * Handle leave group callback
 */
export async function handleLeaveGroup(ctx: BotContext, groupId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery('❌ Authentication required.');
    return;
  }

  try {
    const group = await getGroupById(groupId);
    if (!group) {
      await ctx.answerCallbackQuery('Group not found.');
      return;
    }

    // Check if user is the creator
    if (group.creator_id === ctx.dbUser.id) {
      await ctx.answerCallbackQuery('Creators must cancel the group, not leave.');
      return;
    }

    // Get members before leaving (for notification)
    const membersBefore = await getGroupMembers(groupId);

    // Remove user from group
    await removeGroupMember(groupId, ctx.dbUser.id);
    await decrementPlayerCount(groupId);

    await ctx.answerCallbackQuery('Left the group.');

    // Notify remaining members
    const userName = ctx.dbUser.username ? `@${ctx.dbUser.username}` : ctx.dbUser.first_name;
    const updatedGroup = await getGroupById(groupId);
    if (updatedGroup) {
      const message = formatGroupUpdateMessage(updatedGroup, 'left', userName);
      await notifyGroupMembers(membersBefore, message, ctx.from?.id);
    }

    // Show confirmation
    const keyboard = new InlineKeyboard()
      .text('📋 Browse Groups', 'browse:main')
      .row()
      .text(`${EMOJI.JOIN} Create Group`, 'lfg:start');

    await ctx.editMessageText(
      `${EMOJI.LEAVE} You have left <b>${group.title}</b>.\n\n` +
      `You can browse other groups or create your own.`,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    console.error('Error leaving group:', error);
    await ctx.answerCallbackQuery('❌ Error leaving group.');
  }
}

/**
 * Handle cancel group callback
 */
export async function handleCancelGroup(ctx: BotContext, groupId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery('❌ Authentication required.');
    return;
  }

  try {
    const group = await getGroupById(groupId);
    if (!group) {
      await ctx.answerCallbackQuery('Group not found.');
      return;
    }

    // Verify user is the creator
    if (group.creator_id !== ctx.dbUser.id) {
      await ctx.answerCallbackQuery('Only the creator can cancel this group.');
      return;
    }

    // Get members before cancelling (for notification)
    const members = await getGroupMembers(groupId);

    // Cancel the group
    await cancelGroup(groupId);

    // If group had a resource, check it out
    if (group.resource_id) {
      try {
        await checkOutResourceByUser(group.resource_id, ctx.dbUser.id);
      } catch (error) {
        console.error('Error checking out resource on cancel:', error);
      }
    }

    await ctx.answerCallbackQuery('Group cancelled.');

    // Notify all members
    const message = formatGroupUpdateMessage(group, 'cancelled');
    await notifyGroupMembers(members, message, ctx.from?.id);

    // Show confirmation
    const keyboard = new InlineKeyboard()
      .text('📋 Browse Groups', 'browse:main')
      .row()
      .text(`${EMOJI.JOIN} Create New Group`, 'lfg:start');

    await ctx.editMessageText(
      `${EMOJI.CANCEL} <b>${group.title}</b> has been cancelled.\n\n` +
      `All members have been notified.`,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    console.error('Error cancelling group:', error);
    await ctx.answerCallbackQuery('❌ Error cancelling group.');
  }
}

/**
 * Handle /mygroups command
 */
export async function handleMyGroups(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.reply('❌ Authentication required. Please /start first.');
    return;
  }

  try {
    const groups = await getUserActiveGroups(ctx.dbUser.id);

    if (groups.length === 0) {
      const keyboard = new InlineKeyboard()
        .text('📋 Browse Groups', 'browse:main')
        .row()
        .text(`${EMOJI.JOIN} Create Group`, 'lfg:start');

      const message = `${EMOJI.INFO} You're not in any active groups.\n\n` +
        `Use /browse to find groups or /lfg to create one!`;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { reply_markup: keyboard });
      } else {
        await ctx.reply(message, { reply_markup: keyboard });
      }
      return;
    }

    let message = `${EMOJI.PLAYERS} <b>Your Active Groups</b>\n\n`;

    const keyboard = new InlineKeyboard();

    for (const group of groups) {
      const isCreator = group.creator_id === ctx.dbUser.id;
      const scheduledTime = new Date(group.scheduled_for);
      const isNow = scheduledTime.getTime() <= Date.now() + 60000;
      const timeText = isNow ? 'Now' : formatTimeRemaining(scheduledTime);

      message += `${group.category_icon} <b>${group.title}</b>`;
      if (isCreator) message += ` 👑`;
      message += `\n`;
      message += `   ${EMOJI.PLAYERS} ${group.current_players}/${group.max_players}`;
      message += ` • ${EMOJI.CLOCK} ${timeText}\n\n`;

      keyboard.text(`${group.category_icon} ${group.title}`, `group:view:${group.id}`).row();
    }

    message += `\n👑 = You created this group`;

    keyboard.text(`${EMOJI.JOIN} Create New Group`, 'lfg:start');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });
    } else {
      await ctx.reply(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });
    }
  } catch (error) {
    console.error('Error in mygroups:', error);
    await ctx.reply('❌ Error loading your groups. Please try again.');
  }
}

/**
 * Show group details (shared helper)
 */
async function showGroupDetails(ctx: BotContext, group: GroupWithDetails): Promise<void> {
  if (!ctx.dbUser) return;

  const { isUserInGroup } = await import('../services/groups.js');
  const isMember = await isUserInGroup(group.id, ctx.dbUser.id);
  const isCreator = group.creator_id === ctx.dbUser.id;

  const scheduledTime = new Date(group.scheduled_for);
  const isNow = scheduledTime.getTime() <= Date.now() + 60000;

  let message = `${group.category_icon} <b>${group.title}</b>\n\n`;

  if (group.description) {
    message += `${group.description}\n\n`;
  }

  message += `${EMOJI.CATEGORY} Category: ${group.category_name}\n`;
  message += `${EMOJI.PLAYERS} Players: ${group.current_players}/${group.max_players}`;

  if (group.status === 'full') {
    message += ` ${EMOJI.FULL}\n`;
  } else {
    message += ` ${EMOJI.AVAILABLE}\n`;
  }

  if (isNow) {
    message += `${EMOJI.NOW} Starting: Now\n`;
  } else {
    message += `${EMOJI.CLOCK} Starting: ${formatTimestamp(scheduledTime)} (${formatTimeRemaining(scheduledTime)})\n`;
  }

  if (group.resource_name) {
    message += `${EMOJI.LOCATION} Resource: ${group.resource_name}\n`;
  }

  message += `\n${EMOJI.USER} Created by: ${group.creator_username ? `@${group.creator_username}` : group.creator_name}`;

  if (isMember) {
    message += `\n\n${EMOJI.SUCCESS} You are in this group!`;
  }

  const keyboard = new InlineKeyboard();

  if (isMember) {
    if (isCreator) {
      keyboard.text(`${EMOJI.CANCEL} Cancel Group`, `group:cancel:${group.id}`).row();
    } else {
      keyboard.text(`${EMOJI.LEAVE} Leave Group`, `group:leave:${group.id}`).row();
    }
  } else if (group.status !== 'full' && group.status !== 'cancelled' && group.status !== 'completed') {
    keyboard.text(`${EMOJI.JOIN} Join Group`, `group:join:${group.id}`).row();
  }

  keyboard.text(`${EMOJI.BACK} Back`, 'browse:main');

  await ctx.editMessageText(message, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
  });
}
