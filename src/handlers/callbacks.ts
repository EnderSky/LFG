import { BotContext } from '../types/index.js';
import { handleHostelSelection } from './start.js';
import {
  handleAdmin,
  handlePendingUsers,
  handleApproveUser,
  handleRejectUser,
} from './admin.js';

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
    // Hostel selection callbacks
    if (data.startsWith('hostel:')) {
      const hostelId = data.split(':')[1];
      if (hostelId) {
        await handleHostelSelection(ctx, hostelId);
      }
      return;
    }

    // Admin panel callbacks
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

    // Handle 'noop' (no operation) for pagination display
    if (data === 'noop') {
      await ctx.answerCallbackQuery();
      return;
    }

    // More cases will be added in later phases:
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
