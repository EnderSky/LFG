import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import { getPendingUsers, approveUser, rejectUser, getUserById } from '../services/users.js';
import { notifyUserApproved, notifyUserRejected } from '../services/notifications.js';
import { formatAdminPanelMessage, formatTimeAgo } from '../utils/formatting.js';
import { EMOJI } from '../utils/constants.js';

/**
 * Admin panel handlers for user approval and management
 */

const PAGE_SIZE = 5;

/**
 * Main admin panel - /admin command handler
 * Shows admin menu with options for managing users, resources, etc.
 */
export async function handleAdmin(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.reply('❌ Authentication required.');
    return;
  }

  try {
    // Get pending users count for badge
    const pendingUsers = await getPendingUsers(ctx.dbUser.hostel_id);
    const pendingBadge = pendingUsers.length > 0 ? ` (${pendingUsers.length})` : '';

    // Build inline keyboard
    const keyboard = new InlineKeyboard()
      .text(`${EMOJI.NOTIFICATION} Pending Users${pendingBadge}`, 'admin:pending_users')
      .row()
      .text(`${EMOJI.TOOLS} Manage Resources`, 'admin:resources')
      .row()
      .text(`${EMOJI.CATEGORY} Manage Categories`, 'admin:categories')
      .row()
      .text(`${EMOJI.PLAYERS} Active Groups`, 'admin:groups')
      .row()
      .text(`${EMOJI.ADMIN} Manage Admins`, 'admin:admins')
      .row()
      .text(`${EMOJI.STATS} Statistics`, 'admin:stats');

    await ctx.reply(formatAdminPanelMessage(ctx.dbUser.first_name), {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Error showing admin panel:', error);
    await ctx.reply('❌ Error loading admin panel.');
  }
}

/**
 * Show paginated list of pending users
 * Callback pattern: admin:pending_users or admin:pending_users:<page>
 */
export async function handlePendingUsers(
  ctx: BotContext,
  page: number = 1
): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery?.('❌ Authentication required.');
    return;
  }

  try {
    // Fetch all pending users for hostel
    const allPending = await getPendingUsers(ctx.dbUser.hostel_id);

    if (allPending.length === 0) {
      const keyboard = new InlineKeyboard().text(
        `${EMOJI.BACK} Back to Admin Panel`,
        'admin:panel'
      );

      if (ctx.callbackQuery) {
        await ctx.editMessageText('No pending users! ✅', {
          reply_markup: keyboard,
        });
      } else {
        await ctx.reply('No pending users! ✅', {
          reply_markup: keyboard,
        });
      }
      return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(allPending.length / PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;
    const usersOnPage = allPending.slice(startIdx, endIdx);

    // Build message with user list
    let message = `${EMOJI.NOTIFICATION} Pending Users (${allPending.length})\n\n`;

    const keyboard = new InlineKeyboard();

    for (const user of usersOnPage) {
      const userDisplay = user.username ? `@${user.username}` : user.first_name;
      const timeAgo = formatTimeAgo(user.created_at);

      message += `👤 ${userDisplay}\n`;
      message += `   ID: <code>${user.id}</code>\n`;
      message += `   Telegram: ${user.telegram_id}\n`;
      message += `   Registered: ${timeAgo}\n\n`;

      // Add approve/reject buttons for this user
      keyboard
        .text(`✅ Approve ${userDisplay}`, `admin:approve:${user.id}`)
        .text(`❌ Reject`, `admin:reject:${user.id}`)
        .row();
    }

    // Add pagination controls if needed
    if (totalPages > 1) {
      if (page > 1) {
        keyboard.text(`${EMOJI.BACK} Prev`, `admin:pending_users:${page - 1}`);
      }
      keyboard.text(`Page ${page}/${totalPages}`, 'noop');
      if (page < totalPages) {
        keyboard.text(`Next ▶️`, `admin:pending_users:${page + 1}`);
      }
      keyboard.row();
    }

    // Back button
    keyboard.text(`${EMOJI.BACK} Back to Admin Panel`, 'admin:panel');

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
    console.error('Error showing pending users:', error);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery?.('❌ Error loading pending users.');
    } else {
      await ctx.reply('❌ Error loading pending users.');
    }
  }
}

/**
 * Approve a pending user
 * Triggered by callback: admin:approve:<user_id>
 */
