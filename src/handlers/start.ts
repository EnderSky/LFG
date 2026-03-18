import { InlineKeyboard } from 'grammy';
import { BotContext } from '../types/index.js';
import { getAllHostels } from '../services/hostels.js';
import { getUserByTelegramId, createPendingUser } from '../services/users.js';
import { notifyAdminsOfPendingUser } from '../services/notifications.js';
import { formatWelcomeMessage, formatPendingApprovalMessage, formatInfoMessage } from '../utils/formatting.js';

/**
 * Handle /start command
 * Registers new users or welcomes existing ones
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('❌ Unable to identify user.');
    return;
  }

  try {
    // Check if user already exists
    const existingUser = await getUserByTelegramId(telegramId);

    if (existingUser) {
      if (existingUser.status === 'approved') {
        await ctx.reply(formatInfoMessage('Welcome back! You\'re already registered. Use /help to see available commands.'));
        return;
      } else if (existingUser.status === 'pending') {
        await ctx.reply(formatInfoMessage('Your access request is still pending approval. Please wait for an admin to approve you.'));
        return;
      } else if (existingUser.status === 'banned') {
        await ctx.reply('❌ Your access has been revoked. Please contact hostel staff.');
        return;
      }
    }

    // Get all hostels for selection
    const hostels = await getAllHostels();

    if (hostels.length === 0) {
      await ctx.reply('❌ No hostels are currently available. Please contact support.');
      return;
    }

    // Create inline keyboard with hostel options
    const keyboard = new InlineKeyboard();
    
    for (const hostel of hostels) {
      keyboard.text(hostel.name, `hostel:${hostel.id}`).row();
    }

    await ctx.reply(formatWelcomeMessage(), {
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Error in /start handler:', error);
    await ctx.reply('❌ An error occurred. Please try again later.');
  }
}

/**
 * Handle hostel selection callback
 * Creates pending user and notifies admins
 */
export async function handleHostelSelection(ctx: BotContext, hostelId: string): Promise<void> {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || null;
  const firstName = ctx.from?.first_name || 'User';
  const lastName = ctx.from?.last_name || null;

  if (!telegramId) {
    await ctx.answerCallbackQuery({ text: '❌ Unable to identify user.' });
    return;
  }

  try {
    // Fetch hostel details
    const { getHostelById } = await import('../services/hostels.js');
    const hostel = await getHostelById(hostelId);

    if (!hostel) {
      await ctx.answerCallbackQuery({ text: '❌ Hostel not found.' });
      return;
    }

    // Create pending user
    const user = await createPendingUser(
      telegramId,
      username,
      firstName,
      lastName,
      hostelId
    );

    // Notify admins
    await notifyAdminsOfPendingUser(hostelId, username, firstName, user.id);

    // Acknowledge callback and update message
    await ctx.answerCallbackQuery({ text: `✅ Request sent to ${hostel.name}` });
    await ctx.editMessageText(formatPendingApprovalMessage(hostel.name));
  } catch (error) {
    console.error('Error in hostel selection handler:', error);
    await ctx.answerCallbackQuery({ text: '❌ An error occurred.' });
  }
}
