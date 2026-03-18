import { BotContext } from '../types/index.js';
import { handleHostelSelection } from './start.js';
import {
  handleAdmin,
  handlePendingUsers,
  handleApproveUser,
  handleRejectUser,
} from './admin.js';
import { getUserByTelegramId } from '../services/users.js';
import { isUserAdmin } from '../services/admins.js';

/**
 * Authenticate and verify admin for admin callbacks
 * Returns true if user is authenticated and is an admin, false otherwise
 */
async function authenticateAdminCallback(ctx: BotContext): Promise<boolean> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.answerCallbackQuery({ text: '❌ Unable to identify user.' });
    return false;
  }

  // Fetch user from database
  const user = await getUserByTelegramId(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ Please register first using /start.' });
    return false;
  }

  if (user.status === 'banned') {
    await ctx.answerCallbackQuery({ text: '❌ Your access has been revoked.' });
    return false;
  }

  if (user.status === 'pending') {
    await ctx.answerCallbackQuery({ text: '❌ Your account is pending approval.' });
    return false;
  }

  // Check admin status
  const isAdmin = await isUserAdmin(user.id);

  if (!isAdmin) {
    await ctx.answerCallbackQuery({ text: '❌ Admin access required.' });
    return false;
  }

  // Attach user and admin flag to context
  ctx.dbUser = user;
  ctx.isAdmin = true;

  return true;
}

/**
 * Central callback query router
 * Routes callback queries to appropriate handlers
 */
export async function handleCallbackQuery(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data) {
    await ctx.answerCallbackQuery({ text: '❌ Invalid callback data.' });
    return;
  }

  try {
    // Hostel selection callbacks (no auth required - used during registration)
    if (data.startsWith('hostel:')) {
      const hostelId = data.split(':')[1];
      if (hostelId) {
        await handleHostelSelection(ctx, hostelId);
      }
      return;
    }

    // Handle 'noop' (no operation) for pagination display
    if (data === 'noop') {
      await ctx.answerCallbackQuery();
      return;
    }

    // =========================================================================
    // ADMIN CALLBACKS - Require authentication and admin privileges
    // =========================================================================
    if (data.startsWith('admin:')) {
      // Authenticate and verify admin status
      const isAuthenticated = await authenticateAdminCallback(ctx);
      if (!isAuthenticated) {
        return;
      }

      // Route to specific admin handler
      if (data === 'admin:panel') {
        await handleAdmin(ctx);
        return;
      }

      if (data.startsWith('admin:pending_users')) {
        const parts = data.split(':');
        const page = parts[2] ? parseInt(parts[2]) : 1;
        await handlePendingUsers(ctx, page);
        return;
      }

      if (data.startsWith('admin:approve:')) {
        const userId = data.split(':')[2];
        await handleApproveUser(ctx, userId);
        return;
      }

      if (data.startsWith('admin:reject:')) {
        const userId = data.split(':')[2];
        await handleRejectUser(ctx, userId);
        return;
      }

      // Placeholder callbacks for future admin features
      if (data === 'admin:resources') {
        await ctx.answerCallbackQuery('Coming in Phase 4!');
        return;
      }

      if (data === 'admin:categories') {
        await ctx.answerCallbackQuery('Coming in Phase 5!');
        return;
      }

      if (data === 'admin:groups') {
        await ctx.answerCallbackQuery('Coming in Phase 6!');
        return;
      }

      if (data === 'admin:admins' || data === 'admin:stats') {
        await ctx.answerCallbackQuery('Coming in Phase 9!');
        return;
      }

      // Unknown admin callback
      await ctx.answerCallbackQuery({ text: '❌ Unknown admin action.' });
      console.warn(`Unknown admin callback: ${data}`);
      return;
    }

    // =========================================================================
    // OTHER CALLBACKS (future phases)
    // =========================================================================
    // case 'join_group':
    // case 'leave_group':
    // case 'checkin_resource':
    // case 'checkout_resource':
    // etc.

    // Unknown callback
    await ctx.answerCallbackQuery({ text: '❌ Unknown action.' });
    console.warn(`Unknown callback action: ${data}`);
  } catch (error) {
    console.error('Error in callback query handler:', error);
    await ctx.answerCallbackQuery({ text: '❌ An error occurred.' });
  }
}