export async function handleApproveUser(
  ctx: BotContext,
  userId: string
): Promise<void> {
  try {
    // Get user details before approving (for notification)
    const user = await getUserById(userId);

    if (!user) {
      await ctx.answerCallbackQuery?.('❌ User not found');
      return;
    }

    // Approve user
    await approveUser(userId);

    // Notify user
    await notifyUserApproved(user.telegram_id);

    // Confirm to admin
    const userDisplay = user.username ? `@${user.username}` : user.first_name;
    await ctx.answerCallbackQuery?.(`✅ ${userDisplay} approved!`);

    // Refresh pending users list (page 1)
    await handlePendingUsers(ctx, 1);
  } catch (error) {
    console.error('Error approving user:', error);
    await ctx.answerCallbackQuery?.('❌ Error approving user');
  }
}

/**
 * Reject a pending user (set status to 'banned')
 * Triggered by callback: admin:reject:<user_id>
 */
export async function handleRejectUser(
  ctx: BotContext,
  userId: string
): Promise<void> {
  try {
    // Get user details before rejecting
    const user = await getUserById(userId);

    if (!user) {
      await ctx.answerCallbackQuery?.('❌ User not found');
      return;
    }

    // Reject user
    await rejectUser(userId);

    // Notify user
    await notifyUserRejected(user.telegram_id);

    // Confirm to admin
    const userDisplay = user.username ? `@${user.username}` : user.first_name;
    await ctx.answerCallbackQuery?.(`❌ ${userDisplay} rejected`);

    // Refresh pending users list (page 1)
    await handlePendingUsers(ctx, 1);
  } catch (error) {
    console.error('Error rejecting user:', error);
    await ctx.answerCallbackQuery?.('❌ Error rejecting user');
  }
}

/**
 * Quick approve command: /approve <user_id>
 */
export async function handleApproveCommand(ctx: BotContext): Promise<void> {
  const args = ctx.message?.text?.split(' ');

  if (!args || args.length < 2) {
    await ctx.reply('Usage: /approve <user_id>\n\nExample:\n/approve <code>550e8400-e29b-41d4-a716-446655440000</code>', {
      parse_mode: 'HTML',
    });
    return;
  }

  const userId = args[1];

  try {
    // Get user details
    const user = await getUserById(userId);

    if (!user) {
      await ctx.reply('❌ User not found. Please check the user ID.');
      return;
    }

    // Verify user is from same hostel as admin
    if (ctx.dbUser && user.hostel_id !== ctx.dbUser.hostel_id) {
      await ctx.reply('❌ You can only approve users from your hostel.');
      return;
    }

    // Approve user
    await approveUser(userId);

    // Notify user
    await notifyUserApproved(user.telegram_id);

    // Send success message to admin
    const userDisplay = user.username ? `@${user.username}` : user.first_name;
    await ctx.reply(`✅ ${userDisplay} has been approved!`);
  } catch (error) {
    console.error('Error approving user via command:', error);
    await ctx.reply('❌ Error approving user. Please try again.');
  }
}

/**
 * Quick reject command: /reject <user_id>
 */
export async function handleRejectCommand(ctx: BotContext): Promise<void> {
  const args = ctx.message?.text?.split(' ');

  if (!args || args.length < 2) {
    await ctx.reply('Usage: /reject <user_id>\n\nExample:\n/reject <code>550e8400-e29b-41d4-a716-446655440000</code>', {
      parse_mode: 'HTML',
    });
    return;
  }

  const userId = args[1];

  try {
    // Get user details
    const user = await getUserById(userId);

    if (!user) {
      await ctx.reply('❌ User not found. Please check the user ID.');
      return;
    }

    // Verify user is from same hostel as admin
    if (ctx.dbUser && user.hostel_id !== ctx.dbUser.hostel_id) {
      await ctx.reply('❌ You can only reject users from your hostel.');
      return;
    }

    // Reject user
    await rejectUser(userId);

    // Notify user
    await notifyUserRejected(user.telegram_id);

    // Send success message to admin
    const userDisplay = user.username ? `@${user.username}` : user.first_name;
    await ctx.reply(`❌ ${userDisplay} has been rejected.`);
  } catch (error) {
    console.error('Error rejecting user via command:', error);
    await ctx.reply('❌ Error rejecting user. Please try again.');
  }
}
