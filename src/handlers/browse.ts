import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import {
  getGroupsByHostel,
  getGroupsByCategory,
  getGroupCountsByCategory,
  getGroupById,
  GroupWithDetails,
} from '../services/groups.js';
import { getCategoriesForHostel } from '../services/categories.js';
import { EMOJI } from '../utils/constants.js';
import { formatTimeRemaining, formatTimestamp } from '../utils/datetime.js';

/**
 * Browse groups handler
 * Allows users to view and filter active groups
 */

const PAGE_SIZE = 5;

/**
 * /browse command - Show categories with group counts
 */
export async function handleBrowse(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.reply('❌ Authentication required. Please /start first.');
    return;
  }

  try {
    await showCategoriesWithCounts(ctx);
  } catch (error) {
    console.error('Error in browse:', error);
    await ctx.reply('❌ Error loading groups. Please try again.');
  }
}

/**
 * Show categories with active group counts
 */
async function showCategoriesWithCounts(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) return;

  const [categories, groupCounts] = await Promise.all([
    getCategoriesForHostel(ctx.dbUser.hostel_id),
    getGroupCountsByCategory(ctx.dbUser.hostel_id),
  ]);

  const keyboard = new InlineKeyboard();

  // "All Groups" option
  const totalGroups = Array.from(groupCounts.values()).reduce((a, b) => a + b, 0);
  keyboard.text(`📋 All Groups (${totalGroups})`, 'browse:all').row();

  // Categories with group counts
  for (const category of categories) {
    const count = groupCounts.get(category.id) || 0;
    if (count > 0) {
      keyboard.text(`${category.icon} ${category.name} (${count})`, `browse:category:${category.id}`).row();
    }
  }

  let message = `${EMOJI.CATEGORY} <b>Browse Groups</b>\n\n`;

  if (totalGroups === 0) {
    message += `No active groups at your hostel right now.\n\n`;
    message += `${EMOJI.JOIN} Use /lfg to create the first one!`;
  } else {
    message += `${totalGroups} active group${totalGroups > 1 ? 's' : ''} at your hostel.\n\n`;
    message += `Select a category to browse:`;
  }

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
}

/**
 * Show all groups for hostel
 */
export async function handleBrowseAll(ctx: BotContext, page: number = 1): Promise<void> {
  if (!ctx.dbUser) return;

  const groups = await getGroupsByHostel(ctx.dbUser.hostel_id);

  if (groups.length === 0) {
    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.JOIN} Create Group`, 'lfg:start')
      .row()
      .text(`${EMOJI.BACK} Back`, 'browse:main');

    await ctx.editMessageText(
      `${EMOJI.INFO} No active groups right now.\n\n` +
      `Be the first to create one!`,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      }
    );
    return;
  }

  await showGroupList(ctx, groups, 'All Groups', page, 'browse:all');
}

/**
 * Show groups by category
 */
export async function handleBrowseCategory(ctx: BotContext, categoryId: string, page: number = 1): Promise<void> {
  if (!ctx.dbUser) return;

  const [groups, categories] = await Promise.all([
    getGroupsByCategory(ctx.dbUser.hostel_id, categoryId),
    getCategoriesForHostel(ctx.dbUser.hostel_id),
  ]);

  const category = categories.find(c => c.id === categoryId);
  const categoryName = category ? `${category.icon} ${category.name}` : 'Category';

  if (groups.length === 0) {
    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.JOIN} Create Group`, 'lfg:start')
      .row()
      .text(`${EMOJI.BACK} Back`, 'browse:main');

    await ctx.editMessageText(
      `${EMOJI.INFO} No active groups in ${categoryName} right now.\n\n` +
      `Be the first to create one!`,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      }
    );
    return;
  }

  await showGroupList(ctx, groups, categoryName, page, `browse:category:${categoryId}`);
}

/**
 * Show paginated group list
 */
async function showGroupList(
  ctx: BotContext,
  groups: GroupWithDetails[],
  title: string,
  page: number,
  baseCallback: string
): Promise<void> {
  const totalPages = Math.ceil(groups.length / PAGE_SIZE);
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageGroups = groups.slice(startIdx, startIdx + PAGE_SIZE);

  let message = `📋 <b>${title}</b>\n\n`;

  const keyboard = new InlineKeyboard();

  for (const group of pageGroups) {
    const scheduledTime = new Date(group.scheduled_for);
    const isNow = scheduledTime.getTime() <= Date.now() + 60000;
    const timeText = isNow ? 'Now' : formatTimeRemaining(scheduledTime);

    const statusIcon = group.status === 'full' ? EMOJI.FULL : EMOJI.AVAILABLE;

    message += `${group.category_icon} <b>${group.title}</b>\n`;
    message += `   ${EMOJI.PLAYERS} ${group.current_players}/${group.max_players} ${statusIcon}`;
    message += ` • ${EMOJI.CLOCK} ${timeText}\n`;

    if (group.resource_name) {
      message += `   ${EMOJI.LOCATION} ${group.resource_name}\n`;
    }

    message += `   ${EMOJI.USER} ${group.creator_username ? `@${group.creator_username}` : group.creator_name}\n\n`;

    // Button to view/join
    const buttonText = group.status === 'full'
      ? `${EMOJI.FULL} ${group.title} (Full)`
      : `${EMOJI.JOIN} ${group.title}`;
    keyboard.text(buttonText, `group:view:${group.id}`).row();
  }

  // Pagination
  if (totalPages > 1) {
    if (page > 1) {
      keyboard.text(`${EMOJI.BACK} Prev`, `${baseCallback}:${page - 1}`);
    }
    keyboard.text(`${page}/${totalPages}`, 'noop');
    if (page < totalPages) {
      keyboard.text(`Next ▶️`, `${baseCallback}:${page + 1}`);
    }
    keyboard.row();
  }

  keyboard.text(`${EMOJI.BACK} Back to Categories`, 'browse:main');

  await ctx.editMessageText(message, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
  });
}

/**
 * Show single group details
 */
export async function handleGroupView(ctx: BotContext, groupId: string): Promise<void> {
  if (!ctx.dbUser) return;

  const group = await getGroupById(groupId);

  if (!group) {
    await ctx.answerCallbackQuery('Group not found.');
    return;
  }

  // Check if user is already in this group
  const { isUserInGroup } = await import('../services/groups.js');
  const isMember = await isUserInGroup(groupId, ctx.dbUser.id);
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
      keyboard.text(`${EMOJI.CANCEL} Cancel Group`, `group:cancel:${groupId}`).row();
    } else {
      keyboard.text(`${EMOJI.LEAVE} Leave Group`, `group:leave:${groupId}`).row();
    }
  } else if (group.status !== 'full' && group.status !== 'cancelled' && group.status !== 'completed') {
    keyboard.text(`${EMOJI.JOIN} Join Group`, `group:join:${groupId}`).row();
  }

  keyboard.text(`${EMOJI.BACK} Back`, 'browse:main');

  await ctx.editMessageText(message, {
    reply_markup: keyboard,
    parse_mode: 'HTML',
  });
}

/**
 * Handle browse main (back to categories)
 */
export async function handleBrowseMain(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await showCategoriesWithCounts(ctx);
}
