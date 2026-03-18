import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import { getGroupsByHostel, cancelGroup, getGroupById, getGroupMembers } from '../services/groups.js';
import { notifyGroupCancelled } from '../services/notifications.js';
import { EMOJI } from '../utils/constants.js';
import { formatTimeRemaining } from '../utils/datetime.js';

/**
 * Admin Group Management handlers
 * Allows admins to view and manage all active groups in their hostel
 */

const PAGE_SIZE = 5;

/**
 * Show admin groups menu
 * Callback: admin:groups
 */
export async function handleAdminGroups(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const groups = await getGroupsByHostel(ctx.dbUser.hostel_id);
    
    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.PLAYERS} View All Groups (${groups.length})`, 'admin:grp:list')
      .row()
      .text(`${EMOJI.BACK} Back to Admin Panel`, 'admin:panel');

    const message = `${EMOJI.PLAYERS} Active Groups Management

You have ${groups.length} active group${groups.length !== 1 ? 's' : ''} in your hostel.

Select an option below:`;

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Error showing admin groups menu:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading groups menu.');
  }
}

/**
 * Show paginated list of all active groups
 * Callback: admin:grp:list or admin:grp:list:<page>
 */
export async function handleAdminGroupList(
  ctx: BotContext,
  page: number = 1
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const allGroups = await getGroupsByHostel(ctx.dbUser.hostel_id);

    if (allGroups.length === 0) {
      const keyboard = new InlineKeyboard()
        .text(`${EMOJI.BACK} Back`, 'admin:groups');

      await ctx.editMessageText('No active groups at the moment. ✅', {
        reply_markup: keyboard,
      });
      return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(allGroups.length / PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;
    const groupsOnPage = allGroups.slice(startIdx, endIdx);

    // Build message
    let message = `${EMOJI.PLAYERS} Active Groups (${allGroups.length})\n`;
    message += `Page ${page}/${totalPages}\n\n`;

    const keyboard = new InlineKeyboard();

    for (const group of groupsOnPage) {
      const timeInfo = formatTimeRemaining(new Date(group.scheduled_for));
      const statusEmoji = group.status === 'full' ? EMOJI.FULL : 
                         group.status === 'in_progress' ? EMOJI.NOW : '';
      
      message += `${group.category_icon} <b>${group.title}</b> ${statusEmoji}\n`;
      message += `   ${EMOJI.PLAYERS} ${group.current_players}/${group.max_players} • `;
      message += `${EMOJI.CLOCK} ${timeInfo}\n`;
      message += `   ${EMOJI.USER} @${group.creator_username || group.creator_name}\n`;
      if (group.resource_name) {
        message += `   ${EMOJI.LOCATION} ${group.resource_name}\n`;
      }
      message += '\n';

      // Add view/cancel button for each group
      keyboard
        .text(`${group.category_icon} ${group.title.substring(0, 15)}`, `admin:grp:view:${group.id}`)
        .row();
    }

    // Add pagination controls if needed
    if (totalPages > 1) {
      if (page > 1) {
        keyboard.text(`${EMOJI.BACK} Prev`, `admin:grp:list:${page - 1}`);
      }
      keyboard.text(`Page ${page}/${totalPages}`, 'noop');
      if (page < totalPages) {
        keyboard.text(`Next ▶️`, `admin:grp:list:${page + 1}`);
      }
      keyboard.row();
    }

    // Back button
    keyboard.text(`${EMOJI.BACK} Back`, 'admin:groups');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing admin group list:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading groups.');
  }
}

/**
 * Show group details with admin actions
 * Callback: admin:grp:view:<groupId>
 */
export async function handleAdminGroupView(
  ctx: BotContext,
  groupId: string
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const group = await getGroupById(groupId);

    if (!group) {
      await ctx.answerCallbackQuery?.('❌ Group not found.');
      return;
    }

    // Get members
    const members = await getGroupMembers(groupId);

    // Build message
    let message = `${group.category_icon} <b>${group.title}</b>\n\n`;
    
    // Status
    const statusMap: Record<string, string> = {
      open: '🟢 Open',
      full: '🔴 Full',
      in_progress: '▶️ In Progress',
      completed: '✅ Completed',
      cancelled: '❌ Cancelled',
    };
    message += `<b>Status:</b> ${statusMap[group.status] || group.status}\n`;
    
    // Players
    message += `<b>Players:</b> ${group.current_players}/${group.max_players}\n`;
    
    // Time
    const timeInfo = formatTimeRemaining(new Date(group.scheduled_for));
    message += `<b>Scheduled:</b> ${timeInfo}\n`;
    
    // Resource
    if (group.resource_name) {
      message += `<b>Resource:</b> ${group.resource_name}\n`;
    }
    
    // Creator
    const creatorDisplay = group.creator_username 
      ? `@${group.creator_username}` 
      : group.creator_name;
    message += `<b>Created by:</b> ${creatorDisplay}\n`;
    
    // Members list
    message += '\n<b>Members:</b>\n';
    for (const member of members) {
      const memberDisplay = member.user_username 
        ? `@${member.user_username}` 
        : member.user_name;
      const isCreator = member.user_id === group.creator_id ? ' (Creator)' : '';
      message += `  • ${memberDisplay}${isCreator}\n`;
    }

    // Group ID for reference
    message += `\n<code>ID: ${group.id}</code>`;

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.CANCEL} Cancel Group`, `admin:grp:cancel:${groupId}`)
      .row()
      .text(`${EMOJI.BACK} Back to List`, 'admin:grp:list');

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing group details:', error);
    await ctx.answerCallbackQuery?.('❌ Error loading group details.');
  }
}

