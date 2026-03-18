import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import { getUserActiveSessions, checkOutResource } from '../services/resources.js';
import { EMOJI } from '../utils/constants.js';
import { formatTimeRemaining } from '../utils/datetime.js';

/**
 * Checkout handler for users
 * Shows active resource sessions and allows checking out
 */

/**
 * /checkout command - Show user's active resource sessions
 */
export async function handleCheckout(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.reply('❌ Authentication required.');
    return;
  }

  try {
    await showUserSessions(ctx);
  } catch (error) {
    console.error('Error showing checkout:', error);
    await ctx.reply('❌ Error loading your sessions. Please try again.');
  }
}

/**
 * Show user's active sessions
 */
async function showUserSessions(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) return;

  const sessions = await getUserActiveSessions(ctx.dbUser.id);

  if (sessions.length === 0) {
    const message = `${EMOJI.INFO} You don't have any active resource sessions.\n\nUse /resources to check in to a resource.`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message);
    } else {
      await ctx.reply(message);
    }
    return;
  }

  let message = `${EMOJI.LOCATION} Your Active Sessions\n\n`;

  const keyboard = new InlineKeyboard();

  for (const session of sessions) {
    const timeLeft = formatTimeRemaining(new Date(session.auto_checkout_at));
    const checkedInTime = formatCheckedInTime(new Date(session.checked_in_at));

    message += `${EMOJI.IN_USE} <b>${session.resource_name}</b>\n`;
    message += `   Checked in: ${checkedInTime}\n`;
    message += `   Auto-checkout in: ${timeLeft}\n\n`;

    keyboard
      .text(`${EMOJI.LEAVE} Check out of ${session.resource_name}`, `checkout:${session.id}`)
      .row();
  }

  message += `\n${EMOJI.INFO} Resources will auto-checkout when time expires.`;

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
 * Handle checkout callback
 */
export async function handleCheckoutCallback(ctx: BotContext, sessionId: string): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.answerCallbackQuery('❌ Authentication required.');
    return;
  }

  try {
    // Verify session belongs to user
    const sessions = await getUserActiveSessions(ctx.dbUser.id);
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      await ctx.answerCallbackQuery('❌ Session not found or already checked out.');
      await showUserSessions(ctx);
      return;
    }

    // Check out
    await checkOutResource(sessionId);

    await ctx.answerCallbackQuery(`✅ Checked out of ${session.resource_name}!`);

    // Refresh the list
    await showUserSessions(ctx);
  } catch (error) {
    console.error('Error checking out:', error);
    await ctx.answerCallbackQuery('❌ Error checking out. Please try again.');
  }
}

/**
 * Format checked in time to relative time
 */
function formatCheckedInTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
