import { BotContext } from '../types/index.js';
import { handleHostelSelection } from './start.js';
import {
  handleAdmin,
  handlePendingUsers,
  handleApproveUser,
  handleRejectUser,
} from './admin.js';
import {
  handleResources,
  handleResourceView,
  handleResourceCheckIn,
  handleResourceCheckOut,
} from './resources.js';
import { handleCheckoutCallback } from './checkout.js';
import {
  handleAdminResources,
  handleAdminResourceList,
  handleAdminActiveSessions,
  handleAdminForceCheckout,
  handleAdminResourceAdd,
  handleAdminResourceEdit,
  handleAdminResourceDelete,
  handleAdminResourceConfirmDelete,
  handleSkipDescription,
  handleCategorySelection,
  handleDurationSelection,
  handleCancelResourceCreation,
} from './adminResources.js';
import { getUserByTelegramId } from '../services/users.js';
import { isUserAdmin } from '../services/admins.js';

/**
 * Authenticate user for regular callbacks
 * Returns true if user is authenticated and approved, false otherwise
 */
async function authenticateUserCallback(ctx: BotContext): Promise<boolean> {
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

  // Attach user to context
  ctx.dbUser = user;

  return true;
}

/**
 * Authenticate and verify admin for admin callbacks
 * Returns true if user is authenticated and is an admin, false otherwise
 */
async function authenticateAdminCallback(ctx: BotContext): Promise<boolean> {
  // First authenticate as regular user
  const isUserAuth = await authenticateUserCallback(ctx);
  if (!isUserAuth) {
    return false;
  }

  // Check admin status
  const isAdmin = await isUserAdmin(ctx.dbUser!.id);

  if (!isAdmin) {
    await ctx.answerCallbackQuery({ text: '❌ Admin access required.' });
    return false;
  }

  // Attach admin flag to context
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
    // RESOURCE CALLBACKS - Require user authentication
    // =========================================================================
    if (data.startsWith('resource:')) {
      const isAuthenticated = await authenticateUserCallback(ctx);
      if (!isAuthenticated) {
        return;
      }

      if (data === 'resource:list') {
        await handleResources(ctx);
        return;
      }

      if (data.startsWith('resource:view:')) {
        const resourceId = data.split(':')[2];
        await handleResourceView(ctx, resourceId);
        return;
      }

      if (data.startsWith('resource:checkin:')) {
        const resourceId = data.split(':')[2];
        await handleResourceCheckIn(ctx, resourceId);
        return;
      }

      if (data.startsWith('resource:checkout:')) {
        const resourceId = data.split(':')[2];
        await handleResourceCheckOut(ctx, resourceId);
        return;
      }

      await ctx.answerCallbackQuery({ text: '❌ Unknown resource action.' });
      return;
    }

    // =========================================================================
    // CHECKOUT CALLBACKS - Require user authentication
    // =========================================================================
    if (data.startsWith('checkout:')) {
      const isAuthenticated = await authenticateUserCallback(ctx);
      if (!isAuthenticated) {
        return;
      }

      const sessionId = data.split(':')[1];
      await handleCheckoutCallback(ctx, sessionId);
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

      // ----- ADMIN RESOURCE MANAGEMENT -----
      if (data === 'admin:resources') {
        await handleAdminResources(ctx);
        return;
      }

      if (data.startsWith('admin:resource:list')) {
        const parts = data.split(':');
        const page = parts[3] ? parseInt(parts[3]) : 1;
        await handleAdminResourceList(ctx, page);
        return;
      }

      if (data === 'admin:resource:sessions') {
        await handleAdminActiveSessions(ctx);
        return;
      }

      if (data.startsWith('admin:resource:force_checkout:')) {
        const sessionId = data.split(':')[3];
        await handleAdminForceCheckout(ctx, sessionId);
        return;
      }

      if (data === 'admin:resource:add') {
        await handleAdminResourceAdd(ctx);
        return;
      }

      if (data === 'admin:resource:skip_description') {
        await handleSkipDescription(ctx);
        return;
      }

      if (data === 'admin:resource:cancel') {
        await handleCancelResourceCreation(ctx);
        return;
      }

      if (data.startsWith('admin:resource:category:')) {
        const categoryId = data.split(':')[3];
        await handleCategorySelection(ctx, categoryId);
        return;
      }

      if (data.startsWith('admin:resource:duration:')) {
        const hours = parseInt(data.split(':')[3]);
        await handleDurationSelection(ctx, hours);
        return;
      }

      if (data.startsWith('admin:resource:edit:')) {
        const resourceId = data.split(':')[3];
        await handleAdminResourceEdit(ctx, resourceId);
        return;
      }

      if (data.startsWith('admin:resource:delete:')) {
        const resourceId = data.split(':')[3];
        await handleAdminResourceDelete(ctx, resourceId);
        return;
      }

      if (data.startsWith('admin:resource:confirm_delete:')) {
        const resourceId = data.split(':')[3];
        await handleAdminResourceConfirmDelete(ctx, resourceId);
        return;
      }

      // ----- PLACEHOLDER CALLBACKS FOR FUTURE FEATURES -----
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
    // etc.

    // Unknown callback
    await ctx.answerCallbackQuery({ text: '❌ Unknown action.' });
    console.warn(`Unknown callback action: ${data}`);
  } catch (error) {
    console.error('Error in callback query handler:', error);
    await ctx.answerCallbackQuery({ text: '❌ An error occurred.' });
  }
}