/**
 * Confirm group cancellation
 * Callback: admin:grp:cancel:<groupId>
 */
export async function handleAdminGroupCancel(
  ctx: BotContext,
  groupId: string
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const group = await getGroupById(groupId);

    if (!group) {
      await ctx.answerCallbackQuery?.('❌ Group not found.');
      return;
    }

    const message = `${EMOJI.WARNING} Are you sure you want to cancel this group?

${group.category_icon} <b>${group.title}</b>
${EMOJI.PLAYERS} ${group.current_players}/${group.max_players} players

All members will be notified.`;

    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.CANCEL} Yes, Cancel Group`, `admin:grp:confirm:${groupId}`)
      .row()
      .text(`${EMOJI.BACK} No, Go Back`, `admin:grp:view:${groupId}`);

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error('Error showing cancel confirmation:', error);
    await ctx.answerCallbackQuery?.('❌ Error.');
  }
}

/**
 * Confirm and execute group cancellation
 * Callback: admin:grp:confirm:<groupId>
 */
export async function handleAdminGroupConfirmCancel(
  ctx: BotContext,
  groupId: string
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    const group = await getGroupById(groupId);

    if (!group) {
      await ctx.answerCallbackQuery?.('❌ Group not found.');
      return;
    }

    // Get members before cancelling (for notifications)
    const members = await getGroupMembers(groupId);

    // Cancel the group
    await cancelGroup(groupId);

    // Notify all members
    const adminName = ctx.dbUser.username 
      ? `@${ctx.dbUser.username}` 
      : ctx.dbUser.first_name;
    
    const memberTelegramIds = members.map(m => m.telegram_id);
    
    try {
      await notifyGroupCancelled(
        memberTelegramIds,
        group.title,
        `Cancelled by admin ${adminName}`
      );
    } catch (notifyError) {
      console.error('Failed to notify members:', notifyError);
    }

    await ctx.answerCallbackQuery?.('✅ Group cancelled!');

    // Return to group list
    await handleAdminGroups(ctx);
  } catch (error) {
    console.error('Error cancelling group:', error);
    await ctx.answerCallbackQuery?.('❌ Error cancelling group.');
  }
}
